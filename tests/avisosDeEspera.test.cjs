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
  vm.runInNewContext(code, { exports, setTimeout, clearTimeout, Promise });
  return exports;
}

const { iniciarAvisosDeDemora, MARCOS_PADRAO } = load("src/lib/agente/avisosDeEspera.ts");
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("avisa de novo quando a pesquisa passa do tempo, em ordem", async () => {
  const enviados = [];
  iniciarAvisosDeDemora(async (texto) => enviados.push(texto), [{ aposMs: 20, texto: "um" }, { aposMs: 60, texto: "dois" }]);
  await esperar(120);
  assert.equal(enviados.join(","), "um,dois");
});

test("pesquisa que termina antes não manda aviso de demora", async () => {
  const enviados = [];
  const cancelar = iniciarAvisosDeDemora(async (texto) => enviados.push(texto), [{ aposMs: 40, texto: "um" }]);
  await esperar(10);
  cancelar();
  await esperar(80);
  assert.equal(enviados.length, 0);
});

test("cancelar depois do primeiro aviso segura o segundo", async () => {
  const enviados = [];
  const cancelar = iniciarAvisosDeDemora(async (texto) => enviados.push(texto), [{ aposMs: 20, texto: "um" }, { aposMs: 80, texto: "dois" }]);
  await esperar(50);
  cancelar();
  await esperar(100);
  assert.equal(enviados.join(","), "um");
});

test("os avisos reais explicam o motivo e dizem quanto falta", () => {
  assert.ok(MARCOS_PADRAO[0].aposMs === 30000);
  assert.ok(/Google Voos está lento/.test(MARCOS_PADRAO[0].texto) && /2 minutinhos/.test(MARCOS_PADRAO[0].texto));
  assert.ok(MARCOS_PADRAO[1].aposMs > MARCOS_PADRAO[0].aposMs);
});
