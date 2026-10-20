const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("src/app/o/[codigo]/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, Response, URL });
  return exports.GET;
}

async function destino(codigo) {
  const response = await load()(new Request(`https://vaiviajar.vercel.app/o/${codigo}`), { params: Promise.resolve({ codigo }) });
  assert.equal(response.status, 308);
  return new URL(response.headers.get("location")).pathname;
}

test("link curto sem hífens leva para a página da oferta", async () => {
  assert.equal(await destino("FEFE637366F04346B5F6E03E834CD49D"), "/oferta/fefe6373-66f0-4346-b5f6-e03e834cd49d");
});

test("código inválido leva para o radar", async () => {
  assert.equal(await destino("nao-e-um-id"), "/site/radar");
  assert.equal(await destino("fefe6373-66f0-4346-b5f6-e03e834cd49d"), "/site/radar");
});
