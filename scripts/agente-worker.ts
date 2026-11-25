import { createServer } from "node:http";
import { hostname } from "node:os";
import { createAdminClient } from "@/lib/adminServer";
import { rodarAgenteClaude } from "@/lib/agente/claudeAssinatura";
import { carregarAgenteConfig, registrarHeartbeat, WORKER_HEARTBEAT_KEY } from "@/lib/agente/config";
import {
  ehPrimeiraConversa,
  processarMensagemRecebida,
  registrarErroAgente,
  registrarSaida,
  responderComOpenAI,
} from "@/lib/agente/executar";
import { cabecalhosMidiaWaha, enviarTextoWaha, statusSessaoWaha, telefoneDoJid, wahaConfigurado } from "@/lib/agente/waha";
import { Contato } from "@/types/agente";

const INTERVALO_MS = 2_500;
const HEARTBEAT_MS = 30_000;
const TRAVADA_MS = 5 * 60_000;
const PORTA_WEBHOOK = Number(process.env.WAHA_WEBHOOK_PORT || 3110);

const db = createAdminClient();
let rodando = true;
let ultimoHeartbeat = 0;

function log(...partes: unknown[]) {
  const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
  console.log(`[${hora}]`, ...partes);
}

async function heartbeat() {
  if (Date.now() - ultimoHeartbeat < HEARTBEAT_MS) return;
  ultimoHeartbeat = Date.now();
  const { config } = await carregarAgenteConfig();
  const whatsapp = wahaConfigurado() ? await statusSessaoWaha() : null;
  const { error } = await registrarHeartbeat({ host: hostname(), modelo: config.modeloClaude, whatsapp });
  if (error) log("Falha ao registrar heartbeat:", error.message);
}

// ---------- Entrada: webhook do WAHA ----------

type MensagemWaha = {
  id?: string;
  from?: string;
  fromMe?: boolean;
  body?: string;
  hasMedia?: boolean;
  media?: { url?: string; mimetype?: string } | null;
  _data?: { notifyName?: string; pushName?: string; Info?: { PushName?: string } };
};

function chatDoId(id?: string): string | null {
  const partes = (id ?? "").split("_");
  return partes.length >= 3 && (partes[0] === "true" || partes[0] === "false") && partes[1].includes("@") ? partes[1] : null;
}

async function receberDoWaha(mensagem: MensagemWaha) {
  if (mensagem.fromMe) return;
  const jid = chatDoId(mensagem.id) ?? mensagem.from ?? "";
  if (!jid || jid.endsWith("@g.us") || jid.endsWith("@newsletter") || jid === "status@broadcast") return;

  const telefone = await telefoneDoJid(jid);
  const mime = mensagem.media?.mimetype ?? "";
  const ehAudio = mime.startsWith("audio/");
  const nome = mensagem._data?.notifyName ?? mensagem._data?.pushName ?? mensagem._data?.Info?.PushName ?? null;

  log(`📩 ${nome ?? telefone}: ${ehAudio ? "[áudio]" : (mensagem.body ?? "").slice(0, 60)}`);
  const resultado = await processarMensagemRecebida({
    telefone,
    nome,
    texto: mensagem.body ?? null,
    tipo: ehAudio ? "audio" : mensagem.hasMedia ? "midia" : "texto",
    audioLink: ehAudio ? mensagem.media?.url ?? null : null,
    audioCabecalhos: cabecalhosMidiaWaha(),
    externoId: mensagem.id ?? null,
  });
  if (resultado?.motivo) log(`   ${resultado.motivo}`);
  if (resultado?.resposta) log("   ← respondido (GPT)");
}

