import webpush from "web-push";
import { createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  return Boolean(segredo && request.headers.get("authorization") === `Bearer ${segredo}`);
}

async function menorPreco(alerta) {
  const origin = alerta.origin || alerta.origem; const destination = alerta.destination || alerta.destino;
  const outboundDate = alerta.outbound_date || alerta.data_ida; const returnDate = alerta.return_date || alerta.data_volta;
  const consulta = new URL("https://serpapi.com/search.json");
  consulta.search = new URLSearchParams({ engine: "google_flights", api_key: process.env.SERPAPI_KEY, departure_id: origin, arrival_id: destination, outbound_date: outboundDate, adults: String(alerta.adults || alerta.adultos || 1), type: returnDate ? "1" : "2", currency: "BRL", hl: "pt", gl: "br", sort_by: "2", ...(returnDate ? { return_date: returnDate } : {}) }).toString();
  const resposta = await fetch(consulta, { cache: "no-store", signal: AbortSignal.timeout(30000) }); const dados = await resposta.json();
  if (!resposta.ok || dados.error) throw new Error(dados.error || "Falha na SerpApi");
  const voos = [...(dados.best_flights || []), ...(dados.other_flights || [])]; const precos = voos.map((voo) => voo.price).filter((preco) => typeof preco === "number");
  return { preco: precos.length ? Math.min(...precos) : null, link: dados.search_metadata?.google_flights_url || "/buscar-passagens", origin, destination };
}

export async function GET(request) {
  if (!autorizado(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim(); const privateKey = process.env.VAPID_PRIVATE_KEY?.trim(); const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject || !process.env.SERPAPI_KEY) return Response.json({ error: "Variáveis do cron, SerpApi ou VAPID não configuradas." }, { status: 503 });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);
  await supabase.from("alertas_preco").update({ ativo: false, updated_at: new Date().toISOString() }).eq("ativo", true).lt("outbound_date", hoje);
  const { data: alertas, error } = await supabase.from("alertas_preco").select("*").eq("ativo", true).gte("outbound_date", hoje);
  if (error) {
    console.error("Erro ao carregar alertas_preco:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return Response.json({ error: "Não foi possível carregar os alertas." }, { status: 500 });
  }
  const resumo = { verificados: 0, disparados: 0, erros: 0 };

  for (const alerta of alertas || []) {
    try {
      resumo.verificados += 1; const resultado = await menorPreco(alerta); const alvo = Number(alerta.preco_alvo || alerta.valor_alvo);
      if (resultado.preco === null || !alvo || resultado.preco > alvo) continue;
      const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("alerta_id", alerta.id).gte("created_at", desde);
      if (count) continue;
      const titulo = "Preço de passagem caiu!"; const mensagem = `${resultado.origin} → ${resultado.destination} a partir de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(resultado.preco)}.`;
      await supabase.from("notificacoes").insert({ user_id: alerta.user_id, alerta_id: alerta.id, titulo, mensagem, link: resultado.link });
      const { data: inscricoes } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", alerta.user_id);
      await Promise.allSettled((inscricoes || []).map(async (item) => { try { await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, JSON.stringify({ titulo, mensagem, link: resultado.link, tag: `alerta-${alerta.id}` })); } catch (falha) { if (falha?.statusCode === 404 || falha?.statusCode === 410) await supabase.from("push_subscriptions").delete().eq("id", item.id); else throw falha; } }));
      resumo.disparados += 1;
    } catch { resumo.erros += 1; }
  }
  return Response.json(resumo);
}
