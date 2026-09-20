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
    Response, AbortSignal, fetch: fetchImpl,
  });
  return exports;
}

const instantWait = async () => {};

test("sem token -> fase anonymous, nunca consulta membership", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () => { throw new Error("must not call membership status"); });
  const updates = [];
  await lib.resolveCheckoutAccess({
    token: undefined,
    checkOnce: () => { throw new Error("must not be called"); },
    onUpdate: (phase) => updates.push(phase),
  });
  assert.deepEqual(updates, ["anonymous"]);
});

test("active=true na primeira tentativa -> pending seguido de active, sem retries", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () => { throw new Error("not used in this test"); });
  const updates = [];
  let calls = 0;
  await lib.resolveCheckoutAccess({
    token: "verified-token",
    checkOnce: async (token) => { assert.equal(token, "verified-token"); calls++; return true; },
    onUpdate: (phase) => updates.push(phase),
    wait: instantWait,
  });
  assert.deepEqual(updates, ["pending", "active"]);
  assert.equal(calls, 1);
});

test("active=false faz retries limitados (1 imediata + 4 atrasadas) e termina unresolved", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () => { throw new Error("not used in this test"); });
  const updates = [];
  const waited = [];
  let calls = 0;
  await lib.resolveCheckoutAccess({
    token: "verified-token",
    checkOnce: async () => { calls++; return false; },
    onUpdate: (phase) => updates.push(phase),
    wait: async (ms) => { waited.push(ms); },
  });
  assert.equal(calls, 5);
  assert.deepEqual(waited, [3000, 6000, 10000, 15000]);
  assert.deepEqual(updates, ["pending", "unresolved"]);
});

test("fica ativo numa tentativa tardia e para de consultar depois disso", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () => { throw new Error("not used in this test"); });
  const updates = [];
  let calls = 0;
  await lib.resolveCheckoutAccess({
    token: "verified-token",
    checkOnce: async () => { calls++; return calls === 3; },
    onUpdate: (phase) => updates.push(phase),
    wait: instantWait,
  });
  assert.equal(calls, 3);
  assert.deepEqual(updates, ["pending", "active"]);
});

test("cancelamento (unmount) interrompe os retries sem marcar active nem unresolved", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () => { throw new Error("not used in this test"); });
  const updates = [];
  let calls = 0;
  await lib.resolveCheckoutAccess({
    token: "verified-token",
    checkOnce: async () => { calls++; return false; },
    onUpdate: (phase) => updates.push(phase),
    wait: instantWait,
    isCancelled: () => calls >= 2,
  });
  assert.equal(calls, 2);
  assert.deepEqual(updates, ["pending"]);
});

test("erro técnico ao consultar membership nunca concede acesso (checkMembershipStatus)", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () => { throw new Error("SearchApi indisponível"); });
  const active = await lib.checkMembershipStatus("qualquer-token");
  assert.equal(active, false);
});

test("resposta 503 do membership status nunca concede acesso", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () =>
    new Response(JSON.stringify({ error: "indisponível" }), { status: 503 }));
  const active = await lib.checkMembershipStatus("qualquer-token");
  assert.equal(active, false);
});

test("checkMembershipStatus só retorna true com authenticated=true e active=true", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () =>
    new Response(JSON.stringify({ authenticated: true, active: false }), { status: 200 }));
  assert.equal(await lib.checkMembershipStatus("token"), false);
});

test("checkMembershipStatus envia o Bearer token e consulta /api/membership/status, nunca o endpoint de booking", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async (url, init) => {
    assert.equal(String(url), "/api/membership/status");
    assert.equal(init.headers.Authorization, "Bearer verified-token");
    return new Response(JSON.stringify({ authenticated: true, active: true }), { status: 200 });
  });
  assert.equal(await lib.checkMembershipStatus("verified-token"), true);
});

test("booking_url nunca aparece: checkMembershipStatus ignora e nunca repassa campos extras da resposta", async () => {
  const lib = load("src/lib/checkoutMembership.ts", async () =>
    new Response(JSON.stringify({ authenticated: true, active: true, bookingUrl: "https://example.invalid/segredo" }), { status: 200 }));
  const result = await lib.checkMembershipStatus("token");
  assert.equal(result, true);
  assert.equal(typeof result, "boolean");
});
