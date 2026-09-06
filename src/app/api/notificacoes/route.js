import { authorizeUser, createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await authorizeUser(request); if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await createAdminClient().from("notificacoes").select("id,titulo,mensagem,link,lida,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return Response.json({ error: "Não foi possível carregar as notificações." }, { status: 500 });
  return Response.json({ notificacoes: data, naoLidas: data.filter((item) => !item.lida).length });
}

export async function PATCH(request) {
  const auth = await authorizeUser(request); if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  let corpo; try { corpo = await request.json(); } catch { return Response.json({ error: "Dados inválidos." }, { status: 400 }); }
  let consulta = createAdminClient().from("notificacoes").update({ lida: true }).eq("user_id", auth.user.id);
  consulta = corpo?.id ? consulta.eq("id", corpo.id) : consulta.eq("lida", false);
  const { error } = await consulta; if (error) return Response.json({ error: "Não foi possível marcar a notificação como lida." }, { status: 500 });
  return Response.json({ ok: true });
}
