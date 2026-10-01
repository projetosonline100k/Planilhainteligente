const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, fetchImpl) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: () => { throw new Error("Unexpected import"); },
    Response, AbortSignal, URL, fetch: fetchImpl,
  });
  return exports;
}

const OFFER_ID = "26cf9978-010e-4759-8f7d-d17a34113245";

test("buildOfferPath gera /oferta/<UUID>", () => {
  const lib = load("src/lib/offers.ts", async () => { throw new Error("not used"); });
  assert.equal(lib.buildOfferPath(OFFER_ID), `/oferta/${OFFER_ID}`);
});

test("sanitizeImageUrl aceita http(s) e rejeita outros esquemas", () => {
  const lib = load("src/lib/offers.ts", async () => { throw new Error("not used"); });
  assert.equal(lib.sanitizeImageUrl("https://example.invalid/foto.jpg"), "https://example.invalid/foto.jpg");
  assert.equal(lib.sanitizeImageUrl("javascript:alert(1)"), null);
  assert.equal(lib.sanitizeImageUrl(null), null);
  assert.equal(lib.sanitizeImageUrl(""), null);
});

test("fetchOffers: lista não vazia -> estado ready", async () => {
  const lib = load("src/lib/offers.ts", async (url) => {
    assert.equal(url, "/api/offers");
    return new Response(JSON.stringify({ offers: [{ id: OFFER_ID }] }), { status: 200 });
  });
  const result = await lib.fetchOffers();
  assert.equal(result.state, "ready");
  assert.equal(result.offers.length, 1);
});

test("fetchOffers: lista vazia -> estado empty", async () => {
  const lib = load("src/lib/offers.ts", async () => new Response(JSON.stringify({ offers: [] }), { status: 200 }));
  const result = await lib.fetchOffers();
  assert.equal(result.state, "empty");
  assert.deepEqual(result.offers, []);
});

test("fetchOffers: resposta não-ok -> estado error", async () => {
  const lib = load("src/lib/offers.ts", async () => new Response(JSON.stringify({ error: "indisponível" }), { status: 503 }));
  const result = await lib.fetchOffers();
  assert.equal(result.state, "error");
});

test("fetchOffers: resposta sem 'offers' válido -> estado error", async () => {
  const lib = load("src/lib/offers.ts", async () => new Response(JSON.stringify({ nada: true }), { status: 200 }));
  const result = await lib.fetchOffers();
  assert.equal(result.state, "error");
});

test("fetchOffers: falha de rede -> estado error, nunca trava silenciosamente", async () => {
  const lib = load("src/lib/offers.ts", async () => { throw new Error("timeout"); });
  const result = await lib.fetchOffers();
  assert.equal(result.state, "error");
});
