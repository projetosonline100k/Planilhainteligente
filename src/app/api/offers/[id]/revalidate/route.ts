import { createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_WINDOW_MS = 10 * 60 * 1000;
const SEARCHAPI_URL = "https://www.searchapi.io/api/v1/search";

type OfferRow = {
  origin_code: string;
  destination_code: string;
  outbound_date: string | null;
  return_date: string | null;
  price: number;
  advertised_price: number;
  typical_price: number | null;
  savings_amount: number | null;
  savings_percentage: number | null;
  status: string;
  last_checked_at: string | null;
};

function unavailable() {
  return Response.json({ status: "unavailable_to_verify" }, { status: 503, headers });
}

function computeSavings(currentPrice: number, typicalPrice: number | null) {
  if (typeof typicalPrice !== "number" || typicalPrice <= 0) {
    return { savingsAmount: null, savingsPercentage: null };
  }
  const savingsAmount = Math.max(0, typicalPrice - currentPrice);
  const savingsPercentage = Math.round(((typicalPrice - currentPrice) / typicalPrice) * 100);
  return { savingsAmount, savingsPercentage };
}

async function fetchCurrentPrice(offer: OfferRow): Promise<number | null> {
  const apiKey = process.env.SEARCHAPI_KEY?.trim();
  if (!apiKey || !offer.outbound_date) return null;

  const query = new URL(SEARCHAPI_URL);
  query.search = new URLSearchParams({
    engine: "google_flights",
    flight_type: "round_trip",
    departure_id: offer.origin_code,
    arrival_id: offer.destination_code,
    outbound_date: offer.outbound_date,
    currency: "BRL",
    api_key: apiKey,
    ...(offer.return_date ? { return_date: offer.return_date } : {}),
  }).toString();

  const response = await fetch(query, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const body = await response.json();
  if (!response.ok || body.error) return null;

  const lowestPrice = body.price_insights?.lowest_price;
  return typeof lowestPrice === "number" && Number.isFinite(lowestPrice) && lowestPrice > 0 ? lowestPrice : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Oferta não encontrada." }, { status: 404, headers });

  try {
    const client = createAdminClient();
    const { data: offer, error: fetchError } = await client
      .from("flight_offers")
      .select("origin_code, destination_code, outbound_date, return_date, price, advertised_price, typical_price, savings_amount, savings_percentage, status, last_checked_at")
      .eq("id", id)
      .abortSignal(AbortSignal.timeout(10_000))
      .maybeSingle<OfferRow>();
    if (fetchError) throw fetchError;
    if (!offer) return Response.json({ error: "Oferta não encontrada." }, { status: 404, headers });

    if (offer.status === "expired") {
      return Response.json({ status: "expired" }, { headers });
    }

    if (offer.status === "active" && offer.last_checked_at) {
      const age = Date.now() - new Date(offer.last_checked_at).getTime();
      if (Number.isFinite(age) && age >= 0 && age < CACHE_WINDOW_MS) {
        return Response.json({
          status: "available",
          currentPrice: offer.price,
          typicalPrice: offer.typical_price,
          savingsAmount: offer.savings_amount,
          savingsPercentage: offer.savings_percentage,
          checkedAt: offer.last_checked_at,
        }, { headers });
      }
    }

    let currentPrice: number | null;
    try {
      currentPrice = await fetchCurrentPrice(offer);
    } catch {
      currentPrice = null;
    }
    if (currentPrice === null) return unavailable();

    const now = new Date().toISOString();
    const threshold = offer.advertised_price * 1.1;

    if (currentPrice > threshold) {
      const { error: updateError } = await client
        .from("flight_offers")
        .update({ status: "expired", last_checked_at: now })
        .eq("id", id);
      if (updateError) throw updateError;
      return Response.json({ status: "expired" }, { headers });
    }

    const { savingsAmount, savingsPercentage } = computeSavings(currentPrice, offer.typical_price);
    const { error: updateError } = await client
      .from("flight_offers")
      .update({
        price: currentPrice,
        savings_amount: savingsAmount,
        savings_percentage: savingsPercentage,
        last_checked_at: now,
        status: "active",
      })
      .eq("id", id);
    if (updateError) throw updateError;

    return Response.json({
      status: "available",
      currentPrice,
      typicalPrice: offer.typical_price,
      savingsAmount,
      savingsPercentage,
      checkedAt: now,
    }, { headers });
  } catch {
    return unavailable();
  }
}
