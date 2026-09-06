import { authorizeUser, createAdminClient } from "@/lib/adminServer";

export async function POST(request) {
  const auth = await authorizeUser(request); if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  let corpo; try { corpo = await request.json(); } catch { return Response.json({ error: "Inscrição inválida." }, { status: 400 }); }
  const endpoint = corpo?.endpoint; const p256dh = corpo?.keys?.p256dh; const chaveAuth = corpo?.keys?.auth;
  if (!endpoint || !p256dh || !chaveAuth) return Response.json({ error: "Inscrição push incompleta." }, { status: 400 });
  const supabase = createAdminClient(); const { error } = await supabase.from("push_subscriptions").upsert({ user_id: auth.user.id, endpoint, p256dh, auth: chaveAuth, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
  if (error) return Response.json({ error: "Não foi possível salvar a inscrição push." }, { status: 500 });
  return Response.json({ ok: true });
}
