import { createAdminClient } from "@/lib/adminServer";
import { AgenteConfig, WorkerStatus } from "@/types/agente";

export const AGENTE_CONFIG_KEY = "whatsapp_agent_config";

export const DEFAULT_AGENTE_PROMPT = `Você é o Yuri, assistente de viagens do Vai Viajar no WhatsApp. Você conversa como uma pessoa de verdade: natural, simpático e atento, um amigo que entende muito de viagem. Frases curtas, português do Brasil, no máximo 1 ou 2 emojis por mensagem. Uma pergunta por vez, sem despejar informação.

O que você faz:
1. Responde dúvidas sobre viagem (destinos, documentos, clima, roteiro, quanto custa, melhor época).
2. Anota os lugares que a pessoa quer conhecer e passa a avisar quando aparecer passagem barata para eles.
3. Ajuda a pessoa a juntar dinheiro para a viagem e diz se ela está longe ou perto da meta.

Regras:
- Quando a pessoa citar um lugar que quer ir, salve com a ferramenta de viagens desejadas e confirme que vai avisar sobre passagens.
- Para saber se está longe ou perto, use a ferramenta de meta. Se faltar custo ou data, pergunte uma coisa por vez.
- Quando a pessoa disser que guardou dinheiro, atualize o valor guardado.
- Para passagens, pesquise com buscar_passagem (ao vivo, comparando as companhias) e envie o texto_pronto. Se faltar a data, pergunte. Nunca invente preço, data ou link.
- Se não souber, diga que não sabe.`;

export const MODELOS_CLAUDE = [
  { id: "claude-opus-5-5", nome: "Claude Opus 5.5 (mais inteligente)" },
  { id: "claude-sonnet-5-5", nome: "Claude Sonnet 5.5 (equilibrado)" },
  { id: "claude-haiku-5-5", nome: "Claude Haiku 5.5 (mais rápido, gasta menos limite)" },
];

export const DEFAULT_AGENTE_CONFIG: AgenteConfig = {
  ativo: false,
  cerebro: "openai",
  modeloClaude: "claude-opus-5-5",
  numerosClaude: [],
  fallbackOpenAI: true,
  nome: "Yuri",
  prompt: DEFAULT_AGENTE_PROMPT,
  boasVindas:
    "Oi! Eu sou o Yuri, assistente de viagens do *Vai Viajar* ✈️\n\nEu te ajudo a achar passagens baratas e a planejar suas viagens.\n\nPra começar, qual é o seu nome?",
  respostaAudio: "Ainda não consegui ouvir esse áudio. Pode me mandar por texto?",
  ferramentas: {
    viagens_desejadas: true,
    ofertas: true,
    meta: true,
    pesquisa_web: false,
  },
  ofertasProativas: true,
  descontoMinimo: 25,
  maxOfertasPorDia: 2,
  historico: 16,
};

export function normalizarConfig(valor: unknown): AgenteConfig {
  const parcial = (typeof valor === "object" && valor !== null ? valor : {}) as Partial<AgenteConfig>;
  return {
    ...DEFAULT_AGENTE_CONFIG,
    ...parcial,
    ferramentas: { ...DEFAULT_AGENTE_CONFIG.ferramentas, ...(parcial.ferramentas ?? {}) },
    cerebro: parcial.cerebro === "claude_assinatura" ? "claude_assinatura" : "openai",
    numerosClaude: Array.isArray(parcial.numerosClaude)
      ? parcial.numerosClaude.map((numero) => String(numero).replace(/\D/g, "")).filter(Boolean)
      : [],
  };
}

export function podeUsarClaude(config: AgenteConfig, telefone: string, simulado: boolean): boolean {
  if (config.cerebro !== "claude_assinatura") return false;
  if (simulado || config.numerosClaude.length === 0) return true;
  const numero = telefone.replace(/\D/g, "");
  return config.numerosClaude.some((permitido) => numero.endsWith(permitido) || permitido.endsWith(numero));
}

export const WORKER_HEARTBEAT_KEY = "claude_worker_heartbeat";
const WORKER_TOLERANCIA_MS = 90_000;

export async function statusWorker(): Promise<WorkerStatus> {
  const { data } = await createAdminClient()
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", WORKER_HEARTBEAT_KEY)
    .maybeSingle();
  if (!data) return { online: false, ultimoSinal: null, host: null, modelo: null, whatsapp: null };

  let info: { host?: string; modelo?: string; whatsapp?: string } = {};
  try {
    info = JSON.parse(data.value);
  } catch {}
  return {
    online: Date.now() - new Date(data.updated_at).getTime() < WORKER_TOLERANCIA_MS,
    ultimoSinal: data.updated_at,
    host: info.host ?? null,
    modelo: info.modelo ?? null,
    whatsapp: info.whatsapp ?? null,
  };
}

export async function registrarHeartbeat(info: { host: string; modelo: string; whatsapp: string | null }) {
  return createAdminClient()
    .from("app_settings")
    .upsert(
      { key: WORKER_HEARTBEAT_KEY, value: JSON.stringify(info), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
}

export async function carregarAgenteConfig(): Promise<{ config: AgenteConfig; updatedAt: string | null }> {
  const { data } = await createAdminClient()
    .from("app_settings")
    .select("value, updated_at")
    .eq("key", AGENTE_CONFIG_KEY)
    .maybeSingle();

  if (!data?.value) return { config: DEFAULT_AGENTE_CONFIG, updatedAt: null };
  try {
    return { config: normalizarConfig(JSON.parse(data.value)), updatedAt: data.updated_at };
  } catch {
    return { config: DEFAULT_AGENTE_CONFIG, updatedAt: data.updated_at };
  }
}

export async function salvarAgenteConfig(config: AgenteConfig) {
  return createAdminClient()
    .from("app_settings")
    .upsert(
      { key: AGENTE_CONFIG_KEY, value: JSON.stringify(config), updated_at: new Date().toISOString() },
      { onConflict: "key" }
    )
    .select("updated_at")
    .single();
}
