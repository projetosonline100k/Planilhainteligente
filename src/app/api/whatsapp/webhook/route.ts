import { after } from "next/server";
import { processarMensagemRecebida } from "@/lib/agente/executar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type MensagemWhapi = {
  id?: string;
  from_me?: boolean;
  type?: string;
  chat_id?: string;
  from?: string;
  from_name?: string;
  text?: { body?: string };
  voice?: { link?: string };
  audio?: { link?: string };
  image?: { caption?: string };
};

function autorizado(request: Request): boolean {
  const segredo = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!segredo) return false;
  return new URL(request.url).searchParams.get("secret") === segredo;
}

export async function POST(request: Request) {
  if (!autorizado(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { messages?: MensagemWhapi[] } | null;
  const mensagens = (body?.messages ?? []).filter(
    (mensagem) => !mensagem.from_me && mensagem.chat_id?.endsWith("@s.whatsapp.net")
  );

  after(async () => {
    for (const mensagem of mensagens) {
      const telefone = (mensagem.from ?? mensagem.chat_id ?? "").split("@")[0];
      if (!telefone) continue;
      try {
        await processarMensagemRecebida({
          telefone,
          nome: mensagem.from_name ?? null,
          texto: mensagem.text?.body ?? mensagem.image?.caption ?? null,
          tipo: mensagem.type === "voice" || mensagem.type === "audio" ? "audio" : mensagem.type === "text" ? "texto" : mensagem.type,
          audioLink: mensagem.voice?.link ?? mensagem.audio?.link ?? null,
          externoId: mensagem.id ?? null,
        });
      } catch (error) {
        console.error("[whatsapp-webhook]", error);
      }
    }
  });

  return Response.json({ recebidas: mensagens.length });
}
