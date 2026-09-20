const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, imports, env, fetchImpl) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    process: { env }, Request, Response, AbortSignal, URL, URLSearchParams, fetch: fetchImpl,
  });
  return exports;
}

const SELECT_FIELDS = "origin_code, destination_code, outbound_date, return_date, price, advertised_price, typical_price, savings_amount, savings_percentage, status, last_checked_at";

function adminClient({ offerRow, fetchError = false, updateError = false, updates = [] } = {}) {
  return {
    from(table) {
      assert.equal(table, "flight_offers");
      return {
        select(fields) {
          assert.equal(fields, SELECT_FIELDS);
          let id;
          const query = {
            eq(field, value) { assert.equal(field, "id"); id = value; return query; },
            abortSignal() { return query; },
            async maybeSingle() {
              if (fetchError) return { data: null, error: new Error("db indisponível") };
              if (!offerRow || offerRow.id !== id) return { data: null, error: null };
              return { data: offerRow, error: null };
            },
          };
          return query;
        },
        update(payload) {
          updates.push(payload);
          return {
            async eq(field, value) {
              assert.equal(field, "id");
              assert.equal(value, offerRow?.id);
              return { error: updateError ? new Error("update indisponível") : null };
            },
          };
        },
      };
    },
  };
}

function route({ offerRow, fetchError, updateError, updates, fetchImpl, env = {} } = {}) {
  return load("src/app/api/offers/[id]/revalidate/route.ts", {
    "@/lib/adminServer": {
      createAdminClient: () => adminClient({ offerRow, fetchError, updateError, updates }),
    },
  }, { SEARCHAPI_KEY: "test-search-key", ...env }, fetchImpl).GET;
}

const OFFER_ID = "26cf9978-010e-4759-8f7d-d17a34113245";
const BASE_OFFER = {
  id: OFFER_ID,
  origin_code: "BSB",
  destination_code: "CFB",
  outbound_date: "2026-12-06",
  return_date: "2026-12-13",
  price: 1628,
  advertised_price: 1628,
  typical_price: 6570,
  savings_amount: 4942,
  savings_percentage: 75,
  status: "active",
  last_checked_at: null,
};

function call(get, id = OFFER_ID) {
  return get(new Request(`http://localhost/api/offers/${id}/revalidate?price=999&origin=XXX&status=active`), {
    params: Promise.resolve({ id }),
  });
}

function neverFetch() {
  return async () => { throw new Error("must not call SearchApi"); };
}

test("UUID inválido -> 404 sem consultar o banco", async () => {
  const get = route({ fetchImpl: neverFetch() });
  const response = await call(get, "nao-e-um-uuid");
  assert.equal(response.status, 404);
});

test("oferta inexistente -> 404", async () => {
  const get = route({ offerRow: undefined, fetchImpl: neverFetch() });
  const response = await call(get);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Oferta não encontrada." });
});

test("oferta já expirada -> retorna expired sem chamar SearchApi", async () => {
  let called = 0;
  const get = route({
    offerRow: { ...BASE_OFFER, status: "expired" },
    fetchImpl: async () => { called++; throw new Error("must not be called"); },
  });
  const response = await call(get);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "expired" });
  assert.equal(called, 0);
});

test("cache < 10 minutos -> retorna dados salvos sem chamar SearchApi", async () => {
  let called = 0;
  const lastChecked = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const get = route({
    offerRow: { ...BASE_OFFER, last_checked_at: lastChecked },
    fetchImpl: async () => { called++; throw new Error("must not be called"); },
  });
  const response = await call(get);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "available",
    currentPrice: 1628,
    typicalPrice: 6570,
    savingsAmount: 4942,
    savingsPercentage: 75,
    checkedAt: lastChecked,
  });
  assert.equal(called, 0);
});

test("SearchApi confirma preço válido -> available e atualiza a tabela", async () => {
  const updates = [];
  const get = route({
    offerRow: { ...BASE_OFFER },
    updates,
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.searchParams.get("engine"), "google_flights");
      assert.equal(parsed.searchParams.get("flight_type"), "round_trip");
      assert.equal(parsed.searchParams.get("departure_id"), "BSB");
      assert.equal(parsed.searchParams.get("arrival_id"), "CFB");
      assert.equal(parsed.searchParams.get("outbound_date"), "2026-12-06");
      assert.equal(parsed.searchParams.get("return_date"), "2026-12-13");
      assert.equal(parsed.searchParams.get("currency"), "BRL");
      assert.equal(parsed.searchParams.get("api_key"), "test-search-key");
      return new Response(JSON.stringify({ price_insights: { lowest_price: 1500 } }), { status: 200 });
    },
  });
  const response = await call(get);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "available");
  assert.equal(body.currentPrice, 1500);
  assert.equal(body.typicalPrice, 6570);
  assert.equal(body.savingsAmount, 5070);
  assert.equal(body.savingsPercentage, 77);
  assert.equal(typeof body.checkedAt, "string");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "active");
  assert.equal(updates[0].price, 1500);
  assert.equal(updates[0].savings_amount, 5070);
  assert.equal(updates[0].savings_percentage, 77);
  assert.equal(updates[0].last_checked_at, body.checkedAt);
});

