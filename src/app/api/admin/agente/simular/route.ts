import { authorizeAdmin, createAdminClient } from "@/lib/adminServer";
import { processarMensagemRecebida } from "@/lib/agente/executar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TELEFONE_SIMULADOR = "simulador";

async function mensagensDoSimulador() {
  const db = createAdminClient();
  const { data: contato } = await db.from("whatsapp_contatos").select("id").eq("telefone", TELEFONE_SIMULADOR).maybeSingle();
  if (!contato) return { mensagens: [], viagens: [], pendente: false };
  const [mensagens, viagens] = await Promise.all([
    db.from("whatsapp_mensagens").select("*").eq("contato_id", contato.id).order("created_at"),
    db.from("whatsapp_viagens").select("*").eq("contato_id", contato.id).order("created_at"),
  ]);
  const lista = mensagens.data ?? [];
  return { mensagens: lista, viagens: viagens.data ?? [], pendente: lista.some((mensagem) => mensagem.pendente) };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });
  return Response.json(await mensagensDoSimulador());
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

  const body = (await request.json().catch(() => null)) as { texto?: string } | null;
  const texto = body?.texto?.trim();
  if (!texto) return Response.json({ error: "Escreva uma mensagem." }, { status: 400 });

  try {
    const resultado = await processarMensagemRecebida({ telefone: TELEFONE_SIMULADOR, nome: "Simulador", texto, simulado: true });
    return Response.json({ erro: resultado?.erro ?? null, motivo: resultado?.motivo ?? null, ...(await mensagensDoSimulador()) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });
  await createAdminClient().from("whatsapp_contatos").delete().eq("telefone", TELEFONE_SIMULADOR);
  return Response.json({ mensagens: [], viagens: [], pendente: false });
}
