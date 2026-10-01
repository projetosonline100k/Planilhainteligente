const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, imports) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    process: { env: {} }, Response, AbortSignal,
  });
  return exports;
}

const SELECT_FIELDS = "id, origin_code, origin_name, destination_code, destination_name, price, typical_price, savings_percentage, savings_amount, outbound_date, return_date, image_url, status, last_checked_at, created_at";

function adminClient({ rows = [], failure = false, captured = {} } = {}) {
  return {
    from(table) {
      assert.equal(table, "flight_offers");
      const state = { eq: [], order: [] };
      captured.state = state;
      const query = {
        select(fields) { state.select = fields; return query; },
        eq(field, value) { state.eq.push([field, value]); return query; },
        order(field, options) { state.order.push([field, options]); return query; },
        limit(value) { state.limit = value; return query; },
        async abortSignal() {
          if (failure) return { data: null, error: new Error("indisponível") };
          return { data: rows, error: null };
        },
      };
      return query;
    },
  };
}

function route({ rows, failure, captured = {} } = {}) {
  return {
    get: load("src/app/api/offers/route.ts", {
      "@/lib/adminServer": { createAdminClient: () => adminClient({ rows, failure, captured }) },
    }).GET,
    captured,
  };
}

const OFFER_ROW = {
  id: "26cf9978-010e-4759-8f7d-d17a34113245",
  origin_code: "BSB",
  origin_name: "Brasília",
  destination_code: "CFB",
  destination_name: "Cabo Frio",
  price: 1628,
  typical_price: 6570,
  savings_percentage: 75,
  savings_amount: 4942,
  outbound_date: "2026-12-06",
  return_date: "2026-12-13",
  image_url: "https://example.invalid/cabo-frio.jpg",
  status: "active",
  last_checked_at: "2026-09-20T10:00:00.000Z",
  created_at: "2026-09-19T10:00:00.000Z",
};

test("nunca seleciona booking_url nem advertised_price no SELECT", async () => {
  const { get, captured } = route({ rows: [OFFER_ROW] });
  await get();
  assert.equal(captured.state.select, SELECT_FIELDS);
  assert.ok(!captured.state.select.includes("booking_url"));
  assert.ok(!captured.state.select.includes("advertised_price"));
  assert.ok(!captured.state.select.includes("deal_key"));
});

test("filtra somente ofertas com status active", async () => {
  const { get, captured } = route({ rows: [OFFER_ROW] });
  await get();
  assert.deepEqual(captured.state.eq, [["status", "active"]]);
});

test("ordena por savings_percentage desc, com created_at desc como desempate", async () => {
  const { get, captured } = route({ rows: [OFFER_ROW] });
  await get();
  assert.equal(captured.state.order[0][0], "savings_percentage");
  assert.equal(captured.state.order[0][1].ascending, false);
  assert.equal(captured.state.order[1][0], "created_at");
  assert.equal(captured.state.order[1][1].ascending, false);
});

test("limita a no máximo 50 ofertas", async () => {
  const { get, captured } = route({ rows: [OFFER_ROW] });
  await get();
  assert.equal(captured.state.limit, 50);
});

test("booking_url nunca aparece na resposta, mesmo se vier da linha do banco", async () => {
  const { get } = route({ rows: [{ ...OFFER_ROW, booking_url: "https://pagamento.invalid/segredo" }] });
  const response = await get();
  const text = await response.text();
  assert.ok(!text.includes("booking_url"));
  assert.ok(!text.includes("pagamento.invalid"));
});

test("advertised_price nunca aparece na resposta, mesmo se vier da linha do banco", async () => {
  const { get } = route({ rows: [{ ...OFFER_ROW, advertised_price: 999 }] });
  const response = await get();
  const text = await response.text();
  assert.ok(!text.toLowerCase().includes("advertised"));
});

test("retorna as ofertas em um envelope { offers: [...] } com Cache-Control público", async () => {
  const { get } = route({ rows: [OFFER_ROW] });
  const response = await get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.offers.length, 1);
  assert.equal(body.offers[0].id, OFFER_ROW.id);
  assert.ok(response.headers.get("cache-control"));
});

test("erro técnico no banco -> resposta controlada 503", async () => {
  const { get } = route({ failure: true });
  const response = await get();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Não conseguimos carregar as oportunidades agora." });
});
