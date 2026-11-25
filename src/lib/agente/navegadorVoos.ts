import type { Page } from "playwright-core";
import {
  descreverVoo,
  escolherCandidatos,
  indiceDoMaisBarato,
  lerLinhaVoo,
  lerNivelPreco,
  linkParaCompartilhar,
  LinhaVoo,
  mesmoVoo,
  menorPrecoPorCompanhia,
  NivelPreco,
  urlDaBusca,
} from "@/lib/agente/leituraGoogleVoos";

export type PedidoNavegador = { origem: string; destino: string; ida: string; volta: string | null };

export type ResultadoNavegador = {
  companhias: Array<{ companhia: string; preco: number; escalas: number }>;
  melhor: { companhia: string; preco: number; escalas: number; voo_ida: string; voo_volta: string | null; link: string } | null;
  nivel: NivelPreco | null;
};

const PAUSA_APOS_VERIFICACAO_MS = 30 * 60_000;
let bloqueadoAte = 0;
let fila: Promise<unknown> = Promise.resolve();

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function textoDaPagina(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

type ItemDaLista = { indice: number; linha: LinhaVoo };

async function lerLista(page: Page): Promise<ItemDaLista[]> {
  const itens = await page.evaluate(() => [...document.querySelectorAll("li")].map((el, indice) => ({ indice, texto: (el as HTMLElement).innerText })));
  return itens.flatMap((item) => {
    const linha = lerLinhaVoo(item.texto);
    return linha ? [{ indice: item.indice, linha }] : [];
  });
}

// Espera os voos aparecerem. O Google às vezes responde "Algo deu errado": o botão Atualizar da própria página resolve.
async function aguardarVoos(page: Page): Promise<void> {
  let recargas = 0;
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    const texto = await textoDaPagina(page);
    if (/tr[áa]fego incomum|unusual traffic|verifique que voc[êe] [ée] humano|captcha/i.test(texto) || page.url().includes("/sorry/")) {
      bloqueadoAte = Date.now() + PAUSA_APOS_VERIFICACAO_MS;
      throw new Error("O Google pediu uma verificação de segurança. Não vou contornar isso; tento de novo mais tarde.");
    }
    if ((await lerLista(page)).length > 0) return;
    if (/Algo deu errado/i.test(texto) && recargas < 2) {
      recargas += 1;
      await page.getByRole("button", { name: "Atualizar" }).click().catch(() => {});
    }
    await esperar(1500);
  }
  throw new Error("O Google Voos não mostrou os voos agora.");
}

async function ordenarPorPreco(page: Page): Promise<void> {
  const aba = page.getByText("Menores preços").first();
  if (await aba.isVisible().catch(() => false)) {
    await aba.click().catch(() => {});
    await esperar(1500);
  }
}

async function esperarPagina(page: Page, condicao: () => Promise<boolean>, ms: number): Promise<boolean> {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (await condicao()) return true;
    await esperar(500);
  }
  return false;
}

type Conferido = { ida: LinhaVoo; volta: LinhaVoo | null; preco: number; link: string };

async function abrirBusca(page: Page, url: string): Promise<ItemDaLista[]> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await aguardarVoos(page);
  await ordenarPorPreco(page);
  return lerLista(page);
}

// Seleciona a ida e a volta mais baratas e devolve o preço real e o link da reserva.
async function conferirCandidato(page: Page, candidato: LinhaVoo, idas: ItemDaLista[], temVolta: boolean, busca: string): Promise<Conferido | null> {
  const item = idas.find((ida) => mesmoVoo(ida.linha, candidato));
  if (!item) return null;
  await page.locator("li").nth(item.indice).click();

  let volta: LinhaVoo | null = null;
  if (temVolta) {
    const mudou = await esperarPagina(page, async () => /Voos de volta|volta para/i.test((await textoDaPagina(page)).slice(0, 2000)), 15_000);
    if (!mudou) return null;
    await aguardarVoos(page);
    await ordenarPorPreco(page);
    const voltas = await lerLista(page);
    const escolhida = voltas[indiceDoMaisBarato(voltas.map((item) => item.linha))];
    if (!escolhida) return null;
    volta = escolhida.linha;
    await page.locator("li").nth(escolhida.indice).click();
  }

  const chegou = await esperarPagina(page, async () => page.url().includes("/flights/booking"), 15_000);
  return { ida: candidato, volta, preco: (volta ?? candidato).preco, link: chegou ? linkParaCompartilhar(page.url()) : busca };
}

async function executar(pedido: PedidoNavegador): Promise<ResultadoNavegador> {
  if (Date.now() < bloqueadoAte) throw new Error("O Google pediu uma verificação de segurança há pouco; vou esperar antes de tentar de novo.");

  const { chromium } = await import(/* webpackIgnore: true */ "playwright-core");
  const caminho = process.env.CHROME_PATH?.trim();
  const navegador = await chromium.launch(caminho ? { executablePath: caminho, headless: true } : { channel: "chrome", headless: true });

  try {
    const contexto = await navegador.newContext({ locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: 1280, height: 1000 } });
    const page = await contexto.newPage();
    page.setDefaultTimeout(20_000);

    const origem = pedido.origem.split(",")[0];
    const destino = pedido.destino.split(",")[0];
    const busca = urlDaBusca(origem, destino, pedido.ida, pedido.volta);

    let idas = await abrirBusca(page, busca);
    const nivel = lerNivelPreco(await textoDaPagina(page));
    const linhasDeIda = idas.map((item) => item.linha);
    if (!linhasDeIda.length) return { companhias: [], melhor: null, nivel };

    // O preço da lista de idas pode depender de uma volta em bilhete separado. Por isso confere o preço real de ida e volta
    // das companhias mais baratas (só uma, se for só ida, onde o preço da lista já é o real).
    const candidatos = escolherCandidatos(linhasDeIda, pedido.volta ? 3 : 1);
    const conferidos: Conferido[] = [];
    for (let posicao = 0; posicao < candidatos.length; posicao += 1) {
      try {
        if (posicao > 0) idas = await abrirBusca(page, busca);
        const resultado = await conferirCandidato(page, candidatos[posicao], idas, Boolean(pedido.volta), busca);
        if (resultado) conferidos.push(resultado);
      } catch (erro) {
        if (bloqueadoAte > Date.now()) throw erro;
      }
    }

    if (!conferidos.length) throw new Error("Não consegui fechar o preço de ida e volta.");
    conferidos.sort((a, b) => a.preco - b.preco || a.ida.escalas - b.ida.escalas || a.ida.minutos - b.ida.minutos);
    const melhor = conferidos[0];

    const comparativo = pedido.volta
      ? menorPrecoPorCompanhia(conferidos.map((item) => ({ ...item.ida, preco: item.preco })))
      : menorPrecoPorCompanhia(linhasDeIda);

    return {
      companhias: comparativo,
      nivel,
      melhor: {
        companhia: melhor.ida.companhia,
        preco: melhor.preco,
        escalas: melhor.ida.escalas,
        voo_ida: descreverVoo(melhor.ida),
        voo_volta: melhor.volta ? descreverVoo(melhor.volta) : null,
        link: melhor.link,
      },
    };
  } finally {
    await navegador.close();
  }
}

// Uma pesquisa por vez: evita abrir vários Chromes e pedir demais ao Google.
export function pesquisarNoNavegador(pedido: PedidoNavegador): Promise<ResultadoNavegador> {
  const execucao = fila.then(
    () => executar(pedido),
    () => executar(pedido)
  );
  fila = execucao.catch(() => undefined);
  return execucao;
}
