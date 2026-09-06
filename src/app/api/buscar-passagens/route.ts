export const dynamic = "force-dynamic";

const TRAVELPAYOUTS_URL = "https://api.travelpayouts.com/v2/prices/latest";
const CODIGO_IATA = /^[A-Z]{3}$/;

type ResultadoTravelpayouts = {
  success?: boolean;
  error?: string | null;
  currency?: string;
  data?: Array<{ origin?: string; destination?: string; depart_date?: string; return_date?: string | null; value?: number; found_at?: string; actual?: boolean }>;
};

type Oferta = { id: string; origem: string; destino: string; preco: number; moeda: string; partida: string; volta: string | null; encontradaEm: string; link: string };

function criarLinkJetradar(origem: string, destino: string, partida: string, volta: string | null): string {
  const marker = process.env.TRAVELPAYOUTS_MARKER?.trim();
  if (!marker) throw new Error("Configure TRAVELPAYOUTS_MARKER para abrir as ofertas no Jetradar.");

  const url = new URL("https://search.jetradar.com/flights/");
  url.searchParams.set("origin_iata", origem);
  url.searchParams.set("destination_iata", destino);
  url.searchParams.set("depart_date", partida);
  if (volta) url.searchParams.set("return_date", volta);
  url.searchParams.set("adults", "1");
  url.searchParams.set("locale", "pt");
  url.searchParams.set("currency", "brl");
  url.searchParams.set("marker", marker);
  return url.toString();
}

export async function GET(request: Request) {
  const origem = new URL(request.url).searchParams.get("origem")?.trim().toUpperCase() || "GYN";
  if (!CODIGO_IATA.test(origem)) return Response.json({ error: "Informe um código IATA de origem com três letras, como GYN." }, { status: 400 });

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return Response.json({ error: "Configure TRAVELPAYOUTS_TOKEN no servidor para consultar as ofertas." }, { status: 503 });

  const url = new URL(TRAVELPAYOUTS_URL);
  url.search = new URLSearchParams({ origin: origem, currency: "brl", period_type: "year", sorting: "price", limit: "30", one_way: "false", show_to_affiliates: "false" }).toString();

  try {
    const resposta = await fetch(url, { headers: { "X-Access-Token": token, "Accept-Encoding": "gzip, deflate" }, cache: "no-store" });
    const conteudo = await resposta.text();
    let dados: ResultadoTravelpayouts;
    try { dados = JSON.parse(conteudo) as ResultadoTravelpayouts; } catch { dados = { error: conteudo || "Resposta inválida da Travelpayouts." }; }
    if (!resposta.ok || !dados.success) return Response.json({ error: dados.error || "A Travelpayouts não conseguiu retornar ofertas agora." }, { status: resposta.status || 502 });

    const ofertas: Oferta[] = (dados.data ?? [])
      .filter((oferta) => CODIGO_IATA.test(oferta.origin ?? "") && CODIGO_IATA.test(oferta.destination ?? "") && typeof oferta.value === "number" && Boolean(oferta.depart_date))
      .map((oferta) => ({
        id: `${oferta.origin}-${oferta.destination}-${oferta.depart_date}-${oferta.return_date ?? "ida"}`,
        origem: oferta.origin as string, destino: oferta.destination as string, preco: oferta.value as number,
        moeda: (dados.currency || "BRL").toUpperCase(), partida: oferta.depart_date as string, volta: oferta.return_date ?? null,
        encontradaEm: oferta.found_at ?? "", link: criarLinkJetradar(oferta.origin as string, oferta.destination as string, oferta.depart_date as string, oferta.return_date ?? null),
      }))
      .filter((oferta) => oferta.partida >= new Date().toISOString().slice(0, 10));

    return Response.json({ origem, ofertas, aviso: "Valores em cache da Travelpayouts/Aviasales. Confirme preço e disponibilidade no Aviasales." });
  } catch {
    return Response.json({ error: "Não foi possível consultar as ofertas da Travelpayouts agora." }, { status: 502 });
  }
}