const PAGINA_QR = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conectar WhatsApp</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b141a;color:#e9edef;font-family:system-ui,sans-serif;text-align:center">
<main style="padding:24px"><h1 style="font-size:20px">Conectar o WhatsApp do agente</h1>
<p id="s" style="color:#8696a0">Carregando…</p>
<img id="q" alt="QR Code" style="width:280px;height:280px;background:#fff;border-radius:12px;padding:8px;display:none">
<p style="color:#8696a0;font-size:13px;max-width:320px">No celular do número do agente: WhatsApp → Aparelhos conectados → Conectar um aparelho.</p></main>
<script>
async function atualizar(){const r=await fetch('/qr/status');const {status}=await r.json();const s=document.getElementById('s'),q=document.getElementById('q');
if(status==='WORKING'){s.textContent='✅ Conectado! Pode fechar esta página.';q.style.display='none';return}
s.textContent=status==='SCAN_QR_CODE'?'Escaneie o QR Code (ele se atualiza sozinho)':'Status: '+status;
if(status==='SCAN_QR_CODE'){q.src='/qr/imagem?t='+Date.now();q.style.display='inline-block'}else{q.style.display='none'}
setTimeout(atualizar,4000)}atualizar();
</script></body></html>`;

async function servirQr(caminho: string, res: import("node:http").ServerResponse) {
  if (caminho === "/qr") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(PAGINA_QR);
  } else if (caminho === "/qr/status") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: await statusSessaoWaha() }));
  } else {
    const resposta = await fetch(`${process.env.WAHA_URL}/api/${process.env.WAHA_SESSION || "default"}/auth/qr`, {
      headers: { ...cabecalhosMidiaWaha(), Accept: "image/png" },
    });
    res.writeHead(resposta.ok ? 200 : 502, { "Content-Type": "image/png", "Cache-Control": "no-store" }).end(Buffer.from(await resposta.arrayBuffer()));
  }
}

function iniciarWebhook() {
  const segredo = process.env.WHATSAPP_WEBHOOK_SECRET;
  const servidor = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
    if (req.method === "GET" && local && url.pathname.startsWith("/qr")) {
      servirQr(url.pathname, res).catch(() => res.writeHead(502).end());
      return;
    }
    if (req.method !== "POST" || url.pathname !== "/webhook" || !segredo || url.searchParams.get("k") !== segredo) {
      res.writeHead(404).end();
      return;
    }
    let corpo = "";
    req.on("data", (parte) => (corpo += parte));
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
      try {
        const evento = JSON.parse(corpo) as { event?: string; payload?: MensagemWaha };
        if (evento.event === "message" && evento.payload) {
          receberDoWaha(evento.payload).catch((error) => log("Erro ao receber mensagem:", error instanceof Error ? error.message : error));
        }
      } catch {
        log("Webhook com corpo inválido.");
      }
    });
  });
  servidor.listen(PORTA_WEBHOOK, "0.0.0.0", () => log(`Recebendo mensagens do WAHA na porta ${PORTA_WEBHOOK}. QR Code: http://localhost:${PORTA_WEBHOOK}/qr`));
}

// ---------- Saída: mensagens que o painel/Vercel deixou na fila ----------

async function enviarFila() {
  if (!wahaConfigurado()) return;
  const { data } = await db
    .from("whatsapp_mensagens")
    .select("id, texto, whatsapp_contatos!inner(telefone)")
    .eq("aguardando_envio", true)
    .order("created_at")
    .limit(10);

  for (const mensagem of data ?? []) {
    const { telefone } = mensagem.whatsapp_contatos as unknown as { telefone: string };
    const envio = await enviarTextoWaha(telefone, mensagem.texto);
    await db
      .from("whatsapp_mensagens")
      .update({
        aguardando_envio: false,
        erro: envio.ok ? null : envio.erro,
        externo_id: envio.ok && envio.id ? envio.id : null,
      })
      .eq("id", mensagem.id);
    log(envio.ok ? `📤 enviada da fila para ${telefone}` : `✗ falha ao enviar para ${telefone}: ${envio.erro}`);
  }
}

// ---------- Cérebro Claude: mensagens pendentes ----------

async function liberarTravadas() {
  await db
    .from("whatsapp_mensagens")
    .update({ processando_em: null })
    .eq("pendente", true)
    .lt("processando_em", new Date(Date.now() - TRAVADA_MS).toISOString());
}

