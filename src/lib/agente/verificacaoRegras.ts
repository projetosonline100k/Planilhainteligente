export type VooBasico = { price?: number; flights?: unknown[]; total_duration?: number };

// Mais barato; no empate, o com menos escalas e depois o mais curto.
export function escolherMaisBarato<T extends VooBasico>(voos: T[]): T | null {
  const validos = voos.filter((voo) => typeof voo.price === "number" && voo.price > 0);
  if (!validos.length) return null;
  return [...validos].sort(
    (a, b) =>
      (a.price as number) - (b.price as number) ||
      (a.flights?.length ?? 99) - (b.flights?.length ?? 99) ||
      (a.total_duration ?? Number.MAX_SAFE_INTEGER) - (b.total_duration ?? Number.MAX_SAFE_INTEGER)
  )[0];
}

export function descontoReal(real: number, normal: number | null | undefined): number | null {
  if (!normal || normal <= 0 || real <= 0) return null;
  return Math.round((1 - real / normal) * 100) || 0;
}

// A oferta só segue se, com o preço de hoje, ainda for uma boa passagem.
export function ofertaAprovada(args: { real: number; anunciado: number; normal: number | null | undefined; descontoMinimo: number }): boolean {
  const desconto = descontoReal(args.real, args.normal);
  if (desconto !== null) return desconto >= args.descontoMinimo;
  return args.real <= args.anunciado * 1.1;
}
