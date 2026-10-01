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

const lib = load("src/lib/offersRelevance.ts");

function oferta(sobrescreve) {
  return {
    id: "id",
    origin_code: "GRU",
    origin_name: "São Paulo",
    destination_code: "FCO",
    destination_name: "Roma",
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

const ROTA_SP_ROMA = { origin_code: "GRU", origin_name: "São Paulo", destination_code: "FCO", destination_name: "Roma" };

test("1. origem e destino da rota batem -> combina", () => {
  const bate = oferta({ id: "bate", origin_name: "São Paulo", origin_code: "GRU", destination_name: "Roma", destination_code: "FCO" });
  assert.equal(lib.ofertaCombinaComRota(bate, ROTA_SP_ROMA), true);
});

test("2. so a origem bate, destino diferente -> nao combina (precisa das duas pontas)", () => {
  const so_origem = oferta({ id: "so-origem", origin_name: "São Paulo", origin_code: "GRU", destination_name: "Recife", destination_code: "REC" });
  assert.equal(lib.ofertaCombinaComRota(so_origem, ROTA_SP_ROMA), false);
});

test("3. so o destino bate, origem diferente -> nao combina", () => {
  const so_destino = oferta({ id: "so-destino", origin_name: "Brasília", origin_code: "BSB", destination_name: "Roma", destination_code: "FCO" });
  assert.equal(lib.ofertaCombinaComRota(so_destino, ROTA_SP_ROMA), false);
});

test("4. nenhuma ponta bate -> nao combina", () => {
  const nenhuma = oferta({ id: "nenhuma", origin_name: "Brasília", origin_code: "BSB", destination_name: "Recife", destination_code: "REC" });
  assert.equal(lib.ofertaCombinaComRota(nenhuma, ROTA_SP_ROMA), false);
});

test("5. codes tem prioridade sobre nomes quando ambos disponiveis", () => {
  const rota = { origin_code: "GRU", origin_name: "Guarulhos", destination_code: "FCO", destination_name: "Roma" };
  const combinaPorCode = oferta({ origin_code: "GRU", origin_name: "Nome completamente diferente" });
  assert.equal(lib.ofertaCombinaComRota(combinaPorCode, rota), true);
});

test("6. fallback por nome normalizado quando nao ha code em algum dos lados", () => {
  const rota = { origin_code: null, origin_name: "São Paulo", destination_code: null, destination_name: "Roma" };
  const oferta1 = oferta({ origin_code: null, destination_code: null });
  assert.equal(lib.ofertaCombinaComRota(oferta1, rota), true);
});

test("7. acentos e maiusculas nao atrapalham o fallback por nome", () => {
  const rota = { origin_code: null, origin_name: "sao paulo", destination_code: null, destination_name: "ROMA" };
  const oferta1 = oferta({ origin_code: null, destination_code: null, origin_name: "São Paulo", destination_name: "Roma" });
  assert.equal(lib.ofertaCombinaComRota(oferta1, rota), true);
});

test("limitacao documentada: destino amplo (pais) nao combina com cidade sem correspondencia exata", () => {
  const rota = { origin_code: "GRU", origin_name: "São Paulo", destination_code: null, destination_name: "Itália" };
  const oferta1 = oferta({ destination_code: "FCO", destination_name: "Roma" });
  assert.equal(lib.ofertaCombinaComRota(oferta1, rota), false);
});

test("ofertasDaRota: filtra somente as ofertas que combinam com a rota", () => {
  const bate = oferta({ id: "bate" });
  const naoBate = oferta({ id: "nao-bate", destination_name: "Recife", destination_code: "REC" });
  const resultado = lib.ofertasDaRota([bate, naoBate], ROTA_SP_ROMA);
  assert.deepEqual(resultado.map((o) => o.id), ["bate"]);
});

test("ofertaCombinaComAlgumaRota: verdadeiro se bater com qualquer uma das rotas acompanhadas", () => {
  const rotas = [ROTA_SP_ROMA, { origin_code: "GRU", origin_name: "São Paulo", destination_code: "GYN", destination_name: "Goiânia" }];
  const paraGoiania = oferta({ destination_name: "Goiânia", destination_code: "GYN" });
  const paraRecife = oferta({ destination_name: "Recife", destination_code: "REC" });
  assert.equal(lib.ofertaCombinaComAlgumaRota(paraGoiania, rotas), true);
  assert.equal(lib.ofertaCombinaComAlgumaRota(paraRecife, rotas), false);
});

test("ordenarPorRotas: ofertas que combinam com alguma rota vem primeiro", () => {
  const combina = oferta({ id: "combina", savings_percentage: 10 });
  const naoCombina = oferta({ id: "nao-combina", destination_name: "Recife", destination_code: "REC", savings_percentage: 90 });
  const resultado = lib.ordenarPorRotas([naoCombina, combina], [ROTA_SP_ROMA]);
  assert.deepEqual([...resultado].map((o) => o.id), ["combina", "nao-combina"]);
});

test("ordenarPorRotas: empate no mesmo grupo usa maior desconto primeiro", () => {
  const menor = oferta({ id: "menor", savings_percentage: 40 });
  const maior = oferta({ id: "maior", savings_percentage: 80 });
  const resultado = lib.ordenarPorRotas([menor, maior], [ROTA_SP_ROMA]);
  assert.deepEqual([...resultado].map((o) => o.id), ["maior", "menor"]);
});

test("ordenarPorRotas: sem nenhuma rota acompanhada, so ordena por desconto (nenhum tier)", () => {
  const a = oferta({ id: "a", savings_percentage: 90 });
  const b = oferta({ id: "b", savings_percentage: 10 });
  const resultado = lib.ordenarPorRotas([b, a], []);
  assert.deepEqual([...resultado].map((o) => o.id), ["a", "b"]);
});
