import type { OfferSummary } from "@/lib/offers";

export type OrdemOfertas = "relevantes" | "desconto" | "preco";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase().trim();
}

export function filtrarOrdenarOfertas(
  offers: OfferSummary[],
  { origem, destino, ordem }: { origem: string; destino: string; ordem: OrdemOfertas },
): OfferSummary[] {
  const termoOrigem = normalizar(origem);
  const termoDestino = normalizar(destino);

  const filtradas = offers.filter((offer) => {
    const combinaOrigem = !termoOrigem || normalizar(`${offer.origin_name} ${offer.origin_code}`).includes(termoOrigem);
    const combinaDestino = !termoDestino || normalizar(`${offer.destination_name} ${offer.destination_code}`).includes(termoDestino);
    return combinaOrigem && combinaDestino;
  });

  const ordenadas = [...filtradas];
  if (ordem === "desconto") {
    ordenadas.sort((a, b) => (b.savings_percentage ?? 0) - (a.savings_percentage ?? 0));
  } else if (ordem === "preco") {
    ordenadas.sort((a, b) => a.price - b.price);
  }

  return ordenadas;
}
