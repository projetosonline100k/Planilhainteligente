import { createAdminClient } from "@/lib/adminServer";
import { carregarAgenteConfig, podeUsarClaude, statusWorker } from "@/lib/agente/config";
import { etapaDoContato, etapaInicial, instrucoesEtapa } from "@/lib/agente/etapas";
import { executarFerramenta, ferramentasOpenAI } from "@/lib/agente/ferramentas";
import { enviarTextoWaha, wahaConfigurado } from "@/lib/agente/waha";
import { instrucoesPesquisaWeb } from "@/lib/agente/sitesConfiaveis";
import { transcreverAudio } from "@/lib/agente/transcricao";
import { enviarTextoWhatsApp, whapiConfigurado } from "@/lib/agente/whapi";
import { AgenteConfig, ChamadaFerramenta, Contato, Mensagem } from "@/types/agente";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_RODADAS = 5;

const FORMATO_MENSAGENS = `## Formato das mensagens (WhatsApp)
- Escreva para ler rápido no celular: no máximo umas 8 linhas, frases curtas, uma ideia por parágrafo, linha em branco entre os blocos.
- Use um emoji no começo de cada informação importante (📍 lugar, 📅 datas, 💰 preço, 📉 desconto, ✅ confirmado, 🔗 link), nunca no meio de frases.
- *Negrito* só no destino e no preço. Sem #, sem tabelas e sem listas com hífen: liste uma informação por linha.
- Passagens: use buscar_passagem, que pesquisa ao vivo e compara as companhias. Precisa de destino e data de ida (e a volta, se houver): se faltar, pergunte a data antes de pesquisar. Envie o texto_pronto exatamente como veio, sem reescrever e sem encurtar o link, e depois o comparativo_pronto, se houver. Nunca cite preço que não tenha vindo da pesquisa.
- Termine com UMA pergunta curta só quando precisar de algo da pessoa.`;

type ItemSaida = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ text?: string }>;
};

export type MensagemRecebida = {
  telefone: string;
  nome?: string | null;
  texto?: string | null;
  tipo?: string;
  audioLink?: string | null;
  audioCabecalhos?: Record<string, string>;
  externoId?: string | null;
  simulado?: boolean;
};

export type ResultadoProcessamento = {
  contato: Contato;
  resposta: string | null;
  ferramentas: ChamadaFerramenta[];
  pendente?: boolean;
  motivo?: string;
  erro?: string;
};

export type RespostaAgente = { resposta: string; chamadas: ChamadaFerramenta[] };

function extrairTexto(output: ItemSaida[]): string {
  return output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .map((parte) => parte.text)
    .filter((parte): parte is string => typeof parte === "string")
    .join("\n")
    .trim();
}

async function obterContato(telefone: string, nome: string | null, simulado: boolean): Promise<{ contato: Contato; novo: boolean }> {
  const db = createAdminClient();
  const { data: existente } = await db.from("whatsapp_contatos").select("*").eq("telefone", telefone).maybeSingle();
  if (existente) {
    if (nome && !existente.nome) await db.from("whatsapp_contatos").update({ nome }).eq("id", existente.id);
    return { contato: { ...existente, nome: existente.nome ?? nome } as Contato, novo: false };
  }

  const { data, error } = await db
    .from("whatsapp_contatos")
    .insert({ telefone, nome, simulado })
    .select("*")
    .single();
  if (error) {
    const { data: corrida } = await db.from("whatsapp_contatos").select("*").eq("telefone", telefone).single();
    if (corrida) return { contato: corrida as Contato, novo: false };
    throw new Error(error.message);
  }
  return { contato: data as Contato, novo: true };
}

