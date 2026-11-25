const WHAPI_URL = "https://gate.whapi.cloud";

export function whapiConfigurado(): boolean {
  return Boolean(process.env.WHAPI_TOKEN);
}

export async function enviarTextoWhatsApp(telefone: string, texto: string): Promise<{ ok: true; id?: string } | { ok: false; erro: string }> {
  const token = process.env.WHAPI_TOKEN;
  if (!token) return { ok: false, erro: "WHAPI_TOKEN não configurado." };

  try {
    const response = await fetch(`${WHAPI_URL}/messages/text`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: telefone, body: texto }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => null)) as { message?: { id?: string }; error?: { message?: string } } | null;
    if (!response.ok) return { ok: false, erro: body?.error?.message ?? `WhApi respondeu ${response.status}.` };
    return { ok: true, id: body?.message?.id };
  } catch (error) {
    return { ok: false, erro: error instanceof Error ? error.message : "Falha ao enviar pelo WhApi." };
  }
}

export async function transcreverAudio(link: string, cabecalhos?: Record<string, string>): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !link) return null;

  try {
    const audio = await fetch(link, {
      headers: cabecalhos ?? (process.env.WHAPI_TOKEN ? { Authorization: `Bearer ${process.env.WHAPI_TOKEN}` } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    if (!audio.ok) return null;

    const form = new FormData();
    form.append("file", new Blob([await audio.arrayBuffer()], { type: "audio/ogg" }), "audio.ogg");
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { text?: string };
    return body.text?.trim() || null;
  } catch {
    return null;
  }
}