async function proximoContato(): Promise<{ contatoId: string; ids: string[] } | null> {
  const { data: pendentes } = await db
    .from("whatsapp_mensagens")
    .select("id, contato_id")
    .eq("pendente", true)
    .is("processando_em", null)
    .order("created_at")
    .limit(20);
  if (!pendentes?.length) return null;

  const contatoId = pendentes[0].contato_id;
  const ids = pendentes.filter((mensagem) => mensagem.contato_id === contatoId).map((mensagem) => mensagem.id);
  const { data: travadas } = await db
    .from("whatsapp_mensagens")
    .update({ processando_em: new Date().toISOString() })
    .in("id", ids)
    .is("processando_em", null)
    .select("id");
  if (!travadas?.length) return null;
  return { contatoId, ids: travadas.map((mensagem) => mensagem.id) };
}

async function concluir(ids: string[]) {
  await db.from("whatsapp_mensagens").update({ pendente: false, processando_em: null }).in("id", ids);
}

async function processar(contatoId: string, ids: string[]) {
  const inicio = Date.now();
  const { config } = await carregarAgenteConfig();
  const { data } = await db.from("whatsapp_contatos").select("*").eq("id", contatoId).single();
  const contato = data as Contato;

  if (contato.bloqueado || contato.modo === "humano") {
    await concluir(ids);
    return;
  }

  log(`🧠 ${contato.nome ?? contato.telefone}: ${ids.length} mensagem(ns) para o Claude`);
  const primeiraConversa = await ehPrimeiraConversa(contato.id);

  try {
    const { resposta, chamadas } = await rodarAgenteClaude(config, contato, primeiraConversa);
    const final = resposta || "Desculpa, me enrolei aqui. Pode repetir?";
    await registrarSaida(contato, final, "agente", {
      ferramentas: chamadas,
      duracao_ms: Date.now() - inicio,
      cerebro: config.modeloClaude,
    });
    log(`   ← respondido em ${((Date.now() - inicio) / 1000).toFixed(1)}s${chamadas.length ? ` (${chamadas.map((c) => c.nome).join(", ")})` : ""}`);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro inesperado no Claude.";
    log("✗ erro no Claude:", mensagem);
    await registrarErroAgente(contato.id, mensagem, Date.now() - inicio, config.modeloClaude);
    if (config.fallbackOpenAI) {
      log("   usando GPT como reserva");
      await responderComOpenAI(config, contato, primeiraConversa, inicio);
    }
  } finally {
    await concluir(ids);
  }
}

// ---------- Loop ----------

async function main() {
  const { config } = await carregarAgenteConfig();
  log(`Worker do agente ligado em ${hostname()} (Claude: ${config.modeloClaude}). Ctrl+C para parar.`);
  if (wahaConfigurado()) {
    iniciarWebhook();
    log(`WhatsApp (WAHA): ${await statusSessaoWaha()}`);
  } else {
    log("WAHA não configurado (WAHA_URL/WAHA_API_KEY): só processando o cérebro Claude.");
  }
  if (config.cerebro !== "claude_assinatura") {
    log("Cérebro no painel: GPT. As respostas saem pelo GPT; troque para \"Claude da assinatura\" na aba Fluxo para usar o Claude.");
  }
  await liberarTravadas();
  setInterval(() => void heartbeat().catch(() => {}), 15_000);

  while (rodando) {
    try {
      await heartbeat();
      await enviarFila();
      const proximo = await proximoContato();
      if (proximo) {
        await processar(proximo.contatoId, proximo.ids);
        continue;
      }
    } catch (error) {
      log("Erro no loop:", error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVALO_MS));
  }
}

async function desligar() {
  if (!rodando) process.exit(0);
  rodando = false;
  log("Desligando…");
  await db.from("app_settings").delete().eq("key", WORKER_HEARTBEAT_KEY);
  process.exit(0);
}

process.on("SIGINT", desligar);
process.on("SIGTERM", desligar);

void main();
