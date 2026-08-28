import { createAdminClient } from "@/lib/adminServer";
import { DEFAULT_FLIGHT_PROMPT, FLIGHT_PROMPT_SETTING_KEY } from "@/lib/flightPrompt";

type Mensagem = {
  papel?: "usuario" | "assistente";
  texto?: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODELO_PADRAO = "gpt-4.1-mini";
async function getFlightAssistantInstructions(): Promise<string> {
  try {
    const { data, error } = await createAdminClient()
      .from("app_settings")
      .select("value")
      .eq("key", FLIGHT_PROMPT_SETTING_KEY)
      .maybeSingle();

    return !error && data?.value?.trim() ? data.value : DEFAULT_FLIGHT_PROMPT;
  } catch {
    return DEFAULT_FLIGHT_PROMPT;
  }
}

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
        instructions: await getFlightAssistantInstructions(),
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
