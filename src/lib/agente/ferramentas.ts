import { createAdminClient } from "@/lib/adminServer";
import { EtapaConversa, etapaInicial } from "@/lib/agente/etapas";
import { calcularStatusMeta } from "@/lib/agente/meta";
import { descontoReal, ofertaAprovada } from "@/lib/agente/verificacaoRegras";
import { verificarOferta } from "@/lib/agente/vooEspecifico";
import { linkCurtoDisponivel } from "@/lib/agente/linkCurto";
import { buscarPassagemAoVivo, guardarLinkCurto } from "@/lib/agente/buscaAoVivo";
import { formatarCartaoBusca, formatarComparativo, linkDaOferta, urlBaseLinks } from "@/lib/agente/ofertaTexto";
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
    description: "Memoriza o perfil da pessoa: nome, estado, cidade e aeroporto de onde ela costuma viajar. Use assim que ela informar qualquer um deles, ou corrigir.",
    parameters: {
      type: "object",
      properties: {
        nome: texto("Como a pessoa quer ser chamada (primeiro nome)"),
        estado: texto("Estado onde a pessoa mora, com a sigla, por exemplo GO"),
        cidade_origem: texto("Cidade do aeroporto de onde ela costuma sair, por exemplo Goiânia"),
        aeroporto: texto("Código IATA de 3 letras do aeroporto, por exemplo GYN"),
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
    name: "buscar_passagem",
    description:
      "Pesquisa AO VIVO no Google Voos o voo mais barato entre dois lugares nas datas pedidas e compara as principais companhias. Leva de 15 a 30 segundos. Só chame com destino e data de ida definidos; se faltar a data, pergunte antes. A origem usa o aeroporto de saída da pessoa se você não informar.",
    parameters: {
      type: "object",
      properties: {
        origem: texto("Código IATA do aeroporto de saída, por exemplo GYN. Vários aeroportos da mesma cidade separados por vírgula, por exemplo GRU,CGH. Omita para usar o aeroporto da pessoa."),
        origem_nome: texto("Nome da cidade de saída, por exemplo Goiânia. Omita para usar a cidade da pessoa."),
        destino: texto("Código IATA do aeroporto de destino, por exemplo CDG. Vários separados por vírgula."),
        destino_nome: texto("Nome da cidade de destino, por exemplo Paris"),
        data_ida: texto("Data de ida no formato AAAA-MM-DD"),
        data_volta: texto("Data de volta no formato AAAA-MM-DD. Omita se for só ida."),
      },
      required: ["destino", "destino_nome", "data_ida"],
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
    titulo: "Busca de passagens",
    descricao: "Pesquisa ao vivo no Google Voos, compara as companhias e traz o voo mais barato.",
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

export function definicoesAtivas(config: AgenteConfig, etapa: EtapaConversa = "livre"): DefinicaoFerramenta[] {
  if (etapaInicial(etapa)) return DEFINICOES.filter((d) => d.grupo === "perfil");
  return DEFINICOES.filter((d) => d.grupo === "perfil" || config.ferramentas[d.grupo]);
}

export function ferramentasOpenAI(config: AgenteConfig, etapa: EtapaConversa = "livre"): unknown[] {
  const funcoes = definicoesAtivas(config, etapa).map((d) => ({
    type: "function",
    name: d.name,
    description: d.description,
    parameters: d.parameters,
  }));
  return config.ferramentas.pesquisa_web && !etapaInicial(etapa) ? [...funcoes, { type: "web_search" }] : funcoes;
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

type FiltrosOfertas = { destino?: string | null; origem?: string | null; descontoMinimo?: number; excluirIds?: string[] };

export async function buscarOfertas(filtros: FiltrosOfertas, limite = 5) {
  const hoje = new Date().toISOString().slice(0, 10);
  let consulta = createAdminClient()
    .from("flight_offers")
    .select("id, origin_code, destination_code, origin_name, destination_name, price, typical_price, savings_percentage, outbound_date, return_date, booking_url, created_at")
    .eq("status", "active")
    .gte("outbound_date", hoje)
    .gte("savings_percentage", filtros.descontoMinimo ?? 0)
    .order("savings_percentage", { ascending: false })
    .limit(limite);
  if (filtros.destino) consulta = consulta.ilike("destination_name", `%${filtros.destino}%`);
  if (filtros.origem) consulta = consulta.ilike("origin_name", `%${filtros.origem}%`);
  if (filtros.excluirIds?.length) consulta = consulta.not("id", "in", `(${filtros.excluirIds.join(",")})`);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const curto = await linkCurtoDisponivel();
  return (data ?? []).map((oferta) => ({ ...oferta, linkCurto: curto, link: linkDaOferta(oferta, curto) }));
}

export type OfertaConferida = Awaited<ReturnType<typeof buscarOfertas>>[number] & {
  link_voo: string | null;
  voo: string | null;
};

// O radar guarda preços de semanas atrás. Antes de mostrar, confere o preço de hoje, acha o voo mais barato
// e só entrega o que continua sendo uma boa passagem, já com o preço real e o link desse voo.
export async function buscarOfertasConferidas(filtros: FiltrosOfertas, quantidade = 2, descontoMinimo = 25) {
  const candidatas = await buscarOfertas(filtros, 12);
  const aprovadas: OfertaConferida[] = [];
  let descartadas = 0;
  let indisponivel: string | null = null;
  const LIMITE_CONFERENCIAS = 6;
  let conferidas = 0;

  while (aprovadas.length < quantidade && candidatas.length && conferidas < LIMITE_CONFERENCIAS && !indisponivel) {
    const lote = candidatas.splice(0, Math.min(quantidade - aprovadas.length, LIMITE_CONFERENCIAS - conferidas));
    conferidas += lote.length;
    const resultados = await Promise.all(lote.map((oferta) => verificarOferta(oferta)));

    resultados.forEach((resultado, indice) => {
      const oferta = lote[indice];
      if (!resultado.ok) {
        indisponivel = resultado.motivo;
        return;
      }
      const { preco_real: real, link_voo: linkVoo, voo } = resultado.verificacao;
      const normal = oferta.typical_price ? Number(oferta.typical_price) : null;
      if (real === null || !linkVoo || !ofertaAprovada({ real, anunciado: Number(oferta.price), normal, descontoMinimo })) {
        descartadas += 1;
        return;
      }
      aprovadas.push({ ...oferta, price: real, savings_percentage: descontoReal(real, normal), link_voo: linkVoo, voo });
    });
  }

  return { ofertas: aprovadas, descartadas, indisponivel };
}

export async function executarFerramenta(nome: string, args: Record<string, unknown>, contatoId: string): Promise<unknown> {
  const db = createAdminClient();

  switch (nome) {
    case "salvar_perfil": {
      const nome = textoArg(args, "nome")?.slice(0, 60) ?? null;
      const estado = textoArg(args, "estado")?.slice(0, 40) ?? null;
      const cidade = textoArg(args, "cidade_origem")?.slice(0, 80) ?? null;
      const aeroportoInformado = textoArg(args, "aeroporto")?.toUpperCase() ?? null;
      const aeroporto = aeroportoInformado && /^[A-Z]{3}$/.test(aeroportoInformado) ? aeroportoInformado : null;
      if (!nome && !estado && !cidade && !aeroporto) return { erro: "Informe pelo menos um dado do perfil." };
      const { error } = await db
        .from("whatsapp_contatos")
        .update({
          ...(nome ? { nome_preferido: nome } : {}),
          ...(estado ? { estado } : {}),
          ...(cidade ? { cidade_origem: cidade } : {}),
          ...(aeroporto ? { aeroporto_origem: aeroporto } : {}),
        })
        .eq("id", contatoId);
      if (error) return { erro: error.message };
      return { ok: true, nome, estado, cidade_origem: cidade, aeroporto };
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

    case "buscar_passagem": {
      const { data: perfil } = await db.from("whatsapp_contatos").select("cidade_origem, aeroporto_origem").eq("id", contatoId).maybeSingle();
      const codigos = (valor: string | null) => valor?.toUpperCase().replace(/\s/g, "") ?? null;
      const origem = codigos(textoArg(args, "origem")) ?? perfil?.aeroporto_origem ?? null;
      const destino = codigos(textoArg(args, "destino"));
      const ida = dataArg(args, "data_ida");
      const volta = dataArg(args, "data_volta");
      const validos = (lista: string | null) => Boolean(lista) && /^[A-Z]{3}(,[A-Z]{3}){0,3}$/.test(lista as string);

      if (!validos(origem)) return { erro: "Falta o aeroporto de saída. Pergunte de onde a pessoa vai sair." };
      if (!validos(destino)) return { erro: "Destino inválido. Informe o código IATA de 3 letras do aeroporto de destino." };
      const hoje = new Date().toISOString().slice(0, 10);
      if (!ida || ida <= hoje) return { erro: "A data de ida precisa ser futura. Pergunte a data para a pessoa." };
      if (volta && volta < ida) return { erro: "A volta não pode ser antes da ida." };

      const resposta = await buscarPassagemAoVivo({ origem: origem as string, destino: destino as string, ida, volta });
      if (!resposta.ok) {
        return { ofertas: [], aviso: "Não consegui pesquisar as passagens agora. Diga isso com honestidade, não cite nenhum preço e ofereça tentar de novo mais tarde." };
      }
      const { companhias, melhor, nivel, faixa } = resposta.resultado;
      if (!melhor || !melhor.preco) {
        return { ofertas: [], aviso: "Não encontrei voos para essas datas. Diga isso e sugira tentar outras datas ou aeroportos próximos." };
      }

      const curto = await linkCurtoDisponivel();
      const link = curto ? `${urlBaseLinks()}/r/${await guardarLinkCurto(melhor.link)}` : melhor.link;
      const texto_pronto = formatarCartaoBusca({
        origem: textoArg(args, "origem_nome") ?? perfil?.cidade_origem ?? (origem as string),
        destino: textoArg(args, "destino_nome") ?? (destino as string),
        ida,
        volta,
        preco: melhor.preco,
        nivel,
        faixa,
        voo: melhor.voo_ida,
        link,
      });
      return {
        texto_pronto,
        comparativo_pronto: formatarComparativo(companhias) || null,
        preco_hoje: melhor.preco,
        companhia: melhor.companhia,
        voo_volta: melhor.voo_volta,
        instrucao:
          "Pesquisa feita agora no Google Voos. Envie o texto_pronto exatamente como está (inclusive o link) e, logo depois, o comparativo_pronto se existir. Não invente nada além disso. Termine com uma pergunta curta, por exemplo se ela quer que você acompanhe esse destino.",
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
