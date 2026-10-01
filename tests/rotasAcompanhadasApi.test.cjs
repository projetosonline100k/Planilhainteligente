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
    exports,
    require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
    Response,
    URL,
  });
  return exports;
}

function adminClient({ respostas = [], capturas = [] } = {}) {
  let indice = 0;
  return {
    from(table) {
      const estado = { table, eq: [], order: [], select: null, ilike: [], limit: null, insert: null, update: null, delete: false, single: false };
      capturas.push(estado);
      const proximaResposta = () => respostas[indice++] ?? { data: null, error: null };
      const builder = {
        select(fields) { estado.select = fields; return builder; },
        insert(payload) { estado.insert = payload; return builder; },
        update(payload) { estado.update = payload; return builder; },
        delete() { estado.delete = true; return builder; },
        eq(field, value) { estado.eq.push([field, value]); return builder; },
        order(field, options) { estado.order.push([field, options]); return builder; },
        ilike(field, value) { estado.ilike.push([field, value]); return builder; },
        limit(value) { estado.limit = value; return builder; },
        single() { estado.single = true; return Promise.resolve(proximaResposta()); },
        then(resolve, reject) { return Promise.resolve(proximaResposta()).then(resolve, reject); },
      };
      return builder;
    },
  };
}

function authorizeOk(userId = "user-123") {
  return async () => ({ user: { id: userId } });
}

function authorizeFalha() {
  return async () => ({ error: "Sessao nao encontrada.", status: 401 });
}

function requisicao({ token = "token-valido", corpo, url = "http://localhost/api/rotas-acompanhadas" } = {}) {
  return {
    headers: { get: (nome) => (nome.toLowerCase() === "authorization" ? (token ? `Bearer ${token}` : null) : null) },
    json: async () => corpo,
    url,
  };
}

function rota({ respostas, capturas = [], userId, semAuth = false } = {}) {
  const client = adminClient({ respostas, capturas });
  const modulo = load("src/app/api/rotas-acompanhadas/route.ts", {
    "@/lib/adminServer": {
      authorizeUser: semAuth ? authorizeFalha() : authorizeOk(userId),
      createAdminClient: () => client,
    },
  });
  return { ...modulo, capturas };
}

const ORIGEM = { name: "São Paulo", code: "GRU" };
const DESTINO = { name: "Goiânia", code: "GYN" };

test("GET sem sessao -> 401, nenhuma consulta ao banco", async () => {
  const { GET, capturas } = rota({ semAuth: true, respostas: [] });
  const response = await GET(requisicao());
  assert.equal(response.status, 401);
  assert.equal(capturas.length, 0);
});

test("GET sempre filtra por user_id", async () => {
  const { GET, capturas } = rota({ userId: "user-abc", respostas: [{ data: [], error: null }] });
  await GET(requisicao());
  assert.equal(capturas[0].table, "rotas_acompanhadas");
  assert.deepEqual(capturas[0].eq, [["user_id", "user-abc"]]);
});

test("GET usuario sem rotas -> lista vazia, nunca inventa dados", async () => {
  const { GET } = rota({ respostas: [{ data: [], error: null }] });
  const body = await (await GET(requisicao())).json();
  assert.deepEqual(body.rotas, []);
});

test("erro tecnico no banco ao listar -> resposta controlada 500", async () => {
  const { GET } = rota({ respostas: [{ data: null, error: new Error("indisponivel") }] });
  const response = await GET(requisicao());
  assert.equal(response.status, 500);
});

test("POST valida origem vazia -> 400, nenhuma consulta ao banco", async () => {
  const { POST, capturas } = rota({ respostas: [] });
  const response = await POST(requisicao({ corpo: { origin: { name: "   " }, destination: DESTINO } }));
  assert.equal(response.status, 400);
  assert.equal(capturas.length, 0);
});

test("POST valida destino vazio -> 400, nenhuma consulta ao banco", async () => {
  const { POST, capturas } = rota({ respostas: [] });
  const response = await POST(requisicao({ corpo: { origin: ORIGEM, destination: { name: "" } } }));
  assert.equal(response.status, 400);
  assert.equal(capturas.length, 0);
});

test("POST rejeita origem igual ao destino -> 400", async () => {
  const { POST, capturas } = rota({ respostas: [] });
  const response = await POST(requisicao({ corpo: { origin: { name: "Goiânia" }, destination: { name: "goiânia" } } }));
  assert.equal(response.status, 400);
  assert.equal(capturas.length, 0);
});

test("POST cadastra uma rota nova, associada ao usuario autenticado", async () => {
  const nova = { id: "nova", origin_code: "GRU", origin_name: "São Paulo", destination_code: "GYN", destination_name: "Goiânia", created_at: "2026-01-01" };
  const { POST, capturas } = rota({
    userId: "user-abc",
    respostas: [
      { data: [], error: null },
      { data: nova, error: null },
    ],
  });
  const response = await POST(requisicao({ corpo: { origin: ORIGEM, destination: DESTINO } }));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.jaExistia, false);
  assert.equal(body.rota.destination_name, "Goiânia");
  assert.equal(capturas[1].insert.user_id, "user-abc");
  assert.equal(capturas[1].insert.origin_code, "GRU");
});

test("POST evita duplicados: rota ja existente nao gera novo insert", async () => {
  const existente = { id: "ja-existe", origin_code: "GRU", origin_name: "São Paulo", destination_code: "GYN", destination_name: "Goiânia", created_at: "2026-01-01" };
  const { POST, capturas } = rota({ respostas: [{ data: [existente], error: null }] });
  const response = await POST(requisicao({ corpo: { origin: ORIGEM, destination: DESTINO } }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.jaExistia, true);
  assert.equal(body.rota.id, "ja-existe");
  assert.equal(capturas.length, 1, "nao deve tentar inserir quando a rota ja existe");
});

test("PATCH exige o id da rota -> 400, nenhuma consulta ao banco", async () => {
  const { PATCH, capturas } = rota({ respostas: [] });
  const response = await PATCH(requisicao({ corpo: { origin: ORIGEM, destination: DESTINO } }));
  assert.equal(response.status, 400);
  assert.equal(capturas.length, 0);
});

test("PATCH atualiza somente a rota do proprio usuario", async () => {
  const atualizada = { id: "rota-1", origin_code: "GRU", origin_name: "São Paulo", destination_code: null, destination_name: "Roma", created_at: "2026-01-01" };
  const { PATCH, capturas } = rota({
    userId: "user-abc",
    respostas: [{ data: atualizada, error: null }],
  });
  const response = await PATCH(requisicao({ corpo: { id: "rota-1", origin: ORIGEM, destination: { name: "Roma" } } }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.rota.destination_name, "Roma");
  assert.deepEqual(capturas[0].eq, [["id", "rota-1"], ["user_id", "user-abc"]]);
});

test("DELETE exige o id da rota -> 400", async () => {
  const { DELETE, capturas } = rota({ respostas: [] });
  const response = await DELETE(requisicao({ url: "http://localhost/api/rotas-acompanhadas" }));
  assert.equal(response.status, 400);
  assert.equal(capturas.length, 0);
});

test("DELETE remove a rota somente do proprio usuario", async () => {
  const { DELETE, capturas } = rota({ userId: "user-abc", respostas: [{ data: null, error: null }] });
  const response = await DELETE(requisicao({ url: "http://localhost/api/rotas-acompanhadas?id=rota-1" }));
  assert.equal(response.status, 200);
  assert.equal(capturas[0].delete, true);
  assert.deepEqual(capturas[0].eq, [["id", "rota-1"], ["user_id", "user-abc"]]);
});
