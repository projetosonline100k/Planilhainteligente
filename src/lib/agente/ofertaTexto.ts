export type OfertaParaTexto = {
  id: string;
  origin_name: string;
  destination_name: string;
  price: number | string;
  typical_price?: number | string | null;
  savings_percentage?: number | null;
  outbound_date: string;
  return_date?: string | null;
  booking_url?: string | null;
};

export const CABECALHO_OFERTA = "Achei a melhor opção pra você ✈️";

export function urlBaseLinks(): string {
  return (process.env.LINK_BASE_URL || "https://vaiviajar.vercel.app").replace(/\/$/, "");
}

export function codigoCurto(id: string): string {
  return id.replace(/-/g, "").slice(0, 10).toLowerCase();
}

function reais(valor: number | string): string {
  return `R$ ${Math.round(Number(valor)).toLocaleString("pt-BR")}`;
}

function dia(data: string, comAno: boolean): string {
  const [ano, mes, diaDoMes] = data.split("-");
  return comAno ? `${diaDoMes}/${mes}/${ano}` : `${diaDoMes}/${mes}`;
}

export function periodo(ida: string, volta?: string | null): string {
  if (!volta) return dia(ida, true);
  const mesmoAno = ida.slice(0, 4) === volta.slice(0, 4);
  return `${dia(ida, !mesmoAno)} a ${dia(volta, true)}`;
}

export function linkDaOferta(oferta: Pick<OfertaParaTexto, "id" | "booking_url">, linkCurto = false): string {
  if (linkCurto && oferta.booking_url?.trim()) return `${urlBaseLinks()}/r/${codigoCurto(oferta.id)}`;
  return oferta.booking_url?.trim() || `${urlBaseLinks()}/o/${oferta.id.replace(/-/g, "").toLowerCase()}`;
}

export function formatarOferta(oferta: OfertaParaTexto, opcoes: { cabecalho?: boolean; linkCurto?: boolean } = {}): string {
  const preco = Number(oferta.price);
  const normal = Number(oferta.typical_price);
  const linhas = [
    opcoes.cabecalho === false ? null : CABECALHO_OFERTA,
    `${oferta.origin_name} → ${oferta.destination_name}`,
    `📅 ${periodo(oferta.outbound_date, oferta.return_date)}`,
    `💰 ${reais(preco)} ${oferta.return_date ? "ida e volta" : "só ida"}`,
    oferta.savings_percentage && normal > preco ? `📉 ${oferta.savings_percentage}% abaixo do preço normal (${reais(normal)})` : null,
    `🔗 Ver oferta`,
    linkDaOferta(oferta, opcoes.linkCurto),
  ];
  return linhas.filter((linha): linha is string => linha !== null).join("\n");
}
