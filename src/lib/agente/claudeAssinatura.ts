import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { carregarHistorico, montarInstrucoes, RespostaAgente } from "@/lib/agente/executar";
import { DefinicaoFerramenta, definicoesAtivas, executarFerramenta } from "@/lib/agente/ferramentas";
import { regrasWebFetch } from "@/lib/agente/sitesConfiaveis";
import { AgenteConfig, ChamadaFerramenta, Contato } from "@/types/agente";

const SERVIDOR = "vaiviajar";
const PASTA_TRABALHO = path.join(tmpdir(), "vaiviajar-agente-claude");

type Propriedade = { type?: string; description?: string; enum?: string[] };

function esquemaZod(definicao: DefinicaoFerramenta): Record<string, z.ZodType> {
  const parametros = definicao.parameters as { properties?: Record<string, Propriedade>; required?: string[] };
  const obrigatorios = new Set(parametros.required ?? []);
  const forma: Record<string, z.ZodType> = {};

  for (const [nome, prop] of Object.entries(parametros.properties ?? {})) {
    let campo: z.ZodType = prop.enum
      ? z.enum(prop.enum as [string, ...string[]])
      : prop.type === "number"
        ? z.number()
        : z.string();
    if (prop.description) campo = campo.describe(prop.description);
    forma[nome] = obrigatorios.has(nome) ? campo : campo.optional();
  }
  return forma;
}

// Remove credenciais de API para o Claude Code usar o login da assinatura (ou CLAUDE_CODE_OAUTH_TOKEN).
function ambienteAssinatura(): Record<string, string | undefined> {
  const ambiente: Record<string, string | undefined> = { ...process.env };
  delete ambiente.ANTHROPIC_API_KEY;
  delete ambiente.ANTHROPIC_AUTH_TOKEN;
  delete ambiente.ANTHROPIC_BASE_URL;
  if (!ambiente.CLAUDE_CODE_OAUTH_TOKEN) delete ambiente.CLAUDE_CODE_OAUTH_TOKEN;
  return ambiente;
}

function transcrever(historico: Array<{ role: "user" | "assistant"; content: string }>): string {
  const linhas = historico.map((mensagem) => `${mensagem.role === "user" ? "PESSOA" : "VOCÊ"}: ${mensagem.content}`);
  return [
    "Conversa no WhatsApp até agora (a última linha é a mensagem que você precisa responder):",
    "",
    ...linhas,
    "",
    "Responda à última mensagem da PESSOA. Use as ferramentas quando precisar. Seu texto final será enviado exatamente como está no WhatsApp, então escreva só a mensagem, sem comentários sobre o que você fez.",
  ].join("\n");
}

export async function rodarAgenteClaude(config: AgenteConfig, contato: Contato, primeiraConversa: boolean): Promise<RespostaAgente> {
  mkdirSync(PASTA_TRABALHO, { recursive: true });

  const chamadas: ChamadaFerramenta[] = [];
  const definicoes = definicoesAtivas(config);
  const servidor = createSdkMcpServer({
    name: SERVIDOR,
    version: "1.0.0",
    tools: definicoes.map((definicao) =>
      tool(definicao.name, definicao.description, esquemaZod(definicao), async (args) => {
        const argumentos = args as Record<string, unknown>;
        let resultado: unknown;
        try {
          resultado = await executarFerramenta(definicao.name, argumentos, contato.id);
        } catch (error) {
          resultado = { erro: error instanceof Error ? error.message : "Falha na ferramenta." };
        }
        chamadas.push({ nome: definicao.name, argumentos, resultado });
        return { content: [{ type: "text", text: JSON.stringify(resultado) }] };
      })
    ),
  });

  const nativas = config.ferramentas.pesquisa_web ? ["WebSearch", "WebFetch"] : [];
  const liberadas = config.ferramentas.pesquisa_web ? ["WebSearch", ...regrasWebFetch()] : [];
  const limite = new AbortController();
  const prazo = setTimeout(() => limite.abort(), config.ferramentas.pesquisa_web ? 240_000 : 120_000);
  const instrucoes = await montarInstrucoes(config, contato, primeiraConversa);
  const historico = await carregarHistorico(contato.id, config.historico);

  const conversa = query({
    prompt: transcrever(historico),
    options: {
      systemPrompt: instrucoes,
      model: config.modeloClaude,
      maxTurns: config.ferramentas.pesquisa_web ? 14 : 8,
      abortController: limite,
      tools: nativas,
      mcpServers: { [SERVIDOR]: servidor },
      allowedTools: [...definicoes.map((definicao) => `mcp__${SERVIDOR}__${definicao.name}`), ...liberadas],
      permissionMode: "dontAsk",
      settingSources: [],
      cwd: PASTA_TRABALHO,
      env: ambienteAssinatura(),
    },
  });

  try {
    for await (const mensagem of conversa) {
      if (mensagem.type === "assistant") {
        const blocos = (mensagem.message?.content ?? []) as Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
        for (const bloco of blocos) {
          if (bloco.type === "tool_use" && (bloco.name === "WebSearch" || bloco.name === "WebFetch")) {
            chamadas.push({ nome: bloco.name, argumentos: bloco.input ?? {}, resultado: "pesquisa na internet" });
          }
        }
        continue;
      }
      if (mensagem.type !== "result") continue;
      if (mensagem.subtype === "success" && !mensagem.is_error) return { resposta: mensagem.result.trim(), chamadas };
      const detalhe =
        mensagem.subtype === "success" ? mensagem.result : mensagem.errors?.length ? mensagem.errors.join("; ") : mensagem.subtype;
      if (/authenticate|login|oauth|token/i.test(detalhe)) {
        throw new Error(`Login do Claude inválido. Rode "claude setup-token" e coloque o token em CLAUDE_CODE_OAUTH_TOKEN no .env.local. (${detalhe})`);
      }
      throw new Error(`Claude não respondeu: ${detalhe}`);
    }
  } catch (error) {
    if (limite.signal.aborted) throw new Error("A pesquisa demorou demais e foi interrompida.");
    throw error;
  } finally {
    clearTimeout(prazo);
  }

  throw new Error("Claude encerrou sem resposta.");
}
