import { createAdminClient } from "@/lib/adminServer";
import { escolherMaisBarato, VooBasico } from "@/lib/agente/verificacaoRegras";

const SERPAPI_URL = "https://serpapi.com/search.json";
const VALIDADE_MS = 12 * 60 * 60_000;
const PAUSA_SEM_COTA_MS = 10 * 60_000;

export type Trecho = { airline?: string; flight_number?: string; departure_airport?: { time?: string }; arrival_airport?: { time?: string } };
export type Voo = Omit<VooBasico, "flights"> & { flights?: Trecho[]; departure_token?: string; booking_token?: string };
export type Resposta = {
  error?: string;
  price_insights?: { lowest_price?: number; price_level?: string; typical_price_range?: number[] };
  best_flights?: Voo[];
  other_flights?: Voo[];
  search_metadata?: { google_flights_url?: string };
};

export type OfertaVerificavel = {
  id: string;
  origin_code: string | null;
  destination_code: string | null;
  outbound_date: string;
  return_date: string | null;
};

export type Verificacao = { preco_real: number | null; link_voo: string | null; voo: string | null; do_cache: boolean };
export type ResultadoVerificacao = { ok: true; verificacao: Verificacao } | { ok: false; motivo: string };

let semCotaAte = 0;

export async function consultar(parametros: Record<string, string>): Promise<Resposta> {
  const url = new URL(SERPAPI_URL);
  url.search = new URLSearchParams({ ...parametros, api_key: process.env.SERPAPI_KEY ?? "" }).toString();
  const resposta = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(40_000) });
  const dados = (await resposta.json().catch(() => ({}))) as Resposta;
  if (!resposta.ok || dados.error) {
    const erro = dados.error ?? `SerpApi respondeu ${resposta.status}.`;
    if (resposta.status === 429 || /run out of searches|searches left|limit/i.test(erro)) semCotaAte = Date.now() + PAUSA_SEM_COTA_MS;
    throw new Error(erro);
  }
  return dados;
}

export function todos(resposta: Resposta): Voo[] {
  return [...(resposta.best_flights ?? []), ...(resposta.other_flights ?? [])];
}

export function descrever(voo: Voo): string | null {
  const primeiro = voo.flights?.[0];
  const ultimo = voo.flights?.[voo.flights.length - 1];
  if (!primeiro) return null;
  const hora = (texto?: string) => texto?.split(" ")[1] ?? "";
  const escalas = (voo.flights?.length ?? 1) - 1;
  return `${primeiro.airline ?? ""} ${primeiro.flight_number ?? ""} · ${hora(primeiro.departure_airport?.time)} → ${hora(ultimo?.arrival_airport?.time)} · ${escalas === 0 ? "sem escalas" : `${escalas} escala${escalas > 1 ? "s" : ""}`}`.trim();
}

// Descobre o voo mais barato de hoje e devolve o link do Google Voos já com esse voo selecionado.
async function buscarVooMaisBarato(oferta: OfertaVerificavel): Promise<Omit<Verificacao, "do_cache">> {
  const base: Record<string, string> = {
    engine: "google_flights",
    type: oferta.return_date ? "1" : "2",
    departure_id: oferta.origin_code ?? "",
    arrival_id: oferta.destination_code ?? "",
    outbound_date: oferta.outbound_date,
    ...(oferta.return_date ? { return_date: oferta.return_date } : {}),
    currency: "BRL",
    hl: "pt",
    gl: "br",
  };
  const semVoo = { preco_real: null, link_voo: null, voo: null };

  const ida = escolherMaisBarato(todos(await consultar({ ...base, sort_by: "2" })));
  if (!ida) return semVoo;

  let escolhido = ida;
  if (oferta.return_date) {
    if (!ida.departure_token) throw new Error("A busca não trouxe como escolher a volta.");
    const volta = escolherMaisBarato(todos(await consultar({ ...base, departure_token: ida.departure_token })));
    if (!volta) return semVoo;
    escolhido = volta;
  }
  if (!escolhido.booking_token) throw new Error("A busca não trouxe o link de reserva.");

  const reserva = await consultar({ ...base, booking_token: escolhido.booking_token });
  const link = reserva.search_metadata?.google_flights_url ?? null;
  return { preco_real: escolhido.price ?? null, link_voo: link, voo: descrever(ida) };
}

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

  if (!process.env.SERPAPI_KEY) return { ok: false, motivo: "SERPAPI_KEY não configurada." };
  if (!oferta.origin_code || !oferta.destination_code) return { ok: false, motivo: "Oferta sem aeroportos." };
  if (Date.now() < semCotaAte) return { ok: false, motivo: "Cota de buscas esgotada, tentando de novo em alguns minutos." };

  try {
    const resultado = await buscarVooMaisBarato(oferta);
    await db
      .from("flight_offer_verificacoes")
      .upsert({ offer_id: oferta.id, ...resultado, verificada_em: new Date().toISOString() }, { onConflict: "offer_id" });
    return { ok: true, verificacao: { ...resultado, do_cache: false } };
  } catch (error) {
    return { ok: false, motivo: error instanceof Error ? error.message : "Falha ao conferir o preço." };
  }
}
