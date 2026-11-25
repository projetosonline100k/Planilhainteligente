import { authorizeAdmin } from "@/lib/adminServer";
import { carregarAgenteConfig, DEFAULT_AGENTE_CONFIG, MODELOS_CLAUDE, normalizarConfig, salvarAgenteConfig, statusWorker } from "@/lib/agente/config";
import { FERRAMENTAS_DESCRICAO, urlBase } from "@/lib/agente/ferramentas";
import { whapiConfigurado } from "@/lib/agente/whapi";

export const dynamic = "force-dynamic";

function conexao() {
  return {
    whapi: whapiConfigurado(),
    openai: Boolean(process.env.OPENAI_API_KEY),
    webhookSecret: Boolean(process.env.WHATSAPP_WEBHOOK_SECRET),
    cron: Boolean(process.env.CRON_SECRET),
    webhookUrl: `${urlBase()}/api/whatsapp/webhook?secret=SEU_WHATSAPP_WEBHOOK_SECRET`,
    modelo: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

  try {
    const [{ config, updatedAt }, worker] = await Promise.all([carregarAgenteConfig(), statusWorker()]);
    return Response.json({
      config,
      updatedAt,
      padrao: DEFAULT_AGENTE_CONFIG,
      conexao: conexao(),
      ferramentas: FERRAMENTAS_DESCRICAO,
      modelosClaude: MODELOS_CLAUDE,
      worker,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

  const body = (await request.json().catch(() => null)) as { config?: unknown } | null;
  const config = normalizarConfig(body?.config);
  if (!config.prompt.trim() || config.prompt.length > 20_000) {
    return Response.json({ error: "O prompt deve ter entre 1 e 20.000 caracteres." }, { status: 400 });
  }
  if (!config.nome.trim()) return Response.json({ error: "Dê um nome ao agente." }, { status: 400 });
  config.descontoMinimo = Math.min(90, Math.max(0, Math.round(config.descontoMinimo)));
  config.maxOfertasPorDia = Math.min(10, Math.max(0, Math.round(config.maxOfertasPorDia)));
  config.historico = Math.min(40, Math.max(2, Math.round(config.historico)));
  if (!MODELOS_CLAUDE.some((modelo) => modelo.id === config.modeloClaude)) config.modeloClaude = DEFAULT_AGENTE_CONFIG.modeloClaude;

  const { data, error } = await salvarAgenteConfig(config);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ config, updatedAt: data.updated_at });
}
