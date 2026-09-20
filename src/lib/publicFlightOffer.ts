import "server-only";
import { createClient } from "@supabase/supabase-js";

export type PublicFlightOffer = {
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
};

export async function getPublicFlightOffer(id: string): Promise<PublicFlightOffer | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Consulta de oferta indisponível.");

  // A consulta é sempre anônima, sem sessão compartilhada ou credencial administrativa.
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client
    .rpc("get_public_flight_offer", { offer_id: id })
    .abortSignal(AbortSignal.timeout(15_000));
  if (error) throw new Error("Consulta de oferta indisponível.");

  const offer = (Array.isArray(data) ? data[0] : data) as PublicFlightOffer | null;
  if (!offer) return null;

  // Lista explícita: somente os campos públicos fazem parte do resultado utilizado pela página.
  return {
    id: offer.id,
    origin_code: offer.origin_code,
    origin_name: offer.origin_name,
    destination_code: offer.destination_code,
    destination_name: offer.destination_name,
    price: offer.price,
    typical_price: offer.typical_price,
    savings_percentage: offer.savings_percentage,
    savings_amount: offer.savings_amount,
    outbound_date: offer.outbound_date,
    return_date: offer.return_date,
    image_url: offer.image_url,
    status: offer.status,
    last_checked_at: offer.last_checked_at,
  };
}
