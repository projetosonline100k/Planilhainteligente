const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, imports, env = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    process: { env }, Request, Response, AbortSignal,
  });
  return exports;
}

function adminClient(offerRow, failure = false) {
  return {
    from(table) {
      assert.equal(table, "flight_offers");
      let id;
      const query = {
        select(fields) { assert.equal(fields, "status, booking_url"); return query; },
        eq(field, value) { assert.equal(field, "id"); id = value; return query; },
        abortSignal() { return query; },
        async maybeSingle() {
          if (failure) return { data: null, error: new Error("db indisponível") };
          if (!offerRow || offerRow.id !== id) return { data: null, error: null };
          return { data: { status: offerRow.status, booking_url: offerRow.booking_url }, error: null };
        },
      };
      return query;
    },
  };
}

function route({ offerRow, adminFailure = false, isActiveMember, auth }) {
  return load("src/app/api/offers/[id]/booking/route.ts", {
    "@/lib/adminServer": { createAdminClient: () => adminClient(offerRow, adminFailure) },
    "@/lib/membershipServer": { isActiveMember },
    "@supabase/supabase-js": {
      createClient: () => ({ auth: { getUser: async (token) => { assert.equal(token, "test-token"); return auth; } } }),
      isAuthApiError: (error) => error.name === "AuthApiError",
    },
  }, { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key" }).GET;
}

const OFFER_ID = "26cf9978-010e-4759-8f7d-d17a34113245";
const AUTHENTICATED = { data: { user: { id: "verified-user" } }, error: null };

function call(get, { token = "test-token", id = OFFER_ID } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return get(new Request(`http://localhost/api/offers/${id}/booking?user_id=other&active=true`, { headers }), {
    params: Promise.resolve({ id }),
  });
}

test("sem token -> 401, nunca consulta membership nem oferta", async () => {
  const get = route({
    isActiveMember: () => { throw new Error("must not be called"); },
    auth: AUTHENTICATED,
  });
  const response = await call(get, { token: null });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Sessão necessária." });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("token inválido -> 401, nunca consulta membership", async () => {
  const get = route({
    isActiveMember: () => { throw new Error("must not be called"); },
    auth: { data: { user: null }, error: { name: "AuthApiError", status: 401 } },
  });
  const response = await call(get);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Sessão inválida." });
});

test("autenticado sem membership ativa -> 403, nunca consulta oferta", async () => {
  const get = route({
    offerRow: { id: OFFER_ID, status: "active", booking_url: "https://example.invalid/leak" },
    isActiveMember: async (userId) => { assert.equal(userId, "verified-user"); return false; },
    auth: AUTHENTICATED,
  });
  const response = await call(get);
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "Acesso não está ativo.");
  assert.equal(body.bookingUrl, undefined);
});

test("membro ativo + oferta inexistente -> 404", async () => {
  const get = route({
    offerRow: undefined,
    isActiveMember: async () => true,
    auth: AUTHENTICATED,
  });
  const response = await call(get);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Oferta não encontrada." });
});

test("id com formato inválido -> 404 sem consultar o banco", async () => {
  const get = route({
    offerRow: undefined,
    isActiveMember: async () => true,
    auth: AUTHENTICATED,
  });
  const response = await call(get, { id: "nao-e-um-uuid" });
  assert.equal(response.status, 404);
});

test("membro ativo + oferta inativa -> 410", async () => {
  const get = route({
    offerRow: { id: OFFER_ID, status: "expired", booking_url: "https://example.invalid/x" },
    isActiveMember: async () => true,
    auth: AUTHENTICATED,
  });
  const response = await call(get);
  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), { error: "Oferta não está mais disponível." });
});

test("membro ativo + oferta válida -> retorna somente bookingUrl", async () => {
  const bookingUrl = "https://booking.example.invalid/abc123";
  const get = route({
    offerRow: { id: OFFER_ID, status: "active", booking_url: bookingUrl },
    isActiveMember: async () => true,
    auth: AUTHENTICATED,
  });
  const response = await call(get);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { bookingUrl });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("oferta ativa sem booking_url -> 503, nunca vaza dados vazios", async () => {
  const get = route({
    offerRow: { id: OFFER_ID, status: "active", booking_url: null },
    isActiveMember: async () => true,
    auth: AUTHENTICATED,
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Não conseguimos abrir esta oferta agora." });
});

test("erro do Supabase ao consultar oferta -> 503 genérico", async () => {
  const get = route({
    adminFailure: true,
    isActiveMember: async () => true,
    auth: AUTHENTICATED,
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Não conseguimos abrir esta oferta agora." });
});

test("erro ao validar isActiveMember -> 503 genérico, nunca vira 'não membro'", async () => {
  const get = route({
    offerRow: { id: OFFER_ID, status: "active", booking_url: "https://example.invalid/x" },
    isActiveMember: async () => { throw new Error("indisponível"); },
    auth: AUTHENTICATED,
  });
  const response = await call(get);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Não conseguimos abrir esta oferta agora." });
});