export async function montarInstrucoes(config: AgenteConfig, contato: Contato, primeiraConversa: boolean): Promise<string> {
  const { data: viagens } = await createAdminClient()
    .from("whatsapp_viagens")
    .select("destino, origem, data_viagem, custo_estimado, valor_guardado, guardar_por_mes")
    .eq("contato_id", contato.id);

  const hoje = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Sao_Paulo" }).format(new Date());
  const etapa = etapaDoContato(contato);
  const contexto = [
    `Seu nome: ${config.nome}.`,
    `Hoje é ${hoje}.`,
    contato.nome_preferido ? `Ela se chama ${contato.nome_preferido}.` : contato.nome ? `Nome no perfil do WhatsApp dela: ${contato.nome} (pode não ser como ela quer ser chamada).` : null,
    viagens?.length
      ? `Viagens que essa pessoa já salvou: ${JSON.stringify(viagens)}`
      : "Essa pessoa ainda não salvou nenhuma viagem.",
  ].filter(Boolean);

  const pesquisaWeb =
    config.ferramentas.pesquisa_web && config.cerebro === "claude_assinatura" && !etapaInicial(etapa) ? `\n\n${instrucoesPesquisaWeb()}` : "";
  return `${config.prompt}\n\n${FORMATO_MENSAGENS}\n\n${instrucoesEtapa(etapa, contato, config, primeiraConversa)}${pesquisaWeb}\n\n## Contexto\n${contexto.join("\n")}`;
}

// A pergunta sobre o destino só é feita uma vez: depois da resposta nessa etapa, a conversa fica livre.
export async function concluirEtapaDestino(contato: Contato): Promise<void> {
  if (etapaDoContato(contato) !== "destino") return;
  await createAdminClient().from("whatsapp_contatos").update({ destino_perguntado: true }).eq("id", contato.id);
}

export async function carregarHistorico(contatoId: string, limite: number): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const { data } = await createAdminClient()
    .from("whatsapp_mensagens")
    .select("autor, texto")
    .eq("contato_id", contatoId)
    .neq("autor", "sistema")
    .neq("tipo", "ignorada")
    .order("created_at", { ascending: false })
    .limit(limite);

  return (data ?? [])
    .reverse()
    .filter((mensagem) => mensagem.texto?.trim())
    .map((mensagem) => ({
      role: mensagem.autor === "usuario" ? "user" : "assistant",
      content: mensagem.texto,
    }));
}

export async function ehPrimeiraConversa(contatoId: string): Promise<boolean> {
  const { count } = await createAdminClient()
    .from("whatsapp_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("contato_id", contatoId)
    .eq("direcao", "saida")
    .neq("autor", "sistema");
  return !count;
}

export async function rodarAgenteOpenAI(config: AgenteConfig, contato: Contato, primeiraConversa: boolean): Promise<RespostaAgente> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const instrucoes = await montarInstrucoes(config, contato, primeiraConversa);
  const tools = ferramentasOpenAI(config, etapaDoContato(contato));
  const input: unknown[] = await carregarHistorico(contato.id, config.historico);
  const chamadas: ChamadaFerramenta[] = [];

  for (let rodada = 0; rodada < MAX_RODADAS; rodada += 1) {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: instrucoes,
        input,
        ...(tools.length ? { tools } : {}),
        temperature: 0.5,
        store: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const body = (await response.json()) as { output?: ItemSaida[]; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message ?? `OpenAI respondeu ${response.status}.`);

    const output = body.output ?? [];
    const pedidos = output.filter((item) => item.type === "function_call");
    if (!pedidos.length) return { resposta: extrairTexto(output), chamadas };

    input.push(...output);
    for (const pedido of pedidos) {
      let argumentos: Record<string, unknown> = {};
      try {
        argumentos = JSON.parse(pedido.arguments || "{}");
      } catch {}
      let resultado: unknown;
      try {
        resultado = await executarFerramenta(pedido.name ?? "", argumentos, contato.id);
      } catch (error) {
        resultado = { erro: error instanceof Error ? error.message : "Falha na ferramenta." };
      }
      chamadas.push({ nome: pedido.name ?? "", argumentos, resultado });
      input.push({ type: "function_call_output", call_id: pedido.call_id, output: JSON.stringify(resultado) });
    }
  }

  return { resposta: "", chamadas };
}

type Envio = { ok: true; id?: string; naFila?: boolean } | { ok: false; erro: string };

// Com WAHA_URL (worker local/VPS) envia direto; sem WAHA nem WhApi, deixa na fila para o worker.
export async function enviar(contato: Contato, texto: string): Promise<Envio> {
  if (contato.simulado) return { ok: true };
  if (wahaConfigurado()) return enviarTextoWaha(contato.telefone, texto);
  if (whapiConfigurado()) return enviarTextoWhatsApp(contato.telefone, texto);
  return { ok: true, naFila: true };
}

