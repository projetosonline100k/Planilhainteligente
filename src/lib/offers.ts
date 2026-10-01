export type OfferSummary = {
  id: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  price: number;
  typical_price: number | null;
  savings_percentage: number | null;
  savings_amount: number | null;
  outbound_date: string | null;
  return_date: string | null;
  image_url: string | null;
  status: string;
  last_checked_at: string | null;
  created_at: string;
};

export type OffersResult =
  | { state: "ready" | "empty"; offers: OfferSummary[] }
  | { state: "error" };

export function buildOfferPath(offerId: string): string {
  return `/oferta/${offerId}`;
}

export function sanitizeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export async function fetchOffers(fetchImpl: typeof fetch = fetch): Promise<OffersResult> {
  try {
    const response = await fetchImpl("/api/offers", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return { state: "error" };
    const body = await response.json().catch(() => null);
    if (!body || !Array.isArray(body.offers)) return { state: "error" };
    return { state: body.offers.length > 0 ? "ready" : "empty", offers: body.offers };
  } catch {
    return { state: "error" };
  }
}
