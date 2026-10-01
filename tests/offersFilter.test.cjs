const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: () => { throw new Error("Unexpected import"); } });
  return exports;
}

const lib = load("src/lib/offersFilter.ts");

function oferta(sobrescreve) {
  return {
    id: "id",
    origin_code: "BSB",
    origin_name: "Brasília",
    destination_code: "CFB",
    destination_name: "Cabo Frio",
    price: 1000,
    typical_price: 2000,
    savings_percentage: 50,
    savings_amount: 1000,
    outbound_date: "2026-12-06",
    return_date: "2026-12-13",
    image_url: null,
    status: "active",
    last_checked_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...sobrescreve,
  };
}

const OFERTAS = [
  oferta({ id: "a", origin_name: "Brasília", origin_code: "BSB", destination_name: "Cabo Frio", destination_code: "CFB", price: 1628, savings_percentage: 75 }),
  oferta({ id: "b", origin_name: "Belo Horizonte", origin_code: "CNF", destination_name: "Caldas Novas", destination_code: "CLV", price: 872, savings_percentage: 70 }),
  oferta({ id: "c", origin_name: "Recife", origin_code: "REC", destination_name: "Petrolina", destination_code: "PNZ", price: 496, savings_percentage: 69 }),
];

test("origem e destino vazios: retorna todas as ofertas", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "", destino: "", ordem: "relevantes" });
  assert.equal(resultado.length, 3);
});

test("filtra por origem (nome), ignorando maiúsculas/acentos", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "brasilia", destino: "", ordem: "relevantes" });
  assert.deepEqual([...resultado].map((o) => o.id), ["a"]);
});

test("filtra por destino (código IATA)", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "", destino: "CLV", ordem: "relevantes" });
  assert.deepEqual([...resultado].map((o) => o.id), ["b"]);
});

test("combina filtro de origem e destino", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "recife", destino: "petrolina", ordem: "relevantes" });
  assert.deepEqual([...resultado].map((o) => o.id), ["c"]);
});

test("filtro sem correspondência: retorna lista vazia", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "tóquio", destino: "", ordem: "relevantes" });
  assert.equal(resultado.length, 0);
});

test("ordem 'desconto': maior savings_percentage primeiro", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "", destino: "", ordem: "desconto" });
  assert.deepEqual([...resultado].map((o) => o.id), ["a", "b", "c"]);
});

test("ordem 'preco': menor price primeiro", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "", destino: "", ordem: "preco" });
  assert.deepEqual([...resultado].map((o) => o.id), ["c", "b", "a"]);
});

test("ordem 'relevantes': preserva a ordem recebida (já vem ordenada pela API)", () => {
  const resultado = lib.filtrarOrdenarOfertas(OFERTAS, { origem: "", destino: "", ordem: "relevantes" });
  assert.deepEqual([...resultado].map((o) => o.id), ["a", "b", "c"]);
});
