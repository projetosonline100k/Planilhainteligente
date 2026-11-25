// Regras do disparo de ofertas no grupo do WhatsApp (o que antes ficava no n8n + WhApi).

export const HORARIOS_GRUPO = [9, 12, 18, 20];
export const MAX_POR_HORARIO = 10;
export const DESCONTO_MINIMO_GRUPO = 20;
const COTAS: Record<string, number> = { "São Paulo": 3, "Rio de Janeiro": 3, "Goiânia": 3 };

const AEROPORTOS_BRASIL = new Set(
  ("AJU ALT ARU ATM AUX BAZ BEL BGX BPS BRA BSB BVB BYO CAC CAW CCM CDJ CFB CGB CGH CGR CIZ CKS CLV CMG CNF CPV CWB CXJ CZS DOU ERN FEN FLN FOR GEL GIG GNM GPB GRU GVR GYN IGU IMP IOS IPN ITB IZA JDF JDO JJD JJG JOI JPA JPR JTC LAJ LDB LEC MAB MAO MCP MCZ MEA MGF MII MOC MQH MVF NAT NVT OPS PAV PET PFB PHB PLU PMG PMW PNB PNZ POA PPB PVH RAO RBR REC RIA ROO RVD SDU SJK SJP SLZ SOD SSA STM SXO TBT TFF THE TJL TMT TUR TXF UBA UDI UNA URG VAG VCP VDC VIX XAP").split(" ")
);

export type OfertaGrupo = {
  id: string;
  origin_name: string;
  destination_name: string;
  destination_code: string | null;
  price: number | string;
  typical_price: number | string | null;
  savings_percentage: number | null;
  savings_amount: number | string | null;
  outbound_date: string | null;
  return_date: string | null;
};

export function ehInternacional(oferta: Pick<OfertaGrupo, "destination_code">): boolean {
  return !AEROPORTOS_BRASIL.has(String(oferta.destination_code ?? "").toUpperCase());
}

// Horário do Brasil (UTC-3, sem horário de verão). Só dispara nos primeiros 50 minutos de cada horário,
// para o Mac ligado mais tarde não soltar ofertas atrasadas.
export function horarioDeDisparo(agora: Date): { chave: string; hora: number } | null {
  const brasil = new Date(agora.getTime() - 3 * 60 * 60_000);
  const hora = brasil.getUTCHours();
  if (!HORARIOS_GRUPO.includes(hora) || brasil.getUTCMinutes() >= 50) return null;
  return { chave: `${brasil.toISOString().slice(0, 10)}-${hora}`, hora };
}

export function escolherLote<T extends OfertaGrupo>(candidatas: T[], quantidade = MAX_POR_HORARIO): T[] {
  const ordenadas = [...candidatas].sort((a, b) => (b.savings_percentage ?? 0) - (a.savings_percentage ?? 0));
  const escolhidas: T[] = [];
  const usadas = new Set<string>();
  const escolher = (oferta: T) => {
    if (escolhidas.length >= quantidade || usadas.has(oferta.id)) return;
    escolhidas.push(oferta);
    usadas.add(oferta.id);
  };

  const proporcao = quantidade / MAX_POR_HORARIO;
  for (const [cidade, cota] of Object.entries(COTAS)) {
    ordenadas.filter((oferta) => oferta.origin_name === cidade).slice(0, Math.max(1, Math.round(cota * proporcao))).forEach(escolher);
  }
  ordenadas.forEach(escolher);

  if (escolhidas.length && !escolhidas.some(ehInternacional)) {
    const internacional = ordenadas.find((oferta) => ehInternacional(oferta) && !usadas.has(oferta.id));
    if (internacional) escolhidas[escolhidas.length - 1] = internacional;
  }
  return escolhidas;
}

function reais(valor: number | string): string {
  return Math.round(Number(valor)).toLocaleString("pt-BR");
}

function dataBr(data: string | null): string {
  return data ? data.split("-").reverse().join("/") : "";
}

// Mesmo texto que o grupo já recebia; o link vai sem hífens porque o WhatsApp confunde o id com chave Pix.
export function mensagemDoGrupo(oferta: OfertaGrupo, baseUrl: string): string {
  const linhas = [
    `🚨 *${oferta.savings_percentage}% abaixo do normal*`,
    "",
    `✈️ ${oferta.origin_name} → ${oferta.destination_name}`,
    "",
    `💰 *R$ ${reais(oferta.price)} ${oferta.return_date ? "ida e volta" : "só ida"}*`,
  ];
  if (oferta.typical_price) {
    const economia = oferta.savings_amount ?? Math.max(0, Number(oferta.typical_price) - Number(oferta.price));
    linhas.push(`📊 Preço normal: R$ ${reais(oferta.typical_price)}`, `💸 *Você economiza R$ ${reais(economia)}*`);
  }
  linhas.push(
    "",
    `📅 ${dataBr(oferta.outbound_date)}${oferta.return_date ? ` a ${dataBr(oferta.return_date)}` : ""}`,
    "",
    "🔒 *Acesse no VaiViajar*",
    "",
    "🔗 Ver oferta:",
    `${baseUrl}/o/${oferta.id.replace(/-/g, "").toLowerCase()}`
  );
  return linhas.join("\n");
}
