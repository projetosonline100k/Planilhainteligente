export type NivelPreco = "low" | "typical" | "high";

export type LinhaVoo = {
  companhia: string;
  preco: number;
  escalas: number;
  minutos: number;
  saida: string;
  chegada: string;
  rota: string;
};

function campo(tag: number, conteudo: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag, conteudo.length]), conteudo]);
}

function trecho(data: string, de: string, para: string): Buffer {
  const aeroporto = (codigo: string) => Buffer.concat([Buffer.from([0x08, 0x01]), campo(0x12, Buffer.from(codigo))]);
  return campo(0x1a, Buffer.concat([campo(0x12, Buffer.from(data)), campo(0x6a, aeroporto(de)), campo(0x72, aeroporto(para))]));
}

// Mesmo parâmetro "tfs" que o próprio Google Voos usa nos links de busca.
export function montarTfs(de: string, para: string, ida: string, volta: string | null): string {
  const partes = [
    Buffer.from([0x08, 0x1c, 0x10, 0x02]),
    trecho(ida, de, para),
    ...(volta ? [trecho(volta, para, de)] : []),
    Buffer.from([0x40, 0x01, 0x48, 0x01, 0x70, 0x01, 0x98, 0x01, volta ? 0x01 : 0x02]),
  ];
  return Buffer.concat(partes).toString("base64").replace(/=+$/, "");
}

export function urlDaBusca(de: string, para: string, ida: string, volta: string | null): string {
  return `https://www.google.com/travel/flights?hl=pt&gl=br&curr=BRL&tfs=${montarTfs(de, para, ida, volta)}&tfu=EgIIAg`;
}

// Link final que a pessoa abre: o voo vai no tfs. O tfu que o Google gera na sessão do robô é um código longo que
// deixa a página lenta em outro navegador; o tfu simples abre a mesma reserva em poucos segundos.
export function linkParaCompartilhar(url: string): string {
  const destino = new URL(url);
  destino.searchParams.set("hl", "pt");
  destino.searchParams.set("gl", "br");
  destino.searchParams.set("curr", "BRL");
  destino.searchParams.set("tfu", "EgIIAQ");
  return destino.toString();
}

const HORA = /^\d{1,2}:\d{2}(\+\d)?$/;

// Lê um voo da lista, no texto como o Google mostra:
// "06:15 – 07:35 / Gol / 1h 20 min / CGH–CNF / Sem escalas / ... / R$ 633 / ida e volta"
export function lerLinhaVoo(texto: string): LinhaVoo | null {
  const partes = texto
    .split(/\n+/)
    .map((parte) => parte.trim())
    .filter(Boolean);
  if (partes.length < 7 || !HORA.test(partes[0]) || partes[1] !== "–" || !HORA.test(partes[2])) return null;
  // Compra em bilhetes separados (autotransferência): arriscada para o cliente, não entra na escolha.
  if (/passagens?\s+separadas|bilhetes?\s+separados/i.test(texto)) return null;

  let posicao = 3;
  while (partes[posicao] && /^\+\d$/.test(partes[posicao])) posicao += 1;
  const companhia = (partes[posicao] ?? "").replace(/Operado por.*$/i, "").trim();
  const duracao = partes[posicao + 1] ?? "";
  const rota = partes[posicao + 2] ?? "";
  const paradas = partes[posicao + 3] ?? "";

  const precos = [...texto.matchAll(/R\$\s*([\d.]+)/g)];
  const bruto = precos.length ? precos[precos.length - 1][1] : null;
  const preco = bruto ? Number(bruto.replace(/\./g, "")) : NaN;
  if (!companhia || !Number.isFinite(preco) || preco <= 0) return null;

  const horas = /(\d+)\s*h/.exec(duracao);
  const minutos = /(\d+)\s*min/.exec(duracao);
  const escalas = /sem escalas/i.test(paradas) ? 0 : Number(/(\d+)\s*(?:escala|parada)/i.exec(paradas)?.[1] ?? 1);

  return {
    companhia,
    preco,
    escalas,
    minutos: (horas ? Number(horas[1]) * 60 : 0) + (minutos ? Number(minutos[1]) : 0) || 99_999,
    saida: partes[0],
    chegada: partes[2],
    rota,
  };
}

// Posição do mais barato; no empate, menos escalas e depois o mais curto.
export function indiceDoMaisBarato(linhas: LinhaVoo[]): number {
  let melhor = -1;
  linhas.forEach((linha, indice) => {
    if (melhor === -1) {
      melhor = indice;
      return;
    }
    const atual = linhas[melhor];
    if (
      linha.preco < atual.preco ||
      (linha.preco === atual.preco && (linha.escalas < atual.escalas || (linha.escalas === atual.escalas && linha.minutos < atual.minutos)))
    ) {
      melhor = indice;
    }
  });
  return melhor;
}

export function menorPrecoPorCompanhia(linhas: LinhaVoo[], limite = 4): Array<{ companhia: string; preco: number; escalas: number }> {
  const menores = new Map<string, { companhia: string; preco: number; escalas: number }>();
  for (const linha of linhas) {
    const atual = menores.get(linha.companhia);
    if (!atual || linha.preco < atual.preco || (linha.preco === atual.preco && linha.escalas < atual.escalas)) {
      menores.set(linha.companhia, { companhia: linha.companhia, preco: linha.preco, escalas: linha.escalas });
    }
  }
  return [...menores.values()].sort((a, b) => a.preco - b.preco || a.escalas - b.escalas).slice(0, limite);
}

export function lerNivelPreco(texto: string): NivelPreco | null {
  const achado = /pre[çc]os?\s+est(?:ão|a|á)o?\s+(baixos?|normais|normal|altos?|elevados?)/i.exec(texto);
  if (!achado) return null;
  const palavra = achado[1].toLowerCase();
  if (palavra.startsWith("baix")) return "low";
  if (palavra.startsWith("alto") || palavra.startsWith("elev")) return "high";
  return "typical";
}

export function descreverVoo(linha: LinhaVoo): string {
  const escalas = linha.escalas === 0 ? "sem escalas" : `${linha.escalas} escala${linha.escalas > 1 ? "s" : ""}`;
  const chegada = linha.chegada.replace(/\+(\d)/, " (+$1 dia)");
  return `${linha.companhia} · ${linha.saida} → ${chegada} · ${escalas}`;
}

export function mesmoVoo(a: LinhaVoo, b: LinhaVoo): boolean {
  return a.companhia === b.companhia && a.saida === b.saida && a.chegada === b.chegada;
}

// O melhor voo de cada companhia, das mais baratas, para conferir o preço real de ida e volta de cada uma.
export function escolherCandidatos(linhas: LinhaVoo[], maximo = 3): LinhaVoo[] {
  const porCompanhia = new Map<string, LinhaVoo>();
  for (const linha of linhas) {
    const atual = porCompanhia.get(linha.companhia);
    if (!atual || indiceDoMaisBarato([atual, linha]) === 1) porCompanhia.set(linha.companhia, linha);
  }
  const candidatos = [...porCompanhia.values()];
  return candidatos.sort((a, b) => indiceDoMaisBarato([a, b]) - indiceDoMaisBarato([b, a]) || 0).slice(0, maximo);
}
