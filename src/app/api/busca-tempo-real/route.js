export const dynamic = "force-dynamic";

const SERPAPI_URL = "https://serpapi.com/search.json";
const CODIGO_IATA = /^[A-Z]{3}$/;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function erro(mensagem, status = 400) {
  return Response.json({ error: mensagem }, { status });
}

function dataValida(valor) {
  if (!DATA_ISO.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function criarLinkGoogleFlights(origin, destination, outboundDate, returnDate, adults) {
  const url = new URL("https://www.google.com/travel/flights");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("curr", "BRL");
  url.searchParams.set("q", `Voos de ${origin} para ${destination} em ${outboundDate}${returnDate ? ` voltando em ${returnDate}` : ""} para ${adults} adulto${adults > 1 ? "s" : ""}`);
  return url.toString();
}

function normalizarVoo(resultado, indice, linkGoogleFlights) {
  const trechos = Array.isArray(resultado.flights) ? resultado.flights : [];
  const primeiro = trechos[0];
  const ultimo = trechos.at(-1);
  if (!primeiro || !ultimo || typeof resultado.price !== "number") return null;
  const partida = primeiro.departure_airport?.time;
  const chegada = ultimo.arrival_airport?.time;
  if (!partida || !chegada) return null;

  const companhias = [...new Set(trechos.map((trecho) => trecho.airline).filter(Boolean))];
  return {
    id: resultado.booking_token || `${partida}-${chegada}-${resultado.price}-${indice}`,
    preco: resultado.price,
    moeda: "BRL",
    companhia: companhias.join(" + ") || "Companhia não informada",
    horarioPartida: partida,
    horarioChegada: chegada,
    escalas: Math.max(trechos.length - 1, 0),
    duracaoMinutos: typeof resultado.total_duration === "number" ? resultado.total_duration : null,
    linkGoogleFlights,
  };
}

export async function GET(request) {
  const parametros = new URL(request.url).searchParams;
  const origin = parametros.get("origin")?.trim().toUpperCase() || "";
  const destination = parametros.get("destination")?.trim().toUpperCase() || "";
  const outboundDate = parametros.get("outbound_date")?.trim() || "";
  const returnDate = parametros.get("return_date")?.trim() || "";
  const adults = Number(parametros.get("adults") || "1");

  if (!CODIGO_IATA.test(origin) || !CODIGO_IATA.test(destination)) return erro("Informe origem e destino com códigos IATA de três letras, como GYN e GRU.");
  if (origin === destination) return erro("Origem e destino precisam ser diferentes.");
  if (!dataValida(outboundDate) || (returnDate && !dataValida(returnDate))) return erro("Informe as datas no formato AAAA-MM-DD.");
  if (returnDate && returnDate < outboundDate) return erro("A data de volta não pode ser anterior à data de ida.");
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) return erro("Informe entre 1 e 9 passageiros adultos.");

  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return erro("Configure SERPAPI_KEY no servidor para buscar voos.", 503);

  const consulta = new URL(SERPAPI_URL);
  consulta.search = new URLSearchParams({
    engine: "google_flights", api_key: apiKey, departure_id: origin, arrival_id: destination,
    outbound_date: outboundDate, adults: String(adults), type: returnDate ? "1" : "2",
    currency: "BRL", hl: "pt", gl: "br", sort_by: "2",
    ...(returnDate ? { return_date: returnDate } : {}),
  }).toString();

  try {
    const resposta = await fetch(consulta, { next: { revalidate: 300 }, signal: AbortSignal.timeout(30000) });
    const dados = await resposta.json();
    if (!resposta.ok || dados.error) return erro(dados.error || "A SerpApi não conseguiu concluir a busca agora.", resposta.status >= 400 ? resposta.status : 502);

    const linkGoogleFlights = dados.search_metadata?.google_flights_url || criarLinkGoogleFlights(origin, destination, outboundDate, returnDate, adults);
    const resultados = [...(dados.best_flights || []), ...(dados.other_flights || [])];
    const voos = resultados.map((resultado, indice) => normalizarVoo(resultado, indice, linkGoogleFlights)).filter(Boolean);
    return Response.json({ voos, linkGoogleFlights });
  } catch (falha) {
    const mensagem = falha instanceof Error && falha.name === "TimeoutError" ? "A busca demorou mais que o esperado. Tente novamente." : "Não foi possível consultar os voos em tempo real agora.";
    return erro(mensagem, 502);
  }
}
