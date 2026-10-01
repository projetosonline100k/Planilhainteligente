export type RotaAcompanhada = {
  id: string;
  origin_code: string | null;
  origin_name: string;
  destination_code: string | null;
  destination_name: string;
  created_at: string;
};

export type RotasResult = { state: "ready"; rotas: RotaAcompanhada[] } | { state: "error" };

function corpoRota(body: unknown): RotaAcompanhada | null {
  const dados = body as { rota?: unknown } | null;
  const rota = dados?.rota as Partial<RotaAcompanhada> | undefined;
  if (!rota || typeof rota.id !== "string" || typeof rota.origin_name !== "string" || typeof rota.destination_name !== "string") return null;
  return {
    id: rota.id,
    origin_code: rota.origin_code ?? null,
    origin_name: rota.origin_name,
    destination_code: rota.destination_code ?? null,
    destination_name: rota.destination_name,
    created_at: typeof rota.created_at === "string" ? rota.created_at : "",
  };
}

export async function fetchRotasAcompanhadas(token: string, fetchImpl: typeof fetch = fetch): Promise<RotasResult> {
  try {
    const response = await fetchImpl("/api/rotas-acompanhadas", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { state: "error" };
    const body = await response.json().catch(() => null);
    if (!body || !Array.isArray(body.rotas)) return { state: "error" };
    return { state: "ready", rotas: body.rotas as RotaAcompanhada[] };
  } catch {
    return { state: "error" };
  }
}

export async function criarRotaAcompanhada(
  token: string,
  origem: { name: string; code?: string | null },
  destino: { name: string; code?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; rota: RotaAcompanhada } | { ok: false; error: string }> {
  try {
    const response = await fetchImpl("/api/rotas-acompanhadas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ origin: origem, destination: destino }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body) return { ok: false, error: body?.error ?? "Nao foi possivel cadastrar a rota." };
    const rota = corpoRota(body);
    if (!rota) return { ok: false, error: "Resposta invalida ao cadastrar a rota." };
    return { ok: true, rota };
  } catch {
    return { ok: false, error: "Nao foi possivel cadastrar a rota." };
  }
}

export async function editarRotaAcompanhada(
  token: string,
  id: string,
  origem: { name: string; code?: string | null },
  destino: { name: string; code?: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; rota: RotaAcompanhada } | { ok: false; error: string }> {
  try {
    const response = await fetchImpl("/api/rotas-acompanhadas", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, origin: origem, destination: destino }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body) return { ok: false, error: body?.error ?? "Nao foi possivel atualizar a rota." };
    const rota = corpoRota(body);
    if (!rota) return { ok: false, error: "Resposta invalida ao atualizar a rota." };
    return { ok: true, rota };
  } catch {
    return { ok: false, error: "Nao foi possivel atualizar a rota." };
  }
}

export async function pararDeAcompanhar(token: string, id: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(`/api/rotas-acompanhadas?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}
