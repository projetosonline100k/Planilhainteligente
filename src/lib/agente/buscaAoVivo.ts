import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/adminServer";
import { pesquisarNoNavegador } from "@/lib/agente/navegadorVoos";

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
  const resultado = await pesquisarNoNavegador(pedido);
  return { ...resultado, faixa: null };
}

export async function buscarPassagemAoVivo(pedido: PedidoBusca, opcoes: { aoPesquisar?: () => Promise<void> } = {}): Promise<RespostaBusca> {
  const db = createAdminClient();
  const chave = chaveDaBusca(pedido);
  const { data: guardada } = await db.from("busca_passagens_cache").select("resultado, criado_em").eq("chave", chave).maybeSingle();
  if (guardada && Date.now() - new Date(guardada.criado_em).getTime() < VALIDADE_MS) {
    return { ok: true, resultado: guardada.resultado as ResultadoBusca, do_cache: true };
  }

  try {
    await opcoes.aoPesquisar?.().catch(() => {});
    const resultado = await pesquisar(pedido);
    await db.from("busca_passagens_cache").upsert({ chave, resultado, criado_em: new Date().toISOString() }, { onConflict: "chave" });
    return { ok: true, resultado, do_cache: false };
  } catch (error) {
    return { ok: false, motivo: error instanceof Error ? error.message : "Falha ao pesquisar as passagens." };
  }
}
