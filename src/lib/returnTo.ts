import { readPendingOfferPath } from "@/lib/kiwifyCheckout";

const OFFER_RETURN_PATH = /^\/oferta\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidReturnTo(value: string | null | undefined): value is string {
  return typeof value === "string" && OFFER_RETURN_PATH.test(value);
}

export function resolveReturnTo(
  getQueryParam: (key: string) => string | null,
  storage?: Pick<Storage, "getItem"> | null,
): string | null {
  const fromQuery = getQueryParam("returnTo");
  if (isValidReturnTo(fromQuery)) return fromQuery;

  if (!storage) return null;
  const pending = readPendingOfferPath(storage);
  return isValidReturnTo(pending) ? pending : null;
}
