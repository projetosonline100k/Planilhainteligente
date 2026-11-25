const SESSAO = process.env.WAHA_SESSION || "default";

export function wahaConfigurado(): boolean {
  return Boolean(process.env.WAHA_URL && process.env.WAHA_API_KEY);
}

async function pedirWaha<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const response = await fetch(`${process.env.WAHA_URL}${caminho}`, {
    method: metodo,
    headers: { "X-Api-Key": process.env.WAHA_API_KEY ?? "", ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const texto = await response.text();
  if (!response.ok) throw new Error(`WAHA respondeu ${response.status}: ${texto.slice(0, 200)}`);
  return (texto ? JSON.parse(texto) : {}) as T;
}

export function chatIdDoTelefone(telefone: string): string {
  return telefone.includes("@") ? telefone : `${telefone}@c.us`;
}

export async function enviarTextoWaha(telefone: string, texto: string): Promise<{ ok: true; id?: string } | { ok: false; erro: string }> {
  try {
    const body = await pedirWaha<{ id?: string | { _serialized?: string } }>("POST", "/api/sendText", {
      session: SESSAO,
      chatId: chatIdDoTelefone(telefone),
      text: texto,
    });
    const id = typeof body.id === "string" ? body.id : body.id?._serialized;
    return { ok: true, id };
  } catch (error) {
    return { ok: false, erro: error instanceof Error ? error.message : "Falha ao enviar pelo WAHA." };
  }
}

const telefonesDeLid = new Map<string, string>();

// O WhatsApp às vezes manda um código interno (9093...@lid) no lugar do telefone.
export async function telefoneDoJid(jid: string): Promise<string> {
  if (!jid.endsWith("@lid")) return jid.split("@")[0];
  const conhecido = telefonesDeLid.get(jid);
  if (conhecido) return conhecido;
  try {
    const body = await pedirWaha<{ pn?: string }>("GET", `/api/${SESSAO}/lids/${encodeURIComponent(jid)}`);
    if (body.pn) {
      const telefone = body.pn.split("@")[0];
      telefonesDeLid.set(jid, telefone);
      return telefone;
    }
  } catch {}
  return jid;
}

export async function statusSessaoWaha(): Promise<string> {
  try {
    const body = await pedirWaha<{ status?: string; me?: { id?: string } }>("GET", `/api/sessions/${SESSAO}`);
    return body.status ?? "DESCONHECIDO";
  } catch {
    return "WAHA_DESLIGADO";
  }
}

export function cabecalhosMidiaWaha(): Record<string, string> {
  return { "X-Api-Key": process.env.WAHA_API_KEY ?? "" };
}
