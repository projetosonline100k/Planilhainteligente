import { authorizeAdmin, createAdminClient } from "@/lib/adminServer";
import { registrarSaida } from "@/lib/agente/executar";
import { Contato } from "@/types/agente";

export const dynamic = "force-dynamic";

async function carregarConversa(contatoId: string) {
  const db = createAdminClient();
  const [contato, mensagens, viagens] = await Promise.all([
    db.from("whatsapp_contatos").select("*").eq("id", contatoId).maybeSingle(),
    db.from("whatsapp_mensagens").select("*").eq("contato_id", contatoId).order("created_at", { ascending: false }).limit(200),
    db.from("whatsapp_viagens").select("*").eq("contato_id", contatoId).order("created_at"),
  ]);
  if (!contato.data) return null;
  return { contato: contato.data, mensagens: (mensagens.data ?? []).reverse(), viagens: viagens.data ?? [] };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

  const contatoId = new URL(request.url).searchParams.get("contato");
  if (!contatoId) return Response.json({ error: "Informe o contato." }, { status: 400 });
  const conversa = await carregarConversa(contatoId);
  if (!conversa) return Response.json({ error: "Contato não encontrado." }, { status: 404 });
  return Response.json(conversa);
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

  const body = (await request.json().catch(() => null)) as {
    contatoId?: string;
    acao?: "enviar" | "modo" | "bloqueio";
    texto?: string;
    modo?: "agente" | "humano";
    bloqueado?: boolean;
  } | null;
  if (!body?.contatoId) return Response.json({ error: "Informe o contato." }, { status: 400 });

  const db = createAdminClient();
  const { data: contato } = await db.from("whatsapp_contatos").select("*").eq("id", body.contatoId).maybeSingle();
  if (!contato) return Response.json({ error: "Contato não encontrado." }, { status: 404 });

  if (body.acao === "enviar") {
    const texto = body.texto?.trim();
    if (!texto) return Response.json({ error: "Escreva a mensagem." }, { status: 400 });
    const mensagem = await registrarSaida(contato as Contato, texto, "humano");
    if (mensagem?.erro) return Response.json({ error: `Mensagem salva, mas não enviada: ${mensagem.erro}` }, { status: 502 });
  } else if (body.acao === "modo" && (body.modo === "agente" || body.modo === "humano")) {
    await db.from("whatsapp_contatos").update({ modo: body.modo }).eq("id", contato.id);
  } else if (body.acao === "bloqueio" && typeof body.bloqueado === "boolean") {
    await db.from("whatsapp_contatos").update({ bloqueado: body.bloqueado }).eq("id", contato.id);
  } else {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }

  return Response.json(await carregarConversa(contato.id));
}
