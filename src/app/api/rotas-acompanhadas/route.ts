import { authorizeUser, createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

const NOME_MAXIMO = 80;
const CODIGO_MAXIMO = 10;

type RotaRow = {
  id: string;
  origin_code: string | null;
  origin_name: string;
  destination_code: string | null;
  destination_name: string;
  created_at: string;
};

type LocalValidado = { nome: string; codigo: string | null };

function validarLocal(valor: unknown, rotulo: string): LocalValidado | { error: string } {
  const dados = valor as { name?: unknown; code?: unknown } | null;
  const name = typeof dados?.name === "string" ? dados.name.trim() : "";
  if (!name || name.length > NOME_MAXIMO) {
    return { error: `Informe uma ${rotulo} valida (ate ${NOME_MAXIMO} caracteres).` };
  }

  const codeBruto = typeof dados?.code === "string" ? dados.code.trim() : "";
  if (codeBruto.length > CODIGO_MAXIMO) {
    return { error: `Codigo de ${rotulo} invalido.` };
  }

  return { nome: name, codigo: codeBruto || null };
}

function validarRota(body: unknown): { origem: LocalValidado; destino: LocalValidado } | { error: string } {
  const corpo = body as { origin?: unknown; destination?: unknown } | null;

  const origem = validarLocal(corpo?.origin, "origem");
  if ("error" in origem) return origem;

  const destino = validarLocal(corpo?.destination, "destino");
  if ("error" in destino) return destino;

  if (origem.nome.toLowerCase() === destino.nome.toLowerCase()) {
    return { error: "Origem e destino nao podem ser iguais." };
  }

  return { origem, destino };
}

export async function GET(request: Request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await createAdminClient()
    .from("rotas_acompanhadas")
    .select("id, origin_code, origin_name, destination_code, destination_name, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: "Nao foi possivel carregar suas passagens acompanhadas." }, { status: 500 });

  return Response.json({ rotas: (data ?? []) as RotaRow[] });
}

export async function POST(request: Request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const validado = validarRota(corpo);
  if ("error" in validado) return Response.json({ error: validado.error }, { status: 400 });

  const client = createAdminClient();

  const { data: existente, error: erroBusca } = await client
    .from("rotas_acompanhadas")
    .select("id, origin_code, origin_name, destination_code, destination_name, created_at")
    .eq("user_id", auth.user.id)
    .ilike("origin_name", validado.origem.nome)
    .ilike("destination_name", validado.destino.nome)
    .limit(1);

  if (erroBusca) return Response.json({ error: "Nao foi possivel cadastrar a rota." }, { status: 500 });
  if (existente?.[0]) return Response.json({ rota: existente[0] as RotaRow, jaExistia: true });

  const { data, error } = await client
    .from("rotas_acompanhadas")
    .insert({
      user_id: auth.user.id,
      origin_code: validado.origem.codigo,
      origin_name: validado.origem.nome,
      destination_code: validado.destino.codigo,
      destination_name: validado.destino.nome,
    })
    .select("id, origin_code, origin_name, destination_code, destination_name, created_at")
    .single();

  if (error) return Response.json({ error: "Nao foi possivel cadastrar a rota." }, { status: 500 });

  return Response.json({ rota: data as RotaRow, jaExistia: false }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const id = typeof (corpo as { id?: unknown } | null)?.id === "string" ? (corpo as { id: string }).id : "";
  if (!id) return Response.json({ error: "Informe a rota que deseja editar." }, { status: 400 });

  const validado = validarRota(corpo);
  if ("error" in validado) return Response.json({ error: validado.error }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("rotas_acompanhadas")
    .update({
      origin_code: validado.origem.codigo,
      origin_name: validado.origem.nome,
      destination_code: validado.destino.codigo,
      destination_name: validado.destino.nome,
    })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id, origin_code, origin_name, destination_code, destination_name, created_at")
    .single();

  if (error) return Response.json({ error: "Nao foi possivel atualizar a rota." }, { status: 500 });

  return Response.json({ rota: data as RotaRow });
}

export async function DELETE(request: Request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Informe a rota que deseja parar de acompanhar." }, { status: 400 });

  const { error } = await createAdminClient()
    .from("rotas_acompanhadas")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return Response.json({ error: "Nao foi possivel parar o acompanhamento." }, { status: 500 });

  return Response.json({ ok: true });
}
