import { createClient, isAuthApiError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/adminServer";
import { isActiveMember } from "@/lib/membershipServer";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401, headers });

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Auth indisponível.");

    const authClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) }) },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError) {
      if (isAuthApiError(userError) && [401, 403].includes(userError.status)) {
        return Response.json({ error: "Sessão inválida." }, { status: 401, headers });
      }
      throw userError;
    }
    if (!userData.user) return Response.json({ error: "Sessão inválida." }, { status: 401, headers });

    const active = await isActiveMember(userData.user.id);
    if (!active) return Response.json({ error: "Acesso não está ativo." }, { status: 403, headers });

    if (!UUID.test(id)) return Response.json({ error: "Oferta não encontrada." }, { status: 404, headers });

    const adminClient = createAdminClient();
    const { data: offer, error: offerError } = await adminClient
      .from("flight_offers")
      .select("status, booking_url")
      .eq("id", id)
      .abortSignal(AbortSignal.timeout(10_000))
      .maybeSingle();
    if (offerError) throw offerError;
    if (!offer) return Response.json({ error: "Oferta não encontrada." }, { status: 404, headers });
    if (offer.status !== "active") return Response.json({ error: "Oferta não está mais disponível." }, { status: 410, headers });
    if (!offer.booking_url) throw new Error("Oferta sem link de compra.");

    return Response.json({ bookingUrl: offer.booking_url as string }, { headers });
  } catch {
    return Response.json({ error: "Não conseguimos abrir esta oferta agora." }, { status: 503, headers });
  }
}
