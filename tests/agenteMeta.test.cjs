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
  vm.runInNewContext(code, { exports, Date, Math, Number });
  return exports;
}

const { calcularStatusMeta } = load("src/lib/agente/meta.ts");
const hoje = new Date(2026, 10, 12);

test("sem custo estimado pede os dados que faltam", () => {
  const status = calcularStatusMeta({ custo_estimado: null, valor_guardado: 0, data_viagem: null, guardar_por_mes: null }, hoje);
  assert.equal(status.situacao, "sem_dados");
  assert.deepEqual([...status.faltando], ["custo_estimado", "data_viagem"]);
});

test("meta batida quando guardado cobre o custo", () => {
  const status = calcularStatusMeta({ custo_estimado: 3000, valor_guardado: 3200, data_viagem: "2027-03-01", guardar_por_mes: 200 }, hoje);
  assert.equal(status.situacao, "concluida");
  assert.equal(status.falta, 0);
  assert.equal(status.percentual, 100);
});

test("longe quando o ritmo mensal não alcança a data", () => {
  const status = calcularStatusMeta({ custo_estimado: 6000, valor_guardado: 0, data_viagem: "2027-05-11", guardar_por_mes: 300 }, hoje);
  assert.equal(status.mesesAteViagem, 6);
  assert.equal(status.precisaPorMes, 1000);
  assert.equal(status.mesesNoRitmoAtual, 20);
  assert.equal(status.situacao, "longe");
});

test("no caminho quando o ritmo mensal é suficiente", () => {
  const status = calcularStatusMeta({ custo_estimado: 6000, valor_guardado: 1000, data_viagem: "2027-05-11", guardar_por_mes: 900 }, hoje);
  assert.equal(status.precisaPorMes, 834);
  assert.equal(status.situacao, "no_caminho");
});

test("perto a partir de 75% guardado", () => {
  const status = calcularStatusMeta({ custo_estimado: 4000, valor_guardado: 3100, data_viagem: null, guardar_por_mes: null }, hoje);
  assert.equal(status.situacao, "perto");
});
