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

const lib = load("src/lib/offersFormat.ts");
const FORMATO_MOEDA_ESPERADO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

test("formatarPreco formata em reais sem casas decimais", () => {
  assert.equal(lib.formatarPreco(1628), FORMATO_MOEDA_ESPERADO.format(1628));
});

test("formatarDataCurta formata como DD/MM", () => {
  assert.equal(lib.formatarDataCurta("2026-12-06"), "06/12");
});

test("formatarDataCurta: null/vazio -> null", () => {
  assert.equal(lib.formatarDataCurta(null), null);
});

test("formatarDataCurta: data inválida -> null", () => {
  assert.equal(lib.formatarDataCurta("não-é-uma-data"), null);
});

function oferta(id, savings) {
  return { id, savings_percentage: savings };
}

test("selecionarMelhoresOfertas: limita a 5 por padrão", () => {
  const ofertas = Array.from({ length: 12 }, (_, i) => oferta(String(i), 90 - i));
  const resultado = lib.selecionarMelhoresOfertas(ofertas);
  assert.equal(resultado.length, 5);
});

test("selecionarMelhoresOfertas: primeiro item continua sendo a melhor oportunidade (ordem preservada, sem reordenar)", () => {
  const ofertas = [oferta("melhor", 75), oferta("segunda", 70), oferta("terceira", 69)];
  const resultado = lib.selecionarMelhoresOfertas(ofertas);
  assert.equal(resultado[0].id, "melhor");
});

test("selecionarMelhoresOfertas: com menos de 5 ofertas, retorna todas", () => {
  const ofertas = [oferta("a", 50), oferta("b", 40)];
  const resultado = lib.selecionarMelhoresOfertas(ofertas);
  assert.equal(resultado.length, 2);
});

test("selecionarMelhoresOfertas: lista vazia -> retorna vazio, nunca inventa ofertas", () => {
  const resultado = lib.selecionarMelhoresOfertas([]);
  assert.equal(resultado.length, 0);
});

test("selecionarMelhoresOfertas: aceita limite customizado", () => {
  const ofertas = Array.from({ length: 8 }, (_, i) => oferta(String(i), i));
  const resultado = lib.selecionarMelhoresOfertas(ofertas, 3);
  assert.equal(resultado.length, 3);
});
