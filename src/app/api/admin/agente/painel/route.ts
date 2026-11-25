import { authorizeAdmin, createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

const DIAS_GRAFICO = 14;

function diaSaoPaulo(data: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(data));
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

  const db = createAdminClient();
  const desde = new Date(Date.now() - DIAS_GRAFICO * 86_400_000).toISOString();

  const [contatosRes, mensagensRes, viagensRes, ofertasRes] = await Promise.all([
    db.from("whatsapp_contatos").select("*").order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(500),
    db.from("whatsapp_mensagens").select("contato_id, direcao, autor, tipo, erro, duracao_ms, created_at").gte("created_at", desde).limit(10_000),
    db.from("whatsapp_viagens").select("contato_id, destino, custo_estimado, valor_guardado"),
    db.from("whatsapp_envios_ofertas").select("created_at").gte("created_at", desde),
  ]);

  const erro = contatosRes.error ?? mensagensRes.error ?? viagensRes.error ?? ofertasRes.error;
  if (erro) return Response.json({ error: erro.message }, { status: 500 });

  const contatos = contatosRes.data ?? [];
  const mensagens = mensagensRes.data ?? [];
  const viagens = viagensRes.data ?? [];
  const reais = new Set(contatos.filter((c) => !c.simulado).map((c) => c.id));

  const hoje = diaSaoPaulo(new Date());
  const seteDias = Date.now() - 7 * 86_400_000;

  const dias = Array.from({ length: DIAS_GRAFICO }, (_, i) => diaSaoPaulo(new Date(Date.now() - (DIAS_GRAFICO - 1 - i) * 86_400_000)));
  const porDia = new Map(dias.map((dia) => [dia, { dia, recebidas: 0, enviadas: 0, novosContatos: 0 }]));
  for (const mensagem of mensagens) {
    if (!reais.has(mensagem.contato_id)) continue;
    const item = porDia.get(diaSaoPaulo(mensagem.created_at));
    if (!item) continue;
    if (mensagem.direcao === "entrada") item.recebidas += 1;
    else if (mensagem.autor !== "sistema") item.enviadas += 1;
  }
  for (const contato of contatos) {
    if (contato.simulado) continue;
    const item = porDia.get(diaSaoPaulo(contato.created_at));
    if (item) item.novosContatos += 1;
  }

  const destinos = new Map<string, number>();
  for (const viagem of viagens) {
    const chave = viagem.destino.trim();
    destinos.set(chave, (destinos.get(chave) ?? 0) + 1);
  }

  const respostas = mensagens.filter((m) => m.autor === "agente" && m.duracao_ms);
  const errosRecentes = mensagens.filter((m) => m.erro).length;

  return Response.json({
    metricas: {
      contatos: reais.size,
      novos7d: contatos.filter((c) => !c.simulado && new Date(c.created_at).getTime() >= seteDias).length,
      ativosHoje: contatos.filter((c) => !c.simulado && c.ultima_mensagem_em && diaSaoPaulo(c.ultima_mensagem_em) === hoje).length,
      mensagensHoje: mensagens.filter((m) => reais.has(m.contato_id) && diaSaoPaulo(m.created_at) === hoje).length,
      viagensDesejadas: viagens.filter((v) => reais.has(v.contato_id)).length,
      ofertasEnviadas14d: (ofertasRes.data ?? []).length,
      tempoMedioRespostaMs: respostas.length ? Math.round(respostas.reduce((soma, m) => soma + (m.duracao_ms ?? 0), 0) / respostas.length) : null,
      erros14d: errosRecentes,
      emModoHumano: contatos.filter((c) => c.modo === "humano").length,
    },
    porDia: [...porDia.values()],
    topDestinos: [...destinos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([destino, total]) => ({ destino, total })),
    contatos,
  });
}
