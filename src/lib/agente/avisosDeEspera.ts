export type MarcoDeEspera = { aposMs: number; texto: string };

export const MENSAGEM_INICIO = "⏳ Já estou pesquisando as passagens pra você. Leva cerca de 30 segundos!";

export const MARCOS_PADRAO: MarcoDeEspera[] = [
  {
    aposMs: 30_000,
    texto:
      "⏳ Está demorando mais que o normal. O Google Voos está lento agora e eu preciso conferir o preço certinho de cada companhia.\n\nVou levar mais uns 2 minutinhos. Assim que terminar, te mando o resultado!",
  },
  {
    aposMs: 110_000,
    texto: "⏳ Ainda estou conferindo: o Google continua devagar. Mais 1 ou 2 minutinhos e te mando, tá? Não esqueci de você 😉",
  },
];

// Dispara os avisos de demora enquanto a pesquisa não termina. Devolve a função que cancela os que ainda não saíram.
export function iniciarAvisosDeDemora(
  enviar: (texto: string) => Promise<void>,
  marcos: MarcoDeEspera[] = MARCOS_PADRAO,
  fator = 1
): () => void {
  const temporizadores = marcos.map((marco) =>
    setTimeout(() => {
      enviar(marco.texto).catch(() => {});
    }, marco.aposMs * fator)
  );
  return () => temporizadores.forEach((temporizador) => clearTimeout(temporizador));
}
