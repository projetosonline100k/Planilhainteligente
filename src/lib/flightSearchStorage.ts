export type BuscaSalva = { origin: string; destination: string; outboundDate: string; returnDate: string; adults: number; salvaEm: number };
const RECENTES = "viagem:buscas-recentes"; const FAVORITAS = "viagem:rotas-favoritas"; const LIMITE = 5;
function ler(chave: string): BuscaSalva[] { try { return JSON.parse(localStorage.getItem(chave) || "[]"); } catch { return []; } }
function gravar(chave: string, buscas: BuscaSalva[]) { localStorage.setItem(chave, JSON.stringify(buscas)); return buscas; }
function id(busca: BuscaSalva) { return `${busca.origin}-${busca.destination}`; }
export function listarRecentes() { return ler(RECENTES); }
export function adicionarRecente(busca: BuscaSalva) { return gravar(RECENTES, [busca, ...ler(RECENTES).filter((item) => JSON.stringify({ ...item, salvaEm: 0 }) !== JSON.stringify({ ...busca, salvaEm: 0 }))].slice(0, LIMITE)); }
export function listarFavoritas() { return ler(FAVORITAS); }
export function alternarFavorita(busca: BuscaSalva) { const atuais = ler(FAVORITAS); const existe = atuais.some((item) => id(item) === id(busca)); return gravar(FAVORITAS, existe ? atuais.filter((item) => id(item) !== id(busca)) : [busca, ...atuais]); }
export function rotaFavorita(busca: BuscaSalva, favoritas: BuscaSalva[]) { return favoritas.some((item) => id(item) === id(busca)); }
