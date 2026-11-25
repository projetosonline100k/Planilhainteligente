import { AgenteConfig, Contato } from "@/types/agente";

export type EtapaConversa = "nome" | "estado" | "destino" | "livre";

type PerfilDoContato = Pick<Contato, "nome_preferido" | "estado" | "cidade_origem" | "destino_perguntado">;

// A etapa vem dos dados já guardados: a pessoa só avança quando o agente consegue salvar o que perguntou.
export function etapaDoContato(contato: PerfilDoContato): EtapaConversa {
  if (!contato.nome_preferido) return "nome";
  if (!contato.estado && !contato.cidade_origem) return "estado";
  if (!contato.destino_perguntado) return "destino";
  return "livre";
}

export function etapaInicial(etapa: EtapaConversa): boolean {
  return etapa === "nome" || etapa === "estado";
}

const AEROPORTOS_POR_ESTADO = `AC Rio Branco (RBR) · AL Maceió (MCZ) · AP Macapá (MCP) · AM Manaus (MAO) · BA Salvador (SSA) · CE Fortaleza (FOR) · DF Brasília (BSB) · ES Vitória (VIX) · GO Goiânia (GYN) · MA São Luís (SLZ) · MT Cuiabá (CGB) · MS Campo Grande (CGR) · MG Belo Horizonte (CNF, Confins; Pampulha é PLU) · PA Belém (BEL) · PB João Pessoa (JPA) · PR Curitiba (CWB) · PE Recife (REC) · PI Teresina (THE) · RJ Rio de Janeiro (GIG, Galeão; Santos Dumont é SDU) · RN Natal (NAT) · RS Porto Alegre (POA) · RO Porto Velho (PVH) · RR Boa Vista (BVB) · SC Florianópolis (FLN) · SP São Paulo (GRU, Guarulhos; Congonhas é CGH; Viracopos é VCP) · SE Aracaju (AJU) · TO Palmas (PMW)`;

const DESCOBERTA = `### Ajudar a descobrir o destino (quando ela pedir ajuda ou disser que não sabe para onde ir)
Converse como um amigo que entende de viagem. Faça UMA pergunta curta por mensagem, nesta ordem de interesse (pule o que ela já respondeu):
1. Que tipo de viagem ela curte: praia, natureza e aventura, cidade e cultura, frio e neve, gastronomia, descanso.
2. Com quem vai e quando pretende ir (mês) e por quantos dias.
3. Quanto pretende gastar mais ou menos e se quer viajar pelo Brasil ou para fora.
Depois de 2 ou 3 respostas, sugira de 2 a 3 destinos, cada um com um motivo curto, e pergunte qual ela quer que você acompanhe. Quando ela escolher, salve com salvar_viagem_desejada, pergunte as datas e pesquise com buscar_passagem.`;

export function instrucoesEtapa(etapa: EtapaConversa, contato: Contato, config: AgenteConfig, primeiraConversa: boolean): string {
  const nome = contato.nome_preferido;
  const origem = [contato.cidade_origem, contato.aeroporto_origem ? `(${contato.aeroporto_origem})` : null].filter(Boolean).join(" ");

  if (etapa === "nome") {
    const regras = primeiraConversa
      ? `- Esta é a PRIMEIRA mensagem dela. Apresente-se como ${config.nome}, assistente do Vai Viajar, e pergunte o nome. Use este texto, adaptando só de leve: """${config.boasVindas}"""
- Se ela já pediu algo (um destino, uma passagem), diga em UMA frase curta que já vai cuidar disso assim que se conhecerem. Não responda o pedido agora, não busque ofertas e não salve viagens.`
      : `- Você já se apresentou. Se a mensagem dela traz o nome, salve com salvar_perfil e, na MESMA resposta, diga "Prazer, <nome>!" e pergunte de qual estado ela é (só isso).
- Se a mensagem não traz o nome, responda em uma linha o que ela disse, sem aprofundar, e pergunte de novo, com leveza, como pode chamá-la. Não busque ofertas nem salve viagens.`;
    return `## Etapa atual: se apresentar e saber o nome
Vocês ainda não se conhecem. Aja como alguém que acabou de ser apresentado a uma pessoa: natural, simpático e sem despejar informação. Uma pergunta por mensagem.
${regras}`;
  }

  if (etapa === "estado") {
    return `## Etapa atual: saber de onde ela viaja (estado e aeroporto)
O nome dela é ${nome}. Falta saber de qual estado ela é, para definir o aeroporto de saída. Uma pergunta por mensagem.
- Se a mensagem traz o estado (ou a cidade): salve com salvar_perfil (estado, cidade_origem e aeroporto) usando a tabela abaixo e, na MESMA resposta, confirme o aeroporto, por exemplo: "Então o aeroporto que vou usar pra você é o de Goiânia (GYN), pode ser?". Se o estado tem mais de um aeroporto importante (SP, RJ, MG), pergunte qual fica mais perto.
- Se não trouxe, pergunte de qual estado ela é.
- Não busque ofertas nem salve viagens ainda.
Aeroportos de referência: ${AEROPORTOS_POR_ESTADO}`;
  }

  if (etapa === "destino") {
    return `## Etapa atual: descobrir o próximo destino
Ela é ${nome} e sai de ${origem || "um lugar que você já anotou"}. Uma pergunta por mensagem.
- Se a mensagem dela corrige o aeroporto ou a cidade, atualize com salvar_perfil e confirme em uma linha.
- Se ela já comentou algum destino ou data ANTES nesta conversa (olhe o histórico), retome com naturalidade, por exemplo: "Você tinha comentado de Paris de 15/12 a 23/12, é isso mesmo? Quer que eu procure passagens?". Se ela confirmar, salve com salvar_viagem_desejada e pesquise as passagens com buscar_passagem (se faltar a data de ida ou de volta, pergunte).
- Se ela não falou de destino nenhum, pergunte: "Já tem em mente qual vai ser o seu próximo destino? Ou prefere que eu te ajude a escolher?"
- Não pesquise passagens antes de ela dizer que quer ver.

${DESCOBERTA}`;
  }

  return `## Conversa
Você conhece ${nome} e sabe que ela sai de ${origem || "um lugar que você já anotou"}. Chame pelo nome de vez em quando, sem exagerar. Use essa origem nas buscas quando ela não disser outra.

${DESCOBERTA}`;
}
