// Dispara agora as ofertas no grupo, fora dos horários fixos, e já envia pelo WhatsApp do Mac (WAHA).
// Nos horários normais quem faz isso é o worker (npm run agente).
import { createAdminClient } from "@/lib/adminServer";
import { dispararOfertasNoGrupo, grupoDasOfertas } from "@/lib/agente/disparoGrupo";
import { enviarTextoWaha, statusSessaoWaha, wahaConfigurado } from "@/lib/agente/waha";

async function main() {
  if (!wahaConfigurado()) throw new Error("WAHA não configurado (WAHA_URL/WAHA_API_KEY no .env.local).");
  const status = await statusSessaoWaha();
  if (status !== "WORKING") throw new Error(`WhatsApp do Mac não está conectado (status: ${status}). Rode npm run whatsapp.`);

  const resultado = await dispararOfertasNoGrupo(new Date(), { forcar: true });
  console.log(resultado.enviadas ? `${resultado.enviadas} ofertas na fila do grupo.` : resultado.motivo);

  const db = createAdminClient();
  const grupo = grupoDasOfertas();
  const { data } = await db
    .from("whatsapp_mensagens")
    .select("id, texto, whatsapp_contatos!inner(telefone)")
    .eq("aguardando_envio", true)
    .eq("whatsapp_contatos.telefone", grupo)
    .order("created_at");

  for (const [indice, mensagem] of (data ?? []).entries()) {
    if (indice) await new Promise((resolve) => setTimeout(resolve, 4_000));
    const envio = await enviarTextoWaha(grupo, mensagem.texto);
    await db
      .from("whatsapp_mensagens")
      .update({ aguardando_envio: false, erro: envio.ok ? null : envio.erro, externo_id: envio.ok && envio.id ? envio.id : null })
      .eq("id", mensagem.id);
    console.log(envio.ok ? `📤 ${indice + 1}/${data?.length} enviada` : `✗ ${indice + 1}: ${envio.erro}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
