import { createAdminClient } from "@/lib/adminServer";
import { buscarPassagemAoVivo } from "@/lib/agente/buscaAoVivo";

const VALIDADE_MS = 12 * 60 * 60_000;

export type OfertaVerificavel = {
  id: string;
  origin_code: string | null;
  destination_code: string | null;
  outbound_date: string;
  return_date: string | null;
};

export type Verificacao = { preco_real: number | null; link_voo: string | null; voo: string | null; do_cache: boolean };
export type ResultadoVerificacao = { ok: true; verificacao: Verificacao } | { ok: false; motivo: string };

// Confere o preço de hoje de uma oferta do radar pesquisando no Google Voos, e guarda o resultado por 12h.
export async function verificarOferta(oferta: OfertaVerificavel): Promise<ResultadoVerificacao> {
  const db = createAdminClient();
  const { data: guardada } = await db.from("flight_offer_verificacoes").select("*").eq("offer_id", oferta.id).maybeSingle();
  if (guardada && Date.now() - new Date(guardada.verificada_em).getTime() < VALIDADE_MS) {
    return {
      ok: true,
      verificacao: {
        preco_real: guardada.preco_real === null ? null : Number(guardada.preco_real),
        link_voo: guardada.link_voo,
        voo: guardada.voo,
        do_cache: true,
      },
    };
  }

  if (!oferta.origin_code || !oferta.destination_code) return { ok: false, motivo: "Oferta sem aeroportos." };

  const resposta = await buscarPassagemAoVivo({
    origem: oferta.origin_code,
    destino: oferta.destination_code,
    ida: oferta.outbound_date,
    volta: oferta.return_date,
  });
  if (!resposta.ok) return { ok: false, motivo: resposta.motivo };

  const melhor = resposta.resultado.melhor;
  const resultado = melhor ? { preco_real: melhor.preco, link_voo: melhor.link, voo: melhor.voo_ida } : { preco_real: null, link_voo: null, voo: null };
  await db.from("flight_offer_verificacoes").upsert({ offer_id: oferta.id, ...resultado, verificada_em: new Date().toISOString() }, { onConflict: "offer_id" });
  return { ok: true, verificacao: { ...resultado, do_cache: false } };
}