test("preço até exatamente +10% continua válido", async () => {
  const updates = [];
  const currentPrice = BASE_OFFER.advertised_price * 1.1;
  const get = route({
    offerRow: { ...BASE_OFFER },
    updates,
    fetchImpl: async () => new Response(JSON.stringify({ price_insights: { lowest_price: currentPrice } }), { status: 200 }),
  });
  const response = await call(get);
  const body = await response.json();
  assert.equal(body.status, "available");
  assert.equal(body.currentPrice, currentPrice);
  assert.equal(updates[0].status, "active");
});

test("preço acima de +10% -> expired e atualiza status na tabela", async () => {
  const updates = [];
  const currentPrice = BASE_OFFER.advertised_price * 1.1 + 1;
  const get = route({
    offerRow: { ...BASE_OFFER },
    updates,
    fetchImpl: async () => new Response(JSON.stringify({ price_insights: { lowest_price: currentPrice } }), { status: 200 }),
  });
  const response = await call(get);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "expired" });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "expired");
  assert.equal(typeof updates[0].last_checked_at, "string");
  assert.equal(updates[0].price, undefined);
});

test("threshold usa sempre advertised_price, nunca o price mais recente (sem efeito de escada)", async () => {
  const updates = [];
  const get = route({
    offerRow: { ...BASE_OFFER, advertised_price: 1000, price: 1090 },
    updates,
    fetchImpl: async () => new Response(JSON.stringify({ price_insights: { lowest_price: 1150 } }), { status: 200 }),
  });
  const response = await call(get);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "expired" });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "expired");
  assert.equal(updates[0].price, undefined);
  assert.equal(updates[0].advertised_price, undefined);
});

test("revalidação nunca altera advertised_price, mesmo quando a oferta continua disponível", async () => {
  const updates = [];
  const get = route({
    offerRow: { ...BASE_OFFER, advertised_price: 1000, price: 1000 },
    updates,
    fetchImpl: async () => new Response(JSON.stringify({ price_insights: { lowest_price: 1080 } }), { status: 200 }),
  });
  const response = await call(get);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "available");
  assert.equal(body.currentPrice, 1080);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].price, 1080);
  assert.equal(updates[0].advertised_price, undefined);
  assert.ok(!JSON.stringify(body).includes("advertised"));
});

test("SearchApi sem preço utilizável -> unavailable_to_verify, nunca expira a oferta", async () => {
  const updates = [];
  const get = route({
    offerRow: { ...BASE_OFFER },
    updates,
    fetchImpl: async () => new Response(JSON.stringify({ price_insights: {} }), { status: 200 }),
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable_to_verify" });
  assert.equal(updates.length, 0);
});

test("SearchApi retorna erro -> unavailable_to_verify, nunca expira a oferta", async () => {
  const updates = [];
  const get = route({
    offerRow: { ...BASE_OFFER },
    updates,
    fetchImpl: async () => new Response(JSON.stringify({ error: "quota excedida" }), { status: 200 }),
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable_to_verify" });
  assert.equal(updates.length, 0);
});

test("SearchApi indisponível (rede) -> unavailable_to_verify, nunca expira a oferta", async () => {
  const updates = [];
  const get = route({
    offerRow: { ...BASE_OFFER },
    updates,
    fetchImpl: async () => { throw new Error("timeout"); },
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable_to_verify" });
  assert.equal(updates.length, 0);
});

test("SEARCHAPI_KEY ausente -> unavailable_to_verify sem chamar a API externa", async () => {
  let called = 0;
  const get = route({
    offerRow: { ...BASE_OFFER },
    env: { SEARCHAPI_KEY: "" },
    fetchImpl: async () => { called++; throw new Error("must not be called"); },
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable_to_verify" });
  assert.equal(called, 0);
});

test("erro ao consultar o banco -> unavailable_to_verify genérico", async () => {
  const get = route({
    fetchError: true,
    fetchImpl: neverFetch(),
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable_to_verify" });
});

test("booking_url e advertised_price nunca aparecem na resposta, mesmo vindo da linha do banco", async () => {
  const get = route({
    offerRow: { ...BASE_OFFER, booking_url: "https://example.invalid/segredo", advertised_price: 1628 },
    fetchImpl: async () => new Response(JSON.stringify({ price_insights: { lowest_price: 1500 } }), { status: 200 }),
  });
  const response = await call(get);
  const text = await response.text();
  assert.ok(!text.includes("booking_url"));
  assert.ok(!text.includes("bookingUrl"));
  assert.ok(!text.includes("example.invalid"));
  assert.ok(!text.toLowerCase().includes("advertised"));
});
