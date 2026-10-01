import type { OfferSummary } from "@/lib/offers";

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const FORMATO_DATA_CURTA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export function formatarPreco(valor: number): string {
  return FORMATO_MOEDA.format(valor);
}

export function formatarDataCurta(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : FORMATO_DATA_CURTA.format(date);
}

export function selecionarMelhoresOfertas(offers: OfferSummary[], limite = 5): OfferSummary[] {
  return offers.slice(0, limite);
}
