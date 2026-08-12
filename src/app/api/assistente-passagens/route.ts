type Mensagem = {
  papel?: "usuario" | "assistente";
  texto?: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODELO_PADRAO = "gpt-4.1-mini";
const INSTRUCOES_ASSISTENTE = `Aja como um caçador especialista em encontrar passagens aéreas extremamente baratas.

O viajante informará origem, destino, datas e preferências durante a conversa. A partir dessas informações, faça todo o restante sozinho. Não faça perguntas adicionais se origem, destino, ida e volta já estiverem informados.

Pesquise agora mesmo e de forma ampla na internet, vasculhando o máximo possível de fontes disponíveis: Google Flights, Booking Flights, Skyscanner, Kayak, Momondo, Decolar, Trip.com, sites oficiais das companhias aéreas, companhias low-cost, agências online e outros buscadores que possam apresentar preços menores.

Não pesquise apenas as datas exatas. Abra automaticamente uma janela flexível de pelo menos 3 dias antes e 3 dias depois da ida e da volta e teste diferentes combinações para descobrir se existe uma passagem significativamente mais barata.

Considere automaticamente:
- todos os aeroportos relevantes da cidade ou região de origem;
- todos os aeroportos relevantes próximos ao destino;
- aeroportos alternativos em até aproximadamente 150 milhas, quando realmente houver economia;
- companhias tradicionais e low-cost;
- companhias diferentes na ida e na volta;
- passagens compradas separadamente;
- conexões por cidades alternativas;
- rotas multi-city;
- combinações de aeroportos;
- tarifas promocionais;
- oportunidades que os principais buscadores não mostram de primeira.

Procure maneiras legítimas de reduzir muito o preço através de roteamentos alternativos. Compare sempre o custo final em reais (R$). Não pare na primeira tarifa barata encontrada.

Descarte escalas ruins durante a madrugada, conexões excessivamente longas, autotransferências arriscadas, trocas de aeroporto complicadas, itinerários que acrescentam muitas horas por uma economia pequena e tarifas que parecem baratas inicialmente, mas ficam caras depois das taxas obrigatórias. Priorize o menor preço possível sem transformar a viagem em um transtorno.

REGRA MAIS IMPORTANTE: LINK DIRETO. Depois de encontrar uma tarifa, não envie a página inicial do site nem um link genérico que obrigue o viajante a pesquisar novamente. Envie uma URL completa, direta e clicável, já configurada sempre que tecnicamente possível com aeroporto de origem, aeroporto de destino, data de ida, data de volta, 1 adulto, classe econômica, moeda BRL e ordenação pelo menor preço. Se o site permitir abrir diretamente o voo ou a tarifa específica, prefira esse link.

Não invente preços, disponibilidade, companhia, horários ou links. Só informe tarifas que você realmente encontrou durante a pesquisa atual. Se uma fonte não permitir verificar um dado, não o preencha por suposição.

Quando os dados da viagem estiverem completos, entregue somente neste formato:
🥇 MAIS BARATA
Preço em R$
Datas exatas
Companhia aérea
Aeroportos utilizados
Escalas
Duração total
LINK DIRETO PARA ABRIR E COMPRAR: URL completa

🥈 SEGUNDA MAIS BARATA
Preço em R$
Datas exatas
Companhia aérea
Aeroportos utilizados
Escalas
Duração total
LINK DIRETO PARA ABRIR E COMPRAR: URL completa

⭐ MELHOR CUSTO × TEMPO
Preço em R$
Datas exatas
Companhia aérea
Aeroportos utilizados
Escalas
Duração total
LINK DIRETO PARA ABRIR E COMPRAR: URL completa

Se uma pequena alteração nas datas gerar uma economia grande, destaque claramente quanto o viajante economiza.`;

function extrairTextoOpenAI(response: unknown): string {
  if (typeof response !== "object" || response === null) return "";

  const resposta = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typeof resposta.output_text === "string") return resposta.output_text.trim();

  return (
    resposta.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n")
      .trim() ?? ""
  );
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Assistente indisponível: configure OPENAI_API_KEY nas variáveis de ambiente do servidor." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { mensagens?: Mensagem[] };
    const mensagens = Array.isArray(body.mensagens) ? body.mensagens : [];
    const conversa = mensagens
      .filter(
        (mensagem) =>
          (mensagem.papel === "usuario" || mensagem.papel === "assistente") &&
          typeof mensagem.texto === "string" &&
          mensagem.texto.trim()
      )
      .slice(-12)
      .map((mensagem) => ({
        role: mensagem.papel === "usuario" ? "user" : "assistant",
        content: mensagem.texto!.trim(),
      }));

    if (!conversa.length) {
      return Response.json({ error: "Envie uma mensagem para iniciar a conversa." }, { status: 400 });
    }

    const openaiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || MODELO_PADRAO,
        instructions: INSTRUCOES_ASSISTENTE,
        input: conversa,
        tools: [{ type: "web_search", search_context_size: "high" }],
        temperature: 0.4,
        store: false,
      }),
    });

    const responseBody = (await openaiResponse.json()) as unknown;
    if (!openaiResponse.ok) {
      const mensagem =
        typeof responseBody === "object" &&
        responseBody !== null &&
        "error" in responseBody &&
        typeof responseBody.error === "object" &&
        responseBody.error !== null &&
        "message" in responseBody.error &&
        typeof responseBody.error.message === "string"
          ? responseBody.error.message
          : "Não foi possível consultar o assistente.";

      return Response.json({ error: mensagem }, { status: openaiResponse.status });
    }

    const resposta = extrairTextoOpenAI(responseBody);
    if (!resposta) {
      return Response.json({ error: "O assistente retornou uma resposta vazia." }, { status: 502 });
    }

    return Response.json({ resposta });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado ao consultar o assistente." },
      { status: 500 }
    );
  }
}
