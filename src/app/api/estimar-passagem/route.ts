type EstimativaPassagemRequest = {
  destino?: string;
  dataIda?: string;
  dataVolta?: string;
  origem?: string;
};

type EstimativaPassagem = {
  valorEstimado: number;
  faixaMinima: number;
  faixaMaxima: number;
  confianca: "baixa" | "media" | "alta";
  observacao: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODELO_PADRAO = "gpt-4.1-mini";

function arredondarParaInteiro(valor: unknown): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return 0;
  return Math.max(0, Math.round(valor));
}

function dataValida(dataIso?: string): boolean {
  if (!dataIso) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(dataIso) && !Number.isNaN(new Date(dataIso).getTime());
}

function extrairTextoOpenAI(response: unknown): string {
  if (typeof response !== "object" || response === null) return "";

  const resposta = response as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof resposta.output_text === "string") return resposta.output_text;

  return (
    resposta.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n") ?? ""
  );
}

function parseEstimativa(texto: string): EstimativaPassagem | null {
  try {
    const jsonInicio = texto.indexOf("{");
    const jsonFim = texto.lastIndexOf("}");
    const conteudo = jsonInicio >= 0 && jsonFim >= 0 ? texto.slice(jsonInicio, jsonFim + 1) : texto;
    const dados = JSON.parse(conteudo) as Partial<EstimativaPassagem>;

    const valorEstimado = arredondarParaInteiro(dados.valorEstimado);
    const faixaMinima = arredondarParaInteiro(dados.faixaMinima);
    const faixaMaxima = arredondarParaInteiro(dados.faixaMaxima);
    const confiancas = new Set(["baixa", "media", "alta"]);
    const confianca = confiancas.has(String(dados.confianca))
      ? (dados.confianca as EstimativaPassagem["confianca"])
      : "baixa";

    if (!valorEstimado || !faixaMinima || !faixaMaxima) return null;

    return {
      valorEstimado,
      faixaMinima,
      faixaMaxima,
      confianca,
      observacao:
        typeof dados.observacao === "string" && dados.observacao.trim()
          ? dados.observacao.trim().slice(0, 220)
          : "Estimativa aproximada para planejamento, sujeita a mudancas de preco.",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Configure OPENAI_API_KEY no .env.local para estimar passagens." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as EstimativaPassagemRequest;
    const destino = body.destino?.trim();
    const dataIda = body.dataIda?.trim();
    const dataVolta = body.dataVolta?.trim();
    const origem = body.origem?.trim();

    if (!destino) {
      return Response.json({ error: "Informe o destino da viagem." }, { status: 400 });
    }

    if (!origem) {
      return Response.json({ error: "Informe a cidade de saida." }, { status: 400 });
    }

    if (!dataValida(dataIda) || !dataValida(dataVolta)) {
      return Response.json({ error: "Informe datas validas no formato AAAA-MM-DD." }, { status: 400 });
    }

    const prompt = [
      "Voce estima custos de passagens aereas para planejamento financeiro pessoal.",
      "Retorne apenas um JSON valido, sem markdown.",
      "Use reais brasileiros (BRL) e estime passagem de ida e volta para uma pessoa.",
      "Quando nao houver dados suficientes, prefira uma faixa conservadora e confianca baixa.",
      "Formato exato: {\"valorEstimado\": number, \"faixaMinima\": number, \"faixaMaxima\": number, \"confianca\": \"baixa\" | \"media\" | \"alta\", \"observacao\": string}.",
      "",
      `Origem: ${origem}`,
      `Destino: ${destino}`,
      `Data de ida: ${dataIda || "nao informada"}`,
      `Data de volta: ${dataVolta || "nao informada"}`,
    ].join("\n");

    const openaiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || MODELO_PADRAO,
        input: prompt,
        temperature: 0.2,
      }),
    });

    const responseBody = (await openaiResponse.json()) as unknown;

    if (!openaiResponse.ok) {
      const errorMessage =
        typeof responseBody === "object" &&
        responseBody !== null &&
        "error" in responseBody &&
        typeof responseBody.error === "object" &&
        responseBody.error !== null &&
        "message" in responseBody.error &&
        typeof responseBody.error.message === "string"
          ? responseBody.error.message
          : "Nao foi possivel consultar a OpenAI.";

      return Response.json({ error: errorMessage }, { status: openaiResponse.status });
    }

    const estimativa = parseEstimativa(extrairTextoOpenAI(responseBody));
    if (!estimativa) {
      return Response.json(
        { error: "A OpenAI retornou uma resposta sem estimativa valida." },
        { status: 502 }
      );
    }

    return Response.json({ ...estimativa, origem });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao estimar passagem.";
    return Response.json({ error: message }, { status: 500 });
  }
}