export async function registrarSaida(
  contato: Contato,
  texto: string,
  autor: "agente" | "humano" | "sistema",
  extras: { ferramentas?: ChamadaFerramenta[]; duracao_ms?: number; tipo?: string; cerebro?: string } = {}
): Promise<Mensagem> {
  const envio = await enviar(contato, texto);
  const { data } = await createAdminClient()
    .from("whatsapp_mensagens")
    .insert({
      contato_id: contato.id,
      direcao: "saida",
      autor,
      tipo: extras.tipo ?? "texto",
      texto,
      ferramentas: extras.ferramentas?.length ? extras.ferramentas : null,
      duracao_ms: extras.duracao_ms ?? null,
      cerebro: extras.cerebro ?? null,
      erro: envio.ok ? null : envio.erro,
      externo_id: envio.ok && envio.id ? envio.id : null,
      aguardando_envio: envio.ok && envio.naFila === true,
    })
    .select("*")
    .single();
  return data as Mensagem;
}

export async function registrarErroAgente(contatoId: string, mensagem: string, duracaoMs: number, cerebro: string) {
  await createAdminClient().from("whatsapp_mensagens").insert({
    contato_id: contatoId,
    direcao: "saida",
    autor: "sistema",
    texto: "",
    erro: mensagem,
    duracao_ms: duracaoMs,
    cerebro,
  });
}

export async function responderComOpenAI(config: AgenteConfig, contato: Contato, primeiraConversa: boolean, inicio: number): Promise<ResultadoProcessamento> {
  try {
    const { resposta, chamadas } = await rodarAgenteOpenAI(config, contato, primeiraConversa);
    const final = resposta || "Desculpa, me enrolei aqui. Pode repetir?";
    await registrarSaida(contato, final, "agente", { ferramentas: chamadas, duracao_ms: Date.now() - inicio, cerebro: "openai" });
    await concluirEtapaDestino(contato);
    return { contato, resposta: final, ferramentas: chamadas };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro inesperado no agente.";
    await registrarErroAgente(contato.id, mensagem, Date.now() - inicio, "openai");
    return { contato, resposta: null, ferramentas: [], erro: mensagem };
  }
}

export async function processarMensagemRecebida(entrada: MensagemRecebida): Promise<ResultadoProcessamento | null> {
  const inicio = Date.now();
  const db = createAdminClient();
  const { config } = await carregarAgenteConfig();
  const { contato } = await obterContato(entrada.telefone, entrada.nome ?? null, Boolean(entrada.simulado));

  let texto = entrada.texto?.trim() ?? "";
  let audioSemTexto = false;
  if (!texto && entrada.audioLink) {
    texto = (await transcreverAudio(entrada.audioLink, entrada.audioCabecalhos)) ?? "";
    audioSemTexto = !texto;
  }

  const { data: recebida, error: erroEntrada } = await db
    .from("whatsapp_mensagens")
    .insert({
      contato_id: contato.id,
      externo_id: entrada.externoId ?? null,
      direcao: "entrada",
      autor: "usuario",
      tipo: entrada.tipo ?? "texto",
      texto: texto || `[${entrada.tipo ?? "mensagem"} sem texto]`,
    })
    .select("id")
    .single();
  if (erroEntrada?.code === "23505") return null;
  if (erroEntrada) throw new Error(erroEntrada.message);

  if (contato.bloqueado) return { contato, resposta: null, ferramentas: [], motivo: "Contato bloqueado." };
  if (contato.modo === "humano") return { contato, resposta: null, ferramentas: [], motivo: "Conversa assumida por humano." };
  if (!config.ativo && !contato.simulado) return { contato, resposta: null, ferramentas: [], motivo: "Agente desligado." };

  if (audioSemTexto) {
    await registrarSaida(contato, config.respostaAudio, "agente");
    return { contato, resposta: config.respostaAudio, ferramentas: [] };
  }
  if (!texto) return { contato, resposta: null, ferramentas: [], motivo: "Mensagem sem texto." };

  if (podeUsarClaude(config, contato.telefone, contato.simulado)) {
    const worker = await statusWorker();
    if (worker.online || !config.fallbackOpenAI) {
      await db.from("whatsapp_mensagens").update({ pendente: true }).eq("id", recebida.id);
      return {
        contato,
        resposta: null,
        ferramentas: [],
        pendente: true,
        motivo: worker.online ? undefined : "Worker do Claude offline: a mensagem ficou na fila até ele voltar.",
      };
    }
  }

  return responderComOpenAI(config, contato, await ehPrimeiraConversa(contato.id), inicio);
}
