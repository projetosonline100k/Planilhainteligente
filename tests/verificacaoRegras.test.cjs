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
  vm.runInNewContext(code, { exports, Math, Number });
  return exports;
}

const { escolherMaisBarato, descontoReal, ofertaAprovada } = load("src/lib/agente/verificacaoRegras.ts");

test("escolhe o mais barato e desempata por menos escalas e menor duração", () => {
  const voos = [
    { price: 700, flights: [{}], total_duration: 80 },
    { price: 633, flights: [{}, {}], total_duration: 200 },
    { price: 633, flights: [{}], total_duration: 95 },
    { price: 633, flights: [{}], total_duration: 80 },
  ];
  assert.deepEqual(escolherMaisBarato(voos), voos[3]);
});

test("ignora voos sem preço", () => {
  assert.equal(escolherMaisBarato([{ flights: [{}] }, { price: 0 }]), null);
});

test("desconto real usa o preço de hoje contra o preço normal", () => {
  assert.equal(descontoReal(907, 2511), 64);
  assert.equal(descontoReal(633, 630), 0);
  assert.equal(descontoReal(500, null), null);
});

test("oferta antiga deixa de valer quando o preço de hoje não é mais bom", () => {
  assert.equal(ofertaAprovada({ real: 633, anunciado: 295, normal: 630, descontoMinimo: 25 }), false);
  assert.equal(ofertaAprovada({ real: 2681, anunciado: 925, normal: 1899, descontoMinimo: 25 }), false);
  assert.equal(ofertaAprovada({ real: 907, anunciado: 759, normal: 2511, descontoMinimo: 25 }), true);
});

test("sem preço normal, só vale se ficou perto do anunciado", () => {
  assert.equal(ofertaAprovada({ real: 1050, anunciado: 1000, normal: null, descontoMinimo: 25 }), true);
  assert.equal(ofertaAprovada({ real: 1300, anunciado: 1000, normal: null, descontoMinimo: 25 }), false);
});
