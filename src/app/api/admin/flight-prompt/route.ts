import { authorizeAdmin, createAdminClient } from "@/lib/adminServer";
import { DEFAULT_FLIGHT_PROMPT, FLIGHT_PROMPT_SETTING_KEY } from "@/lib/flightPrompt";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authorization = await authorizeAdmin(request);
    if ("error" in authorization) {
      return Response.json({ error: authorization.error }, { status: authorization.status });
    }

    const { data, error } = await createAdminClient()
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", FLIGHT_PROMPT_SETTING_KEY)
      .maybeSingle();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ prompt: data?.value ?? DEFAULT_FLIGHT_PROMPT, updatedAt: data?.updated_at ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authorization = await authorizeAdmin(request);
    if ("error" in authorization) {
      return Response.json({ error: authorization.error }, { status: authorization.status });
    }

    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();
    if (!prompt || prompt.length > 20_000) {
      return Response.json({ error: "O prompt deve ter entre 1 e 20.000 caracteres." }, { status: 400 });
    }

    const { data, error } = await createAdminClient()
      .from("app_settings")
      .upsert(
        { key: FLIGHT_PROMPT_SETTING_KEY, value: prompt, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      )
      .select("value, updated_at")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ prompt: data.value, updatedAt: data.updated_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
