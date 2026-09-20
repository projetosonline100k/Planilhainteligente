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

function membership(rows, failure = false) {
  let queries = 0;
  const imports = {
    "server-only": {},
    "@/lib/adminServer": { createAdminClient: () => ({
      from(table) {
        assert.equal(table, "kiwify_sales");
        queries++;
        let filtered = rows;
        const query = {
          select(fields) { assert.equal(fields, "product_name"); return query; },
          eq(field, value) { filtered = filtered.filter((row) => row[field] === value); return query; },
          order() { return query; },
          range(start, end) { filtered = filtered.slice(start, end + 1); return query; },
          async abortSignal() { return { data: filtered, error: failure ? new Error("private details") : null }; },
        };
        return query;
      },
    }) },
  };
  return { ...load("src/lib/membershipServer.ts", imports, { KIWIFY_PRODUCT_NAME: " Aplicativo Inteligente " }), queries: () => queries };
}

function endpoint(member, auth = { data: { user: { id: "verified-user" } }, error: null }) {
  return load("src/app/api/membership/status/route.ts", {
    "@/lib/membershipServer": { isActiveMember: member },
    "@supabase/supabase-js": {
      createClient: () => ({ auth: { getUser: async (token) => { assert.equal(token, "test-token"); return auth; } } }),
      isAuthApiError: (error) => error.name === "AuthApiError",
    },
  }, { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key" }).GET;
}

test("sem sessão não consulta vendas; parâmetros forjados são ignorados", async () => {
  const get = endpoint(() => { throw new Error("must not be called"); });
  const response = await get(new Request("http://localhost/api/membership/status?user_id=other&active=true"));
  assert.deepEqual(await response.json(), { authenticated: false, active: false });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

for (const active of [false, true]) {
  test(`sessão validada com membro ativo = ${active}`, async () => {
    const rows = [
      { auth_user_id: "other-user", access_status: "active", product_name: "Aplicativo Inteligente" },
      { auth_user_id: "verified-user", access_status: "blocked", product_name: "Aplicativo Inteligente" },
      { auth_user_id: "verified-user", access_status: "active", product_name: "Outro produto" },
    ];
    if (active) rows.push({ auth_user_id: "verified-user", access_status: "active", product_name: "  APLICATIVO INTELIGENTE  " });
    const member = membership(rows);
    const get = endpoint(member.isActiveMember);
    const response = await get(new Request("http://localhost/api/membership/status?user_id=other-user&email=forged", { headers: { Authorization: "Bearer test-token" } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: true, active });
  });
}

test("paginação encontra produto elegível depois de 100 vendas e para", async () => {
  const rows = Array.from({ length: 201 }, (_, index) => ({ auth_user_id: "u", access_status: "active", product_name: index === 100 ? "Aplicativo Inteligente" : "Outro" }));
  const member = membership(rows);
  assert.equal(await member.isActiveMember("u"), true);
  assert.equal(member.queries(), 2);
});

test("erros de banco e Auth são indisponibilidade, nunca não membro", async () => {
  const failing = membership([], true);
  for (const get of [endpoint(failing.isActiveMember), endpoint(() => { throw new Error("must not query"); }, { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 503 } })]) {
    const response = await get(new Request("http://localhost/api/membership/status", { headers: { Authorization: "Bearer test-token" } }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Não conseguimos verificar seu acesso agora." });
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});

test("token inválido não consulta vendas", async () => {
  const get = endpoint(() => { throw new Error("must not query"); }, { data: { user: null }, error: { name: "AuthApiError", status: 401 } });
  const response = await get(new Request("http://localhost/api/membership/status", { headers: { Authorization: "Bearer test-token" } }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false, active: false });
});
