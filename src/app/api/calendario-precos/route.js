export const dynamic = "force-dynamic";

const CODIGO_IATA = /^[A-Z]{3}$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const UM_DIA = 86_400_000;

function deslocarData(data, dias) { const valor = new Date(`${data}T12:00:00Z`); valor.setUTCDate(valor.getUTCDate() + dias); return valor.toISOString().slice(0, 10); }

async function buscarMenorPreco({ apiKey, origin, destination, outboundDate, returnDate, adults }) {
  const consulta = new URL("https://serpapi.com/search.json");
  consulta.search = new URLSearchParams({
    engine: "google_flights", api_key: apiKey, departure_id: origin, arrival_id: destination,
    outbound_date: outboundDate, adults: String(adults), type: returnDate ? "1" : "2",
    currency: "BRL", hl: "pt", gl: "br", sort_by: "2", ...(returnDate ? { return_date: returnDate } : {}),
  }).toString();
  const resposta = await fetch(consulta, { next: { revalidate: 300 }, signal: AbortSignal.timeout(30000) });
  const dados = await resposta.json();
  if (!resposta.ok || dados.error) return { data: outboundDate, preco: null };
  const voos = [...(dados.best_flights || []), ...(dados.other_flights || [])];
  const precos = voos.map((voo) => voo.price).filter((preco) => typeof preco === "number");
  return { data: outboundDate, preco: precos.length ? Math.min(...precos) : null };
}

export async function GET(request) {
  const parametros = new URL(request.url).searchParams;
  const origin = parametros.get("origin")?.trim().toUpperCase() || ""; const destination = parametros.get("destination")?.trim().toUpperCase() || "";
  const outboundDate = parametros.get("outbound_date") || ""; const returnDateOriginal = parametros.get("return_date") || ""; const adults = Number(parametros.get("adults") || "1");
  if (!CODIGO_IATA.test(origin) || !CODIGO_IATA.test(destination) || !DATA_ISO.test(outboundDate) || (returnDateOriginal && !DATA_ISO.test(returnDateOriginal)) || !Number.isInteger(adults) || adults < 1 || adults > 9) return Response.json({ error: "Parâmetros inválidos para o calendário de preços." }, { status: 400 });
  const apiKey = process.env.SERPAPI_KEY?.trim(); if (!apiKey) return Response.json({ error: "Configure SERPAPI_KEY no servidor." }, { status: 503 });

  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const duracao = returnDateOriginal ? Math.round((new Date(`${returnDateOriginal}T12:00:00Z`).getTime() - new Date(`${outboundDate}T12:00:00Z`).getTime()) / UM_DIA) : 0;
  const datas = Array.from({ length: 7 }, (_, indice) => deslocarData(outboundDate, indice - 3)).filter((data) => data >= hoje);
  try {
    const precos = await Promise.all(datas.map((data) => buscarMenorPreco({ apiKey, origin, destination, outboundDate: data, returnDate: returnDateOriginal ? deslocarData(data, duracao) : "", adults })));
    return Response.json({ precos });
  } catch { return Response.json({ error: "Não foi possível consultar os preços próximos agora." }, { status: 502 }); }
}
