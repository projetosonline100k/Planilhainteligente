import { createAdminClient } from "@/lib/adminServer";
import { calcularStatusMeta } from "@/lib/agente/meta";
import { linkCurtoDisponivel } from "@/lib/agente/linkCurto";
import { formatarOferta, linkDaOferta, urlBaseLinks } from "@/lib/agente/ofertaTexto";
import { AgenteConfig, FerramentaAgente, ViagemDesejada } from "@/types/agente";

export type DefinicaoFerramenta = {
  grupo: FerramentaAgente | "perfil";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const texto = (description: string) => ({ type: "string", description });
const numero = (description: string) => ({ type: "number", description });

const DEFINICOES: DefinicaoFerramenta[] = [
  {
    grupo: "perfil",
    name: "salvar_perfil",
    description: "Memoriza o nome da pessoa e a cidade de onde ela costuma viajar. Use assim que ela disser qualquer um dos dois.",
    parameters: {
      type: "object",
      properties: {
        nome: texto("Como a pessoa quer ser chamada (primeiro nome)"),
        cidade_origem: texto("Cidade de onde a pessoa costuma sair para viajar"),
      },
    },
  },
  {
    grupo: "viagens_desejadas",
    name: "salvar_viagem_desejada",
    description: "Salva ou atualiza um lugar que a pessoa quer conhecer. Use também para registrar data, custo estimado ou quanto ela guarda por mês.",
    parameters: {
      type: "object",
      properties: {
        destino: texto("Cidade ou país de destino"),
        origem: texto("Cidade de onde a pessoa sai, se informada"),
        data_viagem: texto("Data prevista no formato AAAA-MM-DD, se informada"),
        custo_estimado: numero("Custo total estimado da viagem em reais"),
        guardar_por_mes: numero("Quanto a pessoa consegue guardar por mês em reais"),
      },
      required: ["destino"],
    },
  },
  {
    grupo: "viagens_desejadas",
    name: "listar_viagens_desejadas",
    description: "Lista os lugares que a pessoa já pediu para acompanhar.",
    parameters: { type: "object", properties: {} },
  },
  {
    grupo: "viagens_desejadas",
    name: "remover_viagem_desejada",
    description: "Para de acompanhar um destino.",
    parameters: { type: "object", properties: { destino: texto("Destino a remover") }, required: ["destino"] },
  },
  {
    grupo: "ofertas",
    name: "buscar_ofertas",
    description: "Busca passagens em promoção encontradas pelo radar da VaiViajar. Pode filtrar por destino e/ou origem.",
    parameters: {
      type: "object",
      properties: { destino: texto("Destino desejado (opcional)"), origem: texto("Cidade de origem (opcional)") },
    },
  },
  {
    grupo: "meta",
    name: "registrar_valor_guardado",
    description: "Registra dinheiro guardado para uma viagem. Use modo 'somar' quando a pessoa disser que guardou mais um valor e 'definir' quando disser o total.",
    parameters: {
      type: "object",
      properties: {
        destino: texto("Destino da viagem"),
        valor: numero("Valor em reais"),
        modo: { type: "string", enum: ["somar", "definir"] },
      },
      required: ["destino", "valor", "modo"],
    },
  },
  {
    grupo: "meta",
    name: "status_meta",
    description: "Calcula se a pessoa está longe ou perto de conseguir pagar a viagem.",
    parameters: { type: "object", properties: { destino: texto("Destino da viagem") }, required: ["destino"] },
  },
];

export const FERRAMENTAS_DESCRICAO: Record<FerramentaAgente, { titulo: string; descricao: string; funcoes: string[] }> = {
  viagens_desejadas: {
    titulo: "Lugares que quer ir",
    descricao: "Anota destinos desejados e liga o aviso de passagens.",
    funcoes: DEFINICOES.filter((d) => d.grupo === "viagens_desejadas").map((d) => d.name),
  },
  ofertas: {
    titulo: "Ofertas do radar",
    descricao: "Consulta as promoções que o n8n salva em flight_offers.",
    funcoes: DEFINICOES.filter((d) => d.grupo === "ofertas").map((d) => d.name),
  },
  meta: {
    titulo: "Longe ou perto da meta",
    descricao: "Registra quanto a pessoa guardou e calcula o quanto falta.",
    funcoes: DEFINICOES.filter((d) => d.grupo === "meta").map((d) => d.name),
  },
  pesquisa_web: {
    titulo: "Pesquisa na internet",
    descricao: "Permite responder dúvidas de viagem com busca na web (custa mais por mensagem).",
    funcoes: ["web_search"],
  },
};

export function definicoesAtivas(config: AgenteConfig): DefinicaoFerramenta[] {
  return DEFINICOES.filter((d) => d.grupo === "perfil" || config.ferramentas[d.grupo]);
}

export function ferramentasOpenAI(config: AgenteConfig): unknown[] {
  const funcoes = definicoesAtivas(config).map((d) => ({
    type: "function",
    name: d.name,
    description: d.description,
    parameters: d.parameters,
  }));
  return config.ferramentas.pesquisa_web ? [...funcoes, { type: "web_search" }] : funcoes;
}

export const urlBase = urlBaseLinks;

function textoArg(args: Record<string, unknown>, chave: string): string | null {
  const valor = args[chave];
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function numeroArg(args: Record<string, unknown>, chave: string): number | null {
  const valor = Number(args[chave]);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

function dataArg(args: Record<string, unknown>, chave: string): string | null {
  const valor = textoArg(args, chave);
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

async function buscarViagem(contatoId: string, destino: string): Promise<ViagemDesejada | null> {
  const { data } = await createAdminClient()
    .from("whatsapp_viagens")
    .select("*")
    .eq("contato_id", contatoId)
    .ilike("destino", `%${destino}%`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ViagemDesejada | null) ?? null;
}

export async function buscarOfertas(filtros: { destino?: string | null; origem?: string | null; descontoMinimo?: number }, limite = 5) {
  let consulta = createAdminClient()
    .from("flight_offers")
    .select("id, origin_name, destination_name, price, typical_price, savings_percentage, outbound_date, return_date, booking_url, created_at")
    .eq("status", "active")
    .gte("savings_percentage", filtros.descontoMinimo ?? 0)
    .order("savings_percentage", { ascending: false })
    .limit(limite);
  if (filtros.destino) consulta = consulta.ilike("destination_name", `%${filtros.destino}%`);
  if (filtros.origem) consulta = consulta.ilike("origin_name", `%${filtros.origem}%`);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const curto = await linkCurtoDisponivel();
  return (data ?? []).map((oferta) => ({ ...oferta, linkCurto: curto, link: linkDaOferta(oferta, curto) }));
}

export async function executarFerramenta(nome: string, args: Record<string, unknown>, contatoId: string): Promise<unknown> {
  const db = createAdminClient();

  switch (nome) {
    case "salvar_perfil": {
      const nome = textoArg(args, "nome")?.slice(0, 60) ?? null;
      const cidade = textoArg(args, "cidade_origem")?.slice(0, 80) ?? null;
      if (!nome && !cidade) return { erro: "Informe o nome ou a cidade." };
      const { error } = await db
        .from("whatsapp_contatos")
        .update({ ...(nome ? { nome_preferido: nome } : {}), ...(cidade ? { cidade_origem: cidade } : {}) })
        .eq("id", contatoId);
      if (error) return { erro: error.message };
      return { ok: true, nome, cidade_origem: cidade };
    }

    case "salvar_viagem_desejada": {
      const destino = textoArg(args, "destino");
      if (!destino) return { erro: "Destino obrigatório." };
      const existente = await buscarViagem(contatoId, destino);
      const campos = {
        ...(textoArg(args, "origem") ? { origem: textoArg(args, "origem") } : {}),
        ...(dataArg(args, "data_viagem") ? { data_viagem: dataArg(args, "data_viagem") } : {}),
        ...(numeroArg(args, "custo_estimado") ? { custo_estimado: numeroArg(args, "custo_estimado") } : {}),
        ...(numeroArg(args, "guardar_por_mes") ? { guardar_por_mes: numeroArg(args, "guardar_por_mes") } : {}),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = existente
        ? await db.from("whatsapp_viagens").update(campos).eq("id", existente.id).select("*").single()
        : await db.from("whatsapp_viagens").insert({ contato_id: contatoId, destino, ...campos }).select("*").single();
      if (error) return { erro: error.message };
      return { ok: true, atualizada: Boolean(existente), viagem: data };
    }

    case "listar_viagens_desejadas": {
      const { data } = await db.from("whatsapp_viagens").select("*").eq("contato_id", contatoId).order("created_at");
      return { viagens: data ?? [] };
    }

    case "remover_viagem_desejada": {
      const destino = textoArg(args, "destino");
      const viagem = destino ? await buscarViagem(contatoId, destino) : null;
      if (!viagem) return { erro: "Destino não encontrado na lista." };
      await db.from("whatsapp_viagens").delete().eq("id", viagem.id);
      return { ok: true, removido: viagem.destino };
    }

    case "buscar_ofertas": {
      const ofertas = await buscarOfertas({ destino: textoArg(args, "destino"), origem: textoArg(args, "origem") });
      if (!ofertas.length) return { ofertas: [], aviso: "Nenhuma oferta ativa no radar para esse filtro agora." };
      return {
        ofertas: ofertas.slice(0, 3).map((oferta, indice) => ({
          texto_pronto: formatarOferta(oferta, { cabecalho: indice === 0, linkCurto: oferta.linkCurto }),
          destino: oferta.destination_name,
          origem: oferta.origin_name,
          preco: oferta.price,
        })),
        instrucao: "Envie cada texto_pronto exatamente como está (inclusive o link inteiro), um bloco por oferta, com uma linha em branco entre eles.",
      };
    }

    case "registrar_valor_guardado": {
      const destino = textoArg(args, "destino");
      const valor = numeroArg(args, "valor");
      if (!destino || valor === null) return { erro: "Informe destino e valor." };
      const viagem = await buscarViagem(contatoId, destino);
      if (!viagem) return { erro: "Essa viagem ainda não foi salva. Salve o destino primeiro." };
      const novoValor = args.modo === "definir" ? valor : Number(viagem.valor_guardado) + valor;
      const { data, error } = await db
        .from("whatsapp_viagens")
        .update({ valor_guardado: novoValor, updated_at: new Date().toISOString() })
        .eq("id", viagem.id)
        .select("*")
        .single();
      if (error) return { erro: error.message };
      return { ok: true, valor_guardado: novoValor, meta: calcularStatusMeta(data as ViagemDesejada) };
    }

    case "status_meta": {
      const destino = textoArg(args, "destino");
      const viagem = destino ? await buscarViagem(contatoId, destino) : null;
      if (!viagem) return { erro: "Essa viagem ainda não foi salva." };
      return { destino: viagem.destino, data_viagem: viagem.data_viagem, ...calcularStatusMeta(viagem) };
    }

    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}
