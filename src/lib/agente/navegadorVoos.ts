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

let inicioDoLog = Date.now();
function registrar(etapa: string) {
  if (process.env.NAVEGADOR_LOG) console.log(`[navegador ${((Date.now() - inicioDoLog) / 1000).toFixed(1)}s] ${etapa}`);
}

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
      registrar(`Google respondeu "Algo deu errado" ao abrir; clicando em Atualizar (${recargas})`);
      await page.getByRole("button", { name: "Atualizar" }).click().catch(() => {});
    }
    await esperar(1500);
  }
  throw new Error("O Google Voos não mostrou os voos agora.");
}

// Ordena por menor preço. O Google às vezes responde "Algo deu errado" depois do clique: o botão Atualizar resolve.
// Devolve false se a lista não voltou, para quem chamou usar a lista sem ordenar.
async function ordenarPorPreco(page: Page): Promise<boolean> {
  const aba = page.getByText("Menores preços").first();
  if (!(await aba.isVisible().catch(() => false))) return true;
  await aba.click().catch(() => {});

  let recargas = 0;
  for (let tentativa = 0; tentativa < 14; tentativa += 1) {
    await esperar(1000);
    if ((await lerLista(page)).length > 0) return true;
    if (/Algo deu errado/i.test(await textoDaPagina(page)) && recargas < 2) {
      recargas += 1;
      registrar(`Google respondeu "Algo deu errado" ao ordenar; clicando em Atualizar (${recargas})`);
      await page.getByRole("button", { name: "Atualizar" }).click().catch(() => {});
    }
  }
  return false;
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
  registrar("página aberta");
  await aguardarVoos(page);
  registrar("voos apareceram");
  const ordenou = await ordenarPorPreco(page);
  registrar(ordenou ? "ordenado por preço" : "ordenação falhou");
  const lista = ordenou ? await lerLista(page) : [];
  if (lista.length) return lista;

  // A ordenação não funcionou: abre de novo e usa a lista como o Google mostra (os melhores voos).
  registrar("reabrindo a busca sem ordenar");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await aguardarVoos(page);
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
  inicioDoLog = Date.now();
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
      // Cada companhia tem uma segunda chance: o Google falha de vez em quando e isso não pode mudar qual é a mais barata.
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        try {
          if (posicao > 0 || tentativa > 0) idas = await abrirBusca(page, busca);
          const resultado = await conferirCandidato(page, candidatos[posicao], idas, Boolean(pedido.volta), busca);
          if (resultado) {
            conferidos.push(resultado);
            break;
          }
          registrar(`${candidatos[posicao].companhia}: não consegui fechar o preço (tentativa ${tentativa + 1})`);
        } catch (erro) {
          if (bloqueadoAte > Date.now()) throw erro;
          registrar(`${candidatos[posicao].companhia}: erro (tentativa ${tentativa + 1})`);
        }
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

async function comSegundaTentativa(pedido: PedidoNavegador): Promise<ResultadoNavegador> {
  try {
    const primeira = await executar(pedido);
    if (primeira.melhor) return primeira;
    registrar("primeira tentativa sem voos; tentando de novo");
  } catch (erro) {
    registrar(`primeira tentativa falhou: ${erro instanceof Error ? erro.message : erro}`);
    if (bloqueadoAte > Date.now()) throw erro;
  }
  return executar(pedido);
}

// Uma pesquisa por vez: evita abrir vários Chromes e pedir demais ao Google.
export function pesquisarNoNavegador(pedido: PedidoNavegador): Promise<ResultadoNavegador> {
  const execucao = fila.then(
    () => comSegundaTentativa(pedido),
    () => comSegundaTentativa(pedido)
  );
  fila = execucao.catch(() => undefined);
  return execucao;
}
