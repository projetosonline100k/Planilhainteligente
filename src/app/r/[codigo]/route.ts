import { createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

const CODIGO = /^[0-9a-f]{10}$/i;

// Link curto enviado no WhatsApp: abre direto a passagem, sem passar por nenhuma página do app.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (codigo === "ping") return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

  const radar = new URL("/site/radar", request.url);
  if (!CODIGO.test(codigo)) return Response.redirect(radar, 302);

  const { data } = await createAdminClient()
    .from("flight_offers")
    .select("booking_url")
    .eq("short_id", codigo.toLowerCase())
    .eq("status", "active")
    .not("booking_url", "is", null)
    .limit(1)
    .maybeSingle();

  try {
    const destino = data?.booking_url ? new URL(data.booking_url) : null;
    if (destino?.protocol === "https:") {
      return new Response(null, { status: 302, headers: { Location: destino.toString(), "Cache-Control": "no-store" } });
    }
  } catch {}

  return Response.redirect(radar, 302);
}
