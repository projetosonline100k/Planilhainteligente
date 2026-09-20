const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

const kiwifyCheckout = load("src/lib/kiwifyCheckout.ts");
const lib = load("src/lib/returnTo.ts", { "@/lib/kiwifyCheckout": kiwifyCheckout });

const VALID_OFFER_PATH = "/oferta/26cf9978-010e-4759-8f7d-d17a34113245";

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return { getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; } };
}

test("/oferta/<UUID> válido é aceito", () => {
  assert.equal(lib.isValidReturnTo(VALID_OFFER_PATH), true);
});

test("URL externa é rejeitada", () => {
  assert.equal(lib.isValidReturnTo("https://google.com"), false);
  assert.equal(lib.isValidReturnTo("http://google.com/oferta/26cf9978-010e-4759-8f7d-d17a34113245"), false);
});

test("//dominio é rejeitado", () => {
  assert.equal(lib.isValidReturnTo("//google.com"), false);
});

test("javascript: é rejeitado", () => {
  assert.equal(lib.isValidReturnTo("javascript:alert(1)"), false);
});

test("caminho com barra invertida é rejeitado", () => {
  assert.equal(lib.isValidReturnTo("/\\google.com"), false);
});

test("UUID inválido é rejeitado", () => {
  assert.equal(lib.isValidReturnTo("/oferta/nao-e-um-uuid"), false);
});

test("qualquer rota fora de /oferta/<UUID> é rejeitada", () => {
  assert.equal(lib.isValidReturnTo("/admin"), false);
  assert.equal(lib.isValidReturnTo("/minha-viagem"), false);
  assert.equal(lib.isValidReturnTo(null), false);
  assert.equal(lib.isValidReturnTo(undefined), false);
});

test("resolveReturnTo: returnTo válido da URL tem prioridade sobre a oferta pendente", () => {
  const outroUuid = "/oferta/11111111-1111-1111-1111-111111111111";
  const storage = fakeStorage({
    vaiviajar_pending_offer_id: "26cf9978-010e-4759-8f7d-d17a34113245",
    vaiviajar_pending_offer_path: VALID_OFFER_PATH,
  });
  const destino = lib.resolveReturnTo((key) => (key === "returnTo" ? outroUuid : null), storage);
  assert.equal(destino, outroUuid);
});

test("resolveReturnTo: sem returnTo na URL, usa a oferta pendente como fallback", () => {
  const storage = fakeStorage({
    vaiviajar_pending_offer_id: "26cf9978-010e-4759-8f7d-d17a34113245",
    vaiviajar_pending_offer_path: VALID_OFFER_PATH,
  });
  const destino = lib.resolveReturnTo(() => null, storage);
  assert.equal(destino, VALID_OFFER_PATH);
});

test("resolveReturnTo: returnTo inválido na URL cai para a oferta pendente válida", () => {
  const storage = fakeStorage({
    vaiviajar_pending_offer_id: "26cf9978-010e-4759-8f7d-d17a34113245",
    vaiviajar_pending_offer_path: VALID_OFFER_PATH,
  });
  const destino = lib.resolveReturnTo((key) => (key === "returnTo" ? "https://evil.com" : null), storage);
  assert.equal(destino, VALID_OFFER_PATH);
});

test("resolveReturnTo: sem returnTo e sem oferta pendente, mantém o comportamento atual do login (null)", () => {
  const destino = lib.resolveReturnTo(() => null, fakeStorage());
  assert.equal(destino, null);
});

test("resolveReturnTo: nunca aceita valor arbitrário do localStorage fora do padrão /oferta/<UUID>", () => {
  const storage = fakeStorage({
    vaiviajar_pending_offer_id: "26cf9978-010e-4759-8f7d-d17a34113245",
    vaiviajar_pending_offer_path: "https://evil.com",
  });
  assert.equal(lib.resolveReturnTo(() => null, storage), null);
});
