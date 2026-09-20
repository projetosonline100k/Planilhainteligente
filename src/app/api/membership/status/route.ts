import { createClient, isAuthApiError } from "@supabase/supabase-js";
import { isActiveMember } from "@/lib/membershipServer";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const anonymous = { authenticated: false, active: false };

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json(anonymous, { headers });

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Auth indisponível.");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) }) },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) {
      if (isAuthApiError(error) && [401, 403].includes(error.status)) {
        return Response.json(anonymous, { status: 401, headers });
      }
      throw error;
    }
    if (!data.user) return Response.json(anonymous, { status: 401, headers });
    const active = await isActiveMember(data.user.id);
    return Response.json({ authenticated: true, active }, { headers });
  } catch {
    return Response.json({ error: "Não conseguimos verificar seu acesso agora." }, { status: 503, headers });
  }
}
