export type Plano = {
  id: "anual" | "trimestral" | "mensal";
  nome: string;
  checkoutUrl: string;
  chamada: string;
  preco: string;
  periodo: string;
  equivalenteMensal?: string;
  economia?: string;
  vantagens: string[];
  selo?: string;
};

export const PLANOS: Plano[] = [
  {
    id: "anual",
    nome: "Anual",
    checkoutUrl: "https://pay.kiwify.com.br/SbPhvJq",
    selo: "Mais escolhido",
    chamada: "Para quem quer viajar o ano todo pagando menos.",
    preco: "R$ 359,90",
    periodo: "por ano",
    equivalenteMensal: "R$ 29,99/mês",
    economia: "Economize R$ 238,90 em relação ao mensal",
    vantagens: [
      "+300 promoções por dia, com até 75% de desconto",
      "Saindo das 27 capitais, para o Brasil e o exterior",
      "Radar personalizado para as suas rotas",
      "Aviso no WhatsApp quando aparecer promoção",
      "Alertas de preço no celular para a rota que você quer",
      "Planilha inteligente vitalícia: saiba quanto guardar por mês para a viagem dos sonhos",
      "Área de membros",
      "12 meses de radar ligado: feriados, férias e alta temporada",
      "O menor preço por mês. Uma única passagem em promoção já paga o plano",
    ],
  },
  {
    id: "trimestral",
    nome: "Trimestral",
    checkoutUrl: "https://pay.kiwify.com.br/L50c50b",
    chamada: "Para quem já tem uma viagem em vista.",
    preco: "R$ 129,90",
    periodo: "a cada 3 meses",
    equivalenteMensal: "R$ 43,30/mês",
    economia: "Economize R$ 19,80 em relação ao mensal",
    vantagens: [
      "+300 promoções por dia, com até 75% de desconto",
      "Saindo das 27 capitais, para o Brasil e o exterior",
      "Alertas de preço no celular para a rota que você quer",
      "Planilha inteligente: saiba quanto guardar por mês para a viagem dos sonhos",
      "Área de membros",
      "3 meses para planejar e pegar a promoção certa da sua próxima viagem",
    ],
  },
  {
    id: "mensal",
    nome: "Mensal",
    checkoutUrl: "https://pay.kiwify.com.br/yXeS4OJ",
    chamada: "Para experimentar.",
    preco: "R$ 49,90",
    periodo: "por mês",
    vantagens: ["+300 promoções por dia, com até 75% de desconto", "Acesso às promoções do radar por 1 mês", "Área de membros"],
  },
];
