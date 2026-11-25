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
  link_voo?: string | null;
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

// Prefere o link do voo mais barato já conferido; sem ele, usa o link da oferta do radar.
export function linkDaOferta(oferta: Pick<OfertaParaTexto, "id" | "booking_url" | "link_voo">, linkCurto = false): string {
  const direto = oferta.link_voo?.trim() || oferta.booking_url?.trim();
  if (linkCurto && direto) return `${urlBaseLinks()}/r/${codigoCurto(oferta.id)}`;
  return direto || `${urlBaseLinks()}/o/${oferta.id.replace(/-/g, "").toLowerCase()}`;
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

export type CartaoBusca = {
  origem: string;
  destino: string;
  ida: string;
  volta: string | null;
  preco: number;
  nivel: "low" | "typical" | "high" | null;
  faixa: [number, number] | null;
  voo: string | null;
  link: string;
};

function avaliacao(nivel: CartaoBusca["nivel"], faixa: CartaoBusca["faixa"]): string | null {
  if (!nivel || !faixa) return null;
  const normal = `${reais(faixa[0])} a ${reais(faixa[1])}`;
  if (nivel === "low") return `📉 Preço baixo pra essa rota (o normal é ${normal})`;
  if (nivel === "high") return `⚠️ Preço acima do normal pra essa rota (${normal})`;
  return `📊 Preço normal pra essa rota (${normal})`;
}

export function formatarCartaoBusca(cartao: CartaoBusca, opcoes: { cabecalho?: boolean } = {}): string {
  const linhas = [
    opcoes.cabecalho === false ? null : CABECALHO_OFERTA,
    `${cartao.origem} → ${cartao.destino}`,
    `📅 ${periodo(cartao.ida, cartao.volta)}`,
    `💰 ${reais(cartao.preco)} ${cartao.volta ? "ida e volta" : "só ida"}`,
    avaliacao(cartao.nivel, cartao.faixa),
    cartao.voo ? `🛫 ${cartao.voo}` : null,
    `🔗 Ver oferta`,
    cartao.link,
  ];
  return linhas.filter((linha): linha is string => linha !== null).join("\n");
}

export function formatarComparativo(companhias: Array<{ companhia: string; preco: number; escalas: number }>): string {
  if (companhias.length < 2) return "";
  const linhas = companhias.map((item) => `✈️ ${item.companhia}: ${reais(item.preco)}${item.escalas === 0 ? " (sem escalas)" : ""}`);
  return ["Comparei as companhias nessa data:", ...linhas].join("\n");
}
