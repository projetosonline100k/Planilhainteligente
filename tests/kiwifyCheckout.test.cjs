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
  vm.runInNewContext(code, { exports, require: () => { throw new Error("Unexpected import"); }, URL, URLSearchParams });
  return exports;
}

const lib = load("src/lib/kiwifyCheckout.ts");
const OFFER_ID = "26cf9978-010e-4759-8f7d-d17a34113245";

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    setItem(key, value) { store[key] = value; },
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    snapshot: () => ({ ...store }),
  };
}

test("monta a URL do checkout com src=vaiviajar e s1=offerId", () => {
  const url = lib.buildKiwifyCheckoutUrl("https://pay.kiwify.com.br/oManCiM", OFFER_ID);
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, "https://pay.kiwify.com.br/oManCiM");
  assert.equal(parsed.searchParams.get("src"), "vaiviajar");
  assert.equal(parsed.searchParams.get("s1"), OFFER_ID);
  assert.equal(parsed.searchParams.has("email"), false);
});

test("adiciona email somente quando disponível", () => {
  const semEmail = new URL(lib.buildKiwifyCheckoutUrl("https://pay.kiwify.com.br/oManCiM", OFFER_ID, null));
  assert.equal(semEmail.searchParams.has("email"), false);

  const comEmail = new URL(lib.buildKiwifyCheckoutUrl("https://pay.kiwify.com.br/oManCiM", OFFER_ID, "cliente@example.com"));
  assert.equal(comEmail.searchParams.get("email"), "cliente@example.com");
});

test("nunca inclui booking_url ou dados de membership na URL do checkout", () => {
  const url = lib.buildKiwifyCheckoutUrl("https://pay.kiwify.com.br/oManCiM", OFFER_ID, "cliente@example.com");
  assert.ok(!url.includes("booking"));
  assert.ok(!url.includes("active"));
  assert.ok(!url.includes("membership"));
});

test("savePendingOffer grava o id e o caminho da oferta pendente", () => {
  const storage = fakeStorage();
  lib.savePendingOffer(storage, OFFER_ID);
  assert.deepEqual(storage.snapshot(), {
    vaiviajar_pending_offer_id: OFFER_ID,
    vaiviajar_pending_offer_path: `/oferta/${OFFER_ID}`,
  });
});

test("savePendingOffer nunca grava preço, booking_url ou autorização", () => {
  const storage = fakeStorage();
  lib.savePendingOffer(storage, OFFER_ID);
  const values = Object.values(storage.snapshot()).join(" ");
  assert.ok(!values.toLowerCase().includes("price"));
  assert.ok(!values.toLowerCase().includes("booking"));
  assert.ok(!values.toLowerCase().includes("active"));
});

test("readPendingOfferPath retorna o caminho salvo quando o id é um UUID válido", () => {
  const storage = fakeStorage({
    vaiviajar_pending_offer_id: OFFER_ID,
    vaiviajar_pending_offer_path: `/oferta/${OFFER_ID}`,
  });
  assert.equal(lib.readPendingOfferPath(storage), `/oferta/${OFFER_ID}`);
});

test("readPendingOfferPath reconstrói o caminho se somente o id estiver salvo", () => {
  const storage = fakeStorage({ vaiviajar_pending_offer_id: OFFER_ID });
  assert.equal(lib.readPendingOfferPath(storage), `/oferta/${OFFER_ID}`);
});

test("readPendingOfferPath ignora valores que não parecem UUID", () => {
  const storage = fakeStorage({ vaiviajar_pending_offer_id: "forjado; DROP TABLE" });
  assert.equal(lib.readPendingOfferPath(storage), null);
});

test("readPendingOfferPath retorna null quando não há oferta pendente", () => {
  const storage = fakeStorage();
  assert.equal(lib.readPendingOfferPath(storage), null);
});
