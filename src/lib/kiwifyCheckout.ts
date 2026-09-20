export const PENDING_OFFER_ID_KEY = "vaiviajar_pending_offer_id";
export const PENDING_OFFER_PATH_KEY = "vaiviajar_pending_offer_path";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildKiwifyCheckoutUrl(baseUrl: string, offerId: string, email?: string | null): string {
  const url = new URL(baseUrl);
  url.searchParams.set("src", "vaiviajar");
  url.searchParams.set("s1", offerId);
  if (email) url.searchParams.set("email", email);
  return url.toString();
}

export function savePendingOffer(storage: Pick<Storage, "setItem">, offerId: string): void {
  storage.setItem(PENDING_OFFER_ID_KEY, offerId);
  storage.setItem(PENDING_OFFER_PATH_KEY, `/oferta/${offerId}`);
}

export function readPendingOfferPath(storage: Pick<Storage, "getItem">): string | null {
  const id = storage.getItem(PENDING_OFFER_ID_KEY);
  if (!id || !UUID.test(id)) return null;
  return storage.getItem(PENDING_OFFER_PATH_KEY) || `/oferta/${id}`;
}
