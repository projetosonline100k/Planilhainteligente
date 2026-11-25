import { enviarOfertasProativas } from "@/lib/agente/proativo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    return Response.json(await enviarOfertasProativas());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
