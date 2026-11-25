import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { transcreverAudio as transcreverComOpenAI } from "@/lib/agente/whapi";

const executar = promisify(execFile);
const LIMITE_AUDIO_BYTES = 25 * 1024 * 1024;

const BINARIOS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

function achar(nome: string): string | null {
  for (const pasta of BINARIOS) {
    const caminho = path.join(pasta, nome);
    if (existsSync(caminho)) return caminho;
  }
  return null;
}

function modeloWhisper(): string | null {
  const candidatos = [process.env.WHISPER_MODELO, path.join(homedir(), ".vaiviajar", "whisper", "ggml-small.bin")];
  return candidatos.find((caminho): caminho is string => Boolean(caminho) && existsSync(caminho as string)) ?? null;
}

export function transcricaoLocalDisponivel(): boolean {
  return Boolean(achar("ffmpeg") && (achar("whisper-cli") || achar("whisper-cpp")) && modeloWhisper());
}

async function transcreverLocal(link: string, cabecalhos?: Record<string, string>): Promise<string | null> {
  const ffmpeg = achar("ffmpeg");
  const whisper = achar("whisper-cli") ?? achar("whisper-cpp");
  const modelo = modeloWhisper();
  if (!ffmpeg || !whisper || !modelo) return null;

  const resposta = await fetch(link, { headers: cabecalhos, signal: AbortSignal.timeout(30_000) });
  if (!resposta.ok) throw new Error(`Não consegui baixar o áudio (${resposta.status}).`);
  const bytes = Buffer.from(await resposta.arrayBuffer());
  if (!bytes.length || bytes.length > LIMITE_AUDIO_BYTES) return null;

  const pasta = await mkdtemp(path.join(tmpdir(), "vaiviajar-audio-"));
  try {
    const original = path.join(pasta, "original");
    const wav = path.join(pasta, "audio.wav");
    await writeFile(original, bytes);
    await executar(ffmpeg, ["-loglevel", "error", "-y", "-i", original, "-ar", "16000", "-ac", "1", wav], { timeout: 30_000 });
    const { stdout } = await executar(whisper, ["-m", modelo, "-l", "pt", "-nt", "-np", "-f", wav], {
      timeout: 120_000,
      maxBuffer: 5 * 1024 * 1024,
    });
    return stdout.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim() || null;
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

export async function transcreverAudio(link: string, cabecalhos?: Record<string, string>): Promise<string | null> {
  try {
    const local = await transcreverLocal(link, cabecalhos);
    if (local) return local;
  } catch (error) {
    console.error("[transcricao] falhou localmente:", error instanceof Error ? error.message : error);
  }
  return transcreverComOpenAI(link, cabecalhos);
}
