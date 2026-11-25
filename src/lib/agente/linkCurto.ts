import { urlBaseLinks } from "@/lib/agente/ofertaTexto";

const VALIDADE_OK_MS = 10 * 60_000;
const VALIDADE_FALHA_MS = 60_000;

let ultimo: { ok: boolean; ate: number } | null = null;

// O link curto só é usado se a rota /r/ já estiver publicada no endereço do app. Senão, vai o link direto comprido.
export async function linkCurtoDisponivel(): Promise<boolean> {
  if (ultimo && ultimo.ate > Date.now()) return ultimo.ok;
  let ok = false;
  try {
    const resposta = await fetch(`${urlBaseLinks()}/r/ping`, { redirect: "follow", signal: AbortSignal.timeout(5_000) });
    const corpo = (await resposta.json().catch(() => null)) as { ok?: boolean } | null;
    ok = resposta.ok && corpo?.ok === true;
  } catch {}
  ultimo = { ok, ate: Date.now() + (ok ? VALIDADE_OK_MS : VALIDADE_FALHA_MS) };
  return ok;
}
