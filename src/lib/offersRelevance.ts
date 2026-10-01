import type { OfferSummary } from "@/lib/offers";

export type RotaParaMatch = {
  origin_code: string | null;
  origin_name: string;
  destination_code: string | null;
  destination_name: string;
};

type LocalCampo = { code: string | null; name: string };

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase().trim();
}

function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

function correspondeLocal(campo: LocalCampo, alvo: LocalCampo): boolean {
  if (campo.code && alvo.code) return normalizarCodigo(campo.code) === normalizarCodigo(alvo.code);
  return normalizarTexto(campo.name) === normalizarTexto(alvo.name);
}

export function ofertaCombinaComRota(offer: OfferSummary, rota: RotaParaMatch): boolean {
  const origemBate = correspondeLocal(
    { code: offer.origin_code, name: offer.origin_name },
    { code: rota.origin_code, name: rota.origin_name },
  );
  const destinoBate = correspondeLocal(
    { code: offer.destination_code, name: offer.destination_name },
    { code: rota.destination_code, name: rota.destination_name },
  );
  return origemBate && destinoBate;
}

export function ofertasDaRota(offers: OfferSummary[], rota: RotaParaMatch): OfferSummary[] {
  return offers.filter((offer) => ofertaCombinaComRota(offer, rota));
}

export function ofertaCombinaComAlgumaRota(offer: OfferSummary, rotas: RotaParaMatch[]): boolean {
  return rotas.some((rota) => ofertaCombinaComRota(offer, rota));
}

export function ordenarPorRotas(offers: OfferSummary[], rotas: RotaParaMatch[]): OfferSummary[] {
  return [...offers].sort((a, b) => {
    const tierA = ofertaCombinaComAlgumaRota(a, rotas) ? 0 : 1;
    const tierB = ofertaCombinaComAlgumaRota(b, rotas) ? 0 : 1;
    if (tierA !== tierB) return tierA - tierB;
    return (b.savings_percentage ?? 0) - (a.savings_percentage ?? 0);
  });
}
