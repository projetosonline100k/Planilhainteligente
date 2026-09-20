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

test("clicar em 'Quero ter acesso' com checkout configurado: salva a oferta pendente e redireciona para a URL correta", async () => {
  const storage = fakeStorage();
  const calls = [];
  const result = await lib.initiateKiwifyCheckout({
    checkoutBaseUrl: "https://pay.kiwify.com.br/oManCiM",
    offerId: OFFER_ID,
    storage: {
      setItem: (key, value) => { calls.push(`save:${key}`); storage.setItem(key, value); },
    },
    getEmail: async () => null,
    redirect: (url) => calls.push(`redirect:${url}`),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(storage.snapshot(), {
    vaiviajar_pending_offer_id: OFFER_ID,
    vaiviajar_pending_offer_path: `/oferta/${OFFER_ID}`,
  });
  assert.equal(calls.filter((c) => c.startsWith("redirect:")).length, 1);
  assert.equal(calls.at(-1), `redirect:https://pay.kiwify.com.br/oManCiM?src=vaiviajar&s1=${OFFER_ID}`);
  // a oferta pendente precisa estar salva ANTES do redirecionamento
  assert.ok(calls.indexOf("save:vaiviajar_pending_offer_id") < calls.findIndex((c) => c.startsWith("redirect:")));
});

test("inclui o email na URL de checkout quando a sessão fornece um", async () => {
  const calls = [];
  await lib.initiateKiwifyCheckout({
    checkoutBaseUrl: "https://pay.kiwify.com.br/oManCiM",
    offerId: OFFER_ID,
    storage: fakeStorage(),
    getEmail: async () => "cliente@example.com",
    redirect: (url) => calls.push(url),
  });
  assert.equal(calls[0], `https://pay.kiwify.com.br/oManCiM?src=vaiviajar&s1=${OFFER_ID}&email=cliente%40example.com`);
});

test("NEXT_PUBLIC_KIWIFY_CHECKOUT_URL ausente: mostra erro em vez de não fazer nada", async () => {
  const calls = [];
  const result = await lib.initiateKiwifyCheckout({
    checkoutBaseUrl: undefined,
    offerId: OFFER_ID,
    storage: { setItem: () => calls.push("save") },
    getEmail: async () => { throw new Error("must not be called"); },
    redirect: (url) => calls.push(`redirect:${url}`),
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, lib.CHECKOUT_UNAVAILABLE_MESSAGE);
  assert.deepEqual(calls, []);
});

test("NEXT_PUBLIC_KIWIFY_CHECKOUT_URL vazio também é tratado como ausente", async () => {
  const result = await lib.initiateKiwifyCheckout({
    checkoutBaseUrl: "",
    offerId: OFFER_ID,
    storage: fakeStorage(),
    getEmail: async () => null,
    redirect: () => { throw new Error("must not be called"); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, lib.CHECKOUT_UNAVAILABLE_MESSAGE);
});

test("erro ao obter a sessão/e-mail não trava silenciosamente: retorna erro visível", async () => {
  const result = await lib.initiateKiwifyCheckout({
    checkoutBaseUrl: "https://pay.kiwify.com.br/oManCiM",
    offerId: OFFER_ID,
    storage: fakeStorage(),
    getEmail: async () => { throw new Error("sessão indisponível"); },
    redirect: () => { throw new Error("must not be called"); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, lib.CHECKOUT_UNAVAILABLE_MESSAGE);
});

test("erro no redirecionamento não trava silenciosamente: retorna erro visível", async () => {
  const result = await lib.initiateKiwifyCheckout({
    checkoutBaseUrl: "https://pay.kiwify.com.br/oManCiM",
    offerId: OFFER_ID,
    storage: fakeStorage(),
    getEmail: async () => null,
    redirect: () => { throw new Error("bloqueado pelo navegador"); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, lib.CHECKOUT_UNAVAILABLE_MESSAGE);
});

test("falha ao salvar no localStorage (modo privado) não impede o redirecionamento", async () => {
  const calls = [];
  const result = await lib.initiateKiwifyCheckout({
    checkoutBaseUrl: "https://pay.kiwify.com.br/oManCiM",
    offerId: OFFER_ID,
    storage: { setItem: () => { throw new Error("QuotaExceededError"); } },
    getEmail: async () => null,
    redirect: (url) => calls.push(url),
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
});
