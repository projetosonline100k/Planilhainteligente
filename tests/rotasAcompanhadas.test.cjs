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

const ROTA = { id: "rota-1", origin_code: "GRU", origin_name: "São Paulo", destination_code: "GYN", destination_name: "Goiânia", created_at: "2026-01-01" };

test("fetchRotasAcompanhadas: resposta ok -> estado ready com a lista", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async (url, options) => {
    assert.equal(url, "/api/rotas-acompanhadas");
    assert.equal(options.headers.Authorization, "Bearer token-123");
    return new Response(JSON.stringify({ rotas: [ROTA] }), { status: 200 });
  });
  const result = await lib.fetchRotasAcompanhadas("token-123");
  assert.equal(result.state, "ready");
  assert.equal(result.rotas.length, 1);
  assert.equal(result.rotas[0].origin_name, "São Paulo");
});

test("fetchRotasAcompanhadas: usuário sem rotas -> ready com lista vazia", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async () => new Response(JSON.stringify({ rotas: [] }), { status: 200 }));
  const result = await lib.fetchRotasAcompanhadas("token-123");
  assert.equal(result.state, "ready");
  assert.deepEqual(result.rotas, []);
});

test("fetchRotasAcompanhadas: resposta não-ok -> estado error, nunca lança exceção", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async () => new Response(JSON.stringify({ error: "indisponível" }), { status: 503 }));
  const result = await lib.fetchRotasAcompanhadas("token-123");
  assert.equal(result.state, "error");
});

test("fetchRotasAcompanhadas: falha de rede -> estado error", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async () => { throw new Error("timeout"); });
  const result = await lib.fetchRotasAcompanhadas("token-123");
  assert.equal(result.state, "error");
});

test("criarRotaAcompanhada: sucesso -> devolve a rota criada", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async (url, options) => {
    assert.equal(options.method, "POST");
    const corpo = JSON.parse(options.body);
    assert.deepEqual(corpo.origin, { name: "São Paulo", code: "GRU" });
    return new Response(JSON.stringify({ rota: ROTA, jaExistia: false }), { status: 201 });
  });
  const resultado = await lib.criarRotaAcompanhada("token-123", { name: "São Paulo", code: "GRU" }, { name: "Goiânia", code: "GYN" });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.rota.id, "rota-1");
});

test("criarRotaAcompanhada: erro do servidor -> ok false com mensagem", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async () => new Response(JSON.stringify({ error: "Origem e destino nao podem ser iguais." }), { status: 400 }));
  const resultado = await lib.criarRotaAcompanhada("token-123", { name: "Goiânia" }, { name: "Goiânia" });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.error, "Origem e destino nao podem ser iguais.");
});

test("editarRotaAcompanhada: sucesso -> devolve a rota atualizada", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async (url, options) => {
    assert.equal(options.method, "PATCH");
    const corpo = JSON.parse(options.body);
    assert.equal(corpo.id, "rota-1");
    return new Response(JSON.stringify({ rota: { ...ROTA, destination_name: "Roma" } }), { status: 200 });
  });
  const resultado = await lib.editarRotaAcompanhada("token-123", "rota-1", { name: "São Paulo" }, { name: "Roma" });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.rota.destination_name, "Roma");
});

test("pararDeAcompanhar: sucesso -> true", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async (url, options) => {
    assert.equal(url, "/api/rotas-acompanhadas?id=rota-1");
    assert.equal(options.method, "DELETE");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  const resultado = await lib.pararDeAcompanhar("token-123", "rota-1");
  assert.equal(resultado, true);
});

test("pararDeAcompanhar: falha -> false, nunca lança exceção", async () => {
  const lib = load("src/lib/rotasAcompanhadas.ts", async () => { throw new Error("timeout"); });
  const resultado = await lib.pararDeAcompanhar("token-123", "rota-1");
  assert.equal(resultado, false);
});
