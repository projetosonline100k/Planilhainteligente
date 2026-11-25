import { createAdminClient } from "@/lib/adminServer";
import { urlBaseLinks } from "@/lib/agente/ofertaTexto";
import { DESCONTO_MINIMO_GRUPO, escolherLote, horarioDeDisparo, mensagemDoGrupo, type OfertaGrupo } from "@/lib/agente/grupoOfertas";

const ULTIMO_DISPARO_KEY = "grupo_ofertas_ultimo_disparo";
const JANELA_OFERTAS_DIAS = 7;

export function grupoDasOfertas(): string {
  return process.env.WHATSAPP_GRUPO_OFERTAS || "120363428365437050@g.us";
}

async function contatoDoGrupo(db: ReturnType<typeof createAdminClient>): Promise<string> {
  const telefone = grupoDasOfertas();
  const { data: existente } = await db.from("whatsapp_contatos").select("id").eq("telefone", telefone).maybeSingle();
  if (existente) return existente.id;
  const { data, error } = await db
    .from("whatsapp_contatos")
    .insert({ telefone, nome: "Grupo de ofertas", modo: "humano" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Não consegui cadastrar o grupo: ${error?.message ?? "sem retorno"}`);
  return data.id;
}

// Coloca na fila do worker as ofertas deste horário. Cada horário (dia + hora) só dispara uma vez.
export async function dispararOfertasNoGrupo(agora = new Date(), opcoes: { forcar?: boolean } = {}) {
  const horario = horarioDeDisparo(agora);
  if (!horario && !opcoes.forcar) return { enviadas: 0, motivo: "Fora dos horários do grupo." };
  const chave = horario?.chave ?? `manual-${agora.toISOString()}`;

  const db = createAdminClient();
  const { data: ultimo } = await db.from("app_settings").select("value").eq("key", ULTIMO_DISPARO_KEY).maybeSingle();
  if (!opcoes.forcar && ultimo?.value === chave) return { enviadas: 0, motivo: "Horário já disparado." };
  await db.from("app_settings").upsert({ key: ULTIMO_DISPARO_KEY, value: chave, updated_at: agora.toISOString() }, { onConflict: "key" });

  const contatoId = await contatoDoGrupo(db);
  const hoje = new Date(agora.getTime() - 3 * 60 * 60_000).toISOString().slice(0, 10);
  const desde = new Date(agora.getTime() - JANELA_OFERTAS_DIAS * 24 * 60 * 60_000).toISOString();

  const [{ data: ofertas, error }, { data: jaEnviadas }] = await Promise.all([
    db
      .from("flight_offers")
      .select("id, origin_name, destination_name, destination_code, price, typical_price, savings_percentage, savings_amount, outbound_date, return_date")
      .eq("status", "active")
      .gte("savings_percentage", DESCONTO_MINIMO_GRUPO)
      .gte("outbound_date", hoje)
      .gte("created_at", desde)
      .order("savings_percentage", { ascending: false })
      .limit(300),
    db.from("whatsapp_envios_ofertas").select("offer_id").eq("contato_id", contatoId),
  ]);
  if (error) throw new Error(`Não consegui ler as ofertas: ${error.message}`);

  const enviadas = new Set((jaEnviadas ?? []).map((envio) => envio.offer_id));
  const lote = escolherLote(((ofertas ?? []) as OfertaGrupo[]).filter((oferta) => !enviadas.has(oferta.id)));
  if (!lote.length) return { enviadas: 0, motivo: "Nenhuma oferta nova para o grupo." };

  const base = urlBaseLinks();
  const { error: erroEnvios } = await db.from("whatsapp_envios_ofertas").insert(lote.map((oferta) => ({ contato_id: contatoId, offer_id: oferta.id })));
  if (erroEnvios) throw new Error(`Não consegui registrar os envios: ${erroEnvios.message}`);
  const { error: erroFila } = await db.from("whatsapp_mensagens").insert(
    lote.map((oferta) => ({
      contato_id: contatoId,
      direcao: "saida",
      autor: "sistema",
      tipo: "oferta",
      texto: mensagemDoGrupo(oferta, base),
      aguardando_envio: true,
    }))
  );
  if (erroFila) throw new Error(`Não consegui colocar as mensagens na fila: ${erroFila.message}`);

  return { enviadas: lote.length, motivo: `Horário ${chave}.` };
}
