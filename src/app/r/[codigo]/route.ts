import { createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

const CODIGO = /^[0-9a-f]{10}$/i;

// Link curto enviado no WhatsApp: abre direto a passagem, sem passar por nenhuma página do app.
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  if (codigo === "ping") return Response.json({ ok: true, versao: 3 }, { headers: { "Cache-Control": "no-store" } });

  const radar = new URL("/site/radar", request.url);
  if (!CODIGO.test(codigo)) return Response.redirect(radar, 302);

  const db = createAdminClient();
  const { data: voo } = await db.from("links_voo").select("url").eq("codigo", codigo.toLowerCase()).maybeSingle();
  if (voo?.url) {
    try {
      const destino = new URL(voo.url);
      if (destino.protocol === "https:") {
        return new Response(null, { status: 302, headers: { Location: destino.toString(), "Cache-Control": "no-store" } });
      }
    } catch {}
  }

  const { data: oferta } = await db
    .from("flight_offers")
    .select("id, booking_url")
    .eq("short_id", codigo.toLowerCase())
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // Prefere o voo mais barato já conferido; senão, o link da oferta do radar.
  const { data: conferido } = oferta
    ? await db.from("flight_offer_verificacoes").select("link_voo").eq("offer_id", oferta.id).maybeSingle()
    : { data: null };
  const data = { booking_url: conferido?.link_voo || oferta?.booking_url || null };

  try {
    const destino = data?.booking_url ? new URL(data.booking_url) : null;
    if (destino?.protocol === "https:") {
      return new Response(null, { status: 302, headers: { Location: destino.toString(), "Cache-Control": "no-store" } });
    }
  } catch {}

  return Response.redirect(radar, 302);
}
