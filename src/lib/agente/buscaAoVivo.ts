import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/adminServer";
import { escolherMaisBarato } from "@/lib/agente/verificacaoRegras";
import { consultar, descrever, todos, Voo } from "@/lib/agente/vooEspecifico";

const VALIDADE_MS = 6 * 60 * 60_000;

export type PedidoBusca = { origem: string; destino: string; ida: string; volta: string | null };
export type CompanhiaPreco = { companhia: string; preco: number; escalas: number };
export type NivelPreco = "low" | "typical" | "high";

export type ResultadoBusca = {
  companhias: CompanhiaPreco[];
  melhor: { companhia: string; preco: number; escalas: number; voo_ida: string | null; voo_volta: string | null; link: string } | null;
  nivel: NivelPreco | null;
  faixa: [number, number] | null;
};

export type RespostaBusca = { ok: true; resultado: ResultadoBusca; do_cache: boolean } | { ok: false; motivo: string };

function companhiaDoVoo(voo: Voo): string {
  const nomes = [...new Set((voo.flights ?? []).map((trecho) => trecho.airline).filter((nome): nome is string => Boolean(nome)))];
  return nomes.join(" + ") || "Companhia não informada";
}

// Menor preço de cada companhia entre todas as opções de ida (o preço já é o de ida e volta quando há volta).
export function compararCompanhias(voos: Voo[], limite = 4): CompanhiaPreco[] {
  const menores = new Map<string, CompanhiaPreco>();
  for (const voo of voos) {
    if (typeof voo.price !== "number" || voo.price <= 0) continue;
    const companhia = companhiaDoVoo(voo);
    const escalas = Math.max(0, (voo.flights?.length ?? 1) - 1);
    const atual = menores.get(companhia);
    if (!atual || voo.price < atual.preco || (voo.price === atual.preco && escalas < atual.escalas)) {
      menores.set(companhia, { companhia, preco: voo.price, escalas });
    }
  }
  return [...menores.values()].sort((a, b) => a.preco - b.preco || a.escalas - b.escalas).slice(0, limite);
}

export function chaveDaBusca(pedido: PedidoBusca): string {
  return [pedido.origem, pedido.destino, pedido.ida, pedido.volta ?? ""].join("|").toUpperCase();
}

export function codigoDoLink(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 10);
}

// Guarda o link comprido do Google Voos e devolve o código para o link curto /r/{codigo}.
export async function guardarLinkCurto(url: string): Promise<string> {
  const codigo = codigoDoLink(url);
  await createAdminClient().from("links_voo").upsert({ codigo, url }, { onConflict: "codigo" });
  return codigo;
}

async function pesquisar(pedido: PedidoBusca): Promise<ResultadoBusca> {
  const base: Record<string, string> = {
    engine: "google_flights",
    type: pedido.volta ? "1" : "2",
    departure_id: pedido.origem,
    arrival_id: pedido.destino,
    outbound_date: pedido.ida,
    ...(pedido.volta ? { return_date: pedido.volta } : {}),
    currency: "BRL",
    hl: "pt",
    gl: "br",
  };

  const primeira = await consultar({ ...base, sort_by: "2" });
  const idas = todos(primeira);
  const ida = escolherMaisBarato(idas);
  const faixa = primeira.price_insights?.typical_price_range;
  const nivelBruto = primeira.price_insights?.price_level;
  const nivel: NivelPreco | null = nivelBruto === "low" || nivelBruto === "typical" || nivelBruto === "high" ? nivelBruto : null;
  const comum = {
    companhias: compararCompanhias(idas),
    nivel,
    faixa: faixa && faixa.length === 2 ? ([faixa[0], faixa[1]] as [number, number]) : null,
  };
  if (!ida) return { ...comum, melhor: null };

  let escolhido: Voo = ida;
  let volta: Voo | null = null;
  let link = primeira.search_metadata?.google_flights_url ?? null;

  try {
    if (pedido.volta) {
      if (!ida.departure_token) throw new Error("sem token da volta");
      volta = escolherMaisBarato(todos(await consultar({ ...base, departure_token: ida.departure_token })));
      if (!volta) throw new Error("sem voos de volta");
      escolhido = volta;
    }
    if (!escolhido.booking_token) throw new Error("sem token de reserva");
    const reserva = await consultar({ ...base, booking_token: escolhido.booking_token });
    link = reserva.search_metadata?.google_flights_url ?? link;
  } catch {
    // Mantém o link da busca geral se não der para fechar o voo exato.
  }

  if (!link) return { ...comum, melhor: null };
  return {
    ...comum,
    melhor: {
      companhia: companhiaDoVoo(ida),
      preco: escolhido.price ?? ida.price ?? 0,
      escalas: Math.max(0, (ida.flights?.length ?? 1) - 1),
      voo_ida: descrever(ida),
      voo_volta: volta ? descrever(volta) : null,
      link,
    },
  };
}

export async function buscarPassagemAoVivo(pedido: PedidoBusca): Promise<RespostaBusca> {
  const db = createAdminClient();
  const chave = chaveDaBusca(pedido);
  const { data: guardada } = await db.from("busca_passagens_cache").select("resultado, criado_em").eq("chave", chave).maybeSingle();
  if (guardada && Date.now() - new Date(guardada.criado_em).getTime() < VALIDADE_MS) {
    return { ok: true, resultado: guardada.resultado as ResultadoBusca, do_cache: true };
  }

  if (!process.env.SERPAPI_KEY) return { ok: false, motivo: "SERPAPI_KEY não configurada." };

  try {
    const resultado = await pesquisar(pedido);
    await db.from("busca_passagens_cache").upsert({ chave, resultado, criado_em: new Date().toISOString() }, { onConflict: "chave" });
    return { ok: true, resultado, do_cache: false };
  } catch (error) {
    return { ok: false, motivo: error instanceof Error ? error.message : "Falha ao pesquisar as passagens." };
  }
}
