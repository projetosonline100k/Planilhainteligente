import { createAdminClient } from "@/lib/adminServer";
import { carregarAgenteConfig } from "@/lib/agente/config";
import { buscarOfertasConferidas } from "@/lib/agente/ferramentas";
import { registrarSaida } from "@/lib/agente/executar";
import { formatarOferta } from "@/lib/agente/ofertaTexto";
import { Contato } from "@/types/agente";


export async function enviarOfertasProativas() {
  const { config } = await carregarAgenteConfig();
  if (!config.ofertasProativas) return { enviadas: 0, contatos: 0, motivo: "Ofertas proativas desligadas." };
  if (!config.ativo) return { enviadas: 0, contatos: 0, motivo: "Agente desligado." };

  const db = createAdminClient();
  const { data: viagens } = await db
    .from("whatsapp_viagens")
    .select("contato_id, destino, whatsapp_contatos!inner(*)")
    .eq("seguir_ofertas", true)
    .eq("whatsapp_contatos.bloqueado", false);

  const porContato = new Map<string, { contato: Contato; destinos: string[] }>();
  for (const viagem of viagens ?? []) {
    const contato = viagem.whatsapp_contatos as unknown as Contato;
    const atual = porContato.get(contato.id) ?? { contato, destinos: [] };
    atual.destinos.push(viagem.destino);
    porContato.set(contato.id, atual);
  }

  const inicioDoDia = new Date();
  inicioDoDia.setUTCHours(3, 0, 0, 0);
  if (inicioDoDia > new Date()) inicioDoDia.setUTCDate(inicioDoDia.getUTCDate() - 1);

  let enviadas = 0;
  const detalhes: Array<{ telefone: string; destino: string; preco: number }> = [];

  for (const { contato, destinos } of porContato.values()) {
    const { data: jaEnviadas } = await db.from("whatsapp_envios_ofertas").select("offer_id, created_at").eq("contato_id", contato.id);
    const enviadasHoje = (jaEnviadas ?? []).filter((envio) => new Date(envio.created_at) >= inicioDoDia).length;
    let restante = config.maxOfertasPorDia - enviadasHoje;
    if (restante <= 0) continue;

    const ignorar = new Set((jaEnviadas ?? []).map((envio) => envio.offer_id));
    for (const destino of destinos) {
      if (restante <= 0) break;
      const { ofertas } = await buscarOfertasConferidas(
        { destino, descontoMinimo: config.descontoMinimo, excluirIds: [...ignorar] },
        1,
        config.descontoMinimo
      );
      const oferta = ofertas[0];
      if (!oferta) continue;

      const { error } = await db.from("whatsapp_envios_ofertas").insert({ contato_id: contato.id, offer_id: oferta.id });
      if (error) continue;
      await registrarSaida(contato, formatarOferta(oferta, { linkCurto: oferta.linkCurto }), "agente", { tipo: "oferta" });
      ignorar.add(oferta.id);
      restante -= 1;
      enviadas += 1;
      detalhes.push({ telefone: contato.telefone, destino: oferta.destination_name, preco: Number(oferta.price) });
    }
  }

  return { enviadas, contatos: porContato.size, detalhes };
}
