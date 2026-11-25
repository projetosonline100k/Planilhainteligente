import { authorizeAdmin } from "@/lib/adminServer";
import { enviarOfertasProativas } from "@/lib/agente/proativo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const authorization = await authorizeAdmin(request);
  if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

  try {
    return Response.json(await enviarOfertasProativas());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
