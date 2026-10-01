import { createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "public, max-age=30" };
const MAX_OFFERS = 50;
const SELECT_FIELDS = "id, origin_code, origin_name, destination_code, destination_name, price, typical_price, savings_percentage, savings_amount, outbound_date, return_date, image_url, status, last_checked_at, created_at";

type OfferRow = {
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

export async function GET() {
  try {
    const client = createAdminClient();
    const { data, error } = await client
      .from("flight_offers")
      .select(SELECT_FIELDS)
      .eq("status", "active")
      .order("savings_percentage", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(MAX_OFFERS)
      .abortSignal(AbortSignal.timeout(10_000));
    if (error) throw error;

    // Lista explícita: mesmo que a linha do banco traga colunas extras, somente estas fazem parte da resposta.
    const offers = ((data ?? []) as OfferRow[]).map((row) => ({
      id: row.id,
      origin_code: row.origin_code,
      origin_name: row.origin_name,
      destination_code: row.destination_code,
      destination_name: row.destination_name,
      price: row.price,
      typical_price: row.typical_price,
      savings_percentage: row.savings_percentage,
      savings_amount: row.savings_amount,
      outbound_date: row.outbound_date,
      return_date: row.return_date,
      image_url: row.image_url,
      status: row.status,
      last_checked_at: row.last_checked_at,
      created_at: row.created_at,
    }));

    return Response.json({ offers }, { headers });
  } catch {
    return Response.json({ error: "Não conseguimos carregar as oportunidades agora." }, { status: 503, headers });
  }
}
