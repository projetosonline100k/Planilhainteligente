import { authorizeUser, createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await createAdminClient().from("alertas_preco").select("id,origin,destination,outbound_date,return_date,adults,preco_alvo,ativo,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Não foi possível carregar seus alertas." }, { status: 500 });
  return Response.json({ alertas: data ?? [] });
}

export async function DELETE(request) {
  const auth = await authorizeUser(request);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url); let id = url.searchParams.get("id");
  if (!id) { try { id = (await request.json())?.id; } catch { /* query string também é aceita */ } }
  if (!id) return Response.json({ error: "Informe o alerta que deseja remover." }, { status: 400 });
  const { error } = await createAdminClient().from("alertas_preco").delete().eq("id", id).eq("user_id", auth.user.id);
  if (error) return Response.json({ error: "Não foi possível remover o alerta." }, { status: 500 });
  return Response.json({ ok: true });
}
