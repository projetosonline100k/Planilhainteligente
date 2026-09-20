import { authorizeUser, createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";
const IATA = /^[A-Z]{3}$/;

export async function POST(request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  let corpo; try { corpo = await request.json(); } catch { return Response.json({ error: "Dados do alerta inválidos." }, { status: 400 }); }
  const origin = String(corpo?.origin || "").trim().toUpperCase(); const destination = String(corpo?.destination || "").trim().toUpperCase();
  const outboundDate = String(corpo?.outbound_date || ""); const returnDate = corpo?.return_date ? String(corpo.return_date) : null;
  const adults = Number(corpo?.adults || 1); const precoAlvo = Number(corpo?.preco_alvo); const hoje = new Date().toISOString().slice(0, 10);
  if (!IATA.test(origin) || !IATA.test(destination) || origin === destination) return Response.json({ error: "Origem e destino inválidos." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(outboundDate) || outboundDate < hoje || (returnDate && returnDate < outboundDate)) return Response.json({ error: "Datas do alerta inválidas ou já expiradas." }, { status: 400 });
  if (!Number.isInteger(adults) || adults < 1 || adults > 9 || !Number.isFinite(precoAlvo) || precoAlvo <= 0) return Response.json({ error: "Passageiros ou preço máximo inválidos." }, { status: 400 });

  const supabase = createAdminClient();
  let existente = supabase.from("alertas_preco").select("id").eq("user_id", auth.user.id).eq("origin", origin).eq("destination", destination).eq("outbound_date", outboundDate).eq("adults", adults);
  existente = returnDate ? existente.eq("return_date", returnDate) : existente.is("return_date", null);
  const { data: encontrados, error: erroBusca } = await existente.limit(1);
  if (erroBusca) return Response.json({ error: "Não foi possível verificar seus alertas." }, { status: 500 });
  const valores = { user_id: auth.user.id, origin, destination, outbound_date: outboundDate, return_date: returnDate, adults, preco_alvo: precoAlvo, ativo: true, updated_at: new Date().toISOString() };
  if (encontrados?.[0]) {
    const { data, error } = await supabase.from("alertas_preco").update(valores).eq("id", encontrados[0].id).eq("user_id", auth.user.id).select().single();
    if (error) return Response.json({ error: "Não foi possível atualizar o alerta." }, { status: 500 });
    return Response.json({ alerta: data, atualizado: true });
  }
  const { data, error } = await supabase.from("alertas_preco").insert(valores).select().single();
  if (error) return Response.json({ error: "Não foi possível criar o alerta." }, { status: 500 });
  return Response.json({ alerta: data, atualizado: false }, { status: 201 });
}

export async function GET(request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await createAdminClient().from("alertas_preco").select("id,origin,destination,outbound_date,return_date,adults,preco_alvo,ativo,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Não foi possível carregar seus alertas." }, { status: 500 });
  return Response.json({ alertas: data ?? [] });
}

export async function DELETE(request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url); let id = url.searchParams.get("id");
  if (!id) { try { id = (await request.json())?.id; } catch { /* query string também é aceita */ } }
  if (!id) return Response.json({ error: "Informe o alerta que deseja remover." }, { status: 400 });
  const { error } = await createAdminClient().from("alertas_preco").delete().eq("id", id).eq("user_id", auth.user.id);
  if (error) return Response.json({ error: "Não foi possível remover o alerta." }, { status: 500 });
  return Response.json({ ok: true });
}
