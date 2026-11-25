const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("src/lib/agente/grupoOfertas.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports });
  return exports;
}

const { escolherLote, horarioDeDisparo, mensagemDoGrupo, ehInternacional } = load();

let n = 0;
function oferta(origem, desconto, destino = "REC") {
  n += 1;
  return {
    id: `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`.slice(-36),
    origin_name: origem,
    destination_name: "Destino " + n,
    destination_code: destino,
    price: 500,
    typical_price: 1000,
    savings_percentage: desconto,
    savings_amount: 500,
    outbound_date: "2026-12-10",
    return_date: "2026-12-15",
  };
}

test("lote tem até 10 ofertas, 3 de cada cidade foco e ao menos 1 internacional", () => {
  const candidatas = [
    ...[70, 65, 60, 55].map((d) => oferta("São Paulo", d)),
    ...[50, 45, 40, 35].map((d) => oferta("Rio de Janeiro", d)),
    ...[30, 29, 28, 27].map((d) => oferta("Goiânia", d)),
    oferta("Brasília", 90),
    oferta("Goiânia", 21, "LIS"),
  ];
  const lote = escolherLote(candidatas);
  assert.equal(lote.length, 10);
  const por = (cidade) => lote.filter((o) => o.origin_name === cidade).length;
  assert.ok(por("São Paulo") >= 3 && por("Rio de Janeiro") >= 3);
  assert.ok(lote.some(ehInternacional));
  assert.equal(new Set(lote.map((o) => o.id)).size, 10);
});

test("com poucas ofertas manda o que tiver, sem repetir", () => {
  const lote = escolherLote([oferta("São Paulo", 40), oferta("Rio de Janeiro", 30)]);
  assert.equal(lote.length, 2);
});

test("só dispara nos 50 primeiros minutos de 09h, 12h, 18h e 20h (horário de Brasília)", () => {
  assert.equal(JSON.stringify(horarioDeDisparo(new Date("2026-11-25T12:05:00Z"))), JSON.stringify({ chave: "2026-11-25-9", hora: 9 }));
  assert.equal(horarioDeDisparo(new Date("2026-11-25T12:55:00Z")), null);
  assert.equal(horarioDeDisparo(new Date("2026-11-25T14:00:00Z")), null);
  assert.equal(JSON.stringify(horarioDeDisparo(new Date("2026-11-25T23:10:00Z"))), JSON.stringify({ chave: "2026-11-25-20", hora: 20 }));
});

test("mensagem usa o link curto sem hífens", () => {
  const texto = mensagemDoGrupo({ ...oferta("São Paulo", 50), id: "fefe6373-66f0-4346-b5f6-e03e834cd49d" }, "https://vaiviajar.vercel.app");
  assert.match(texto, /https:\/\/vaiviajar\.vercel\.app\/o\/fefe637366f04346b5f6e03e834cd49d$/);
  assert.match(texto, /50% abaixo do normal/);
  assert.match(texto, /R\$ 500 ida e volta/);
});
