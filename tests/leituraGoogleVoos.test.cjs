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
  vm.runInNewContext(code, { exports, Buffer, Number, Math, URL, Map, Array, Set });
  return exports;
}

const g = load("src/lib/agente/leituraGoogleVoos.ts");

test("link de busca é idêntico ao que o Google Voos gera", () => {
  assert.equal(
    g.montarTfs("CGH", "CNF", "2026-12-31", "2027-01-06"),
    "CBwQAhoeEgoyMDI2LTEyLTMxagcIARIDQ0dIcgcIARIDQ05GGh4SCjIwMjctMDEtMDZqBwgBEgNDTkZyBwgBEgNDR0hAAUgBcAGYAQE"
  );
});

test("só ida usa o tipo de viagem só ida e um trecho", () => {
  const tfs = Buffer.from(g.montarTfs("GYN", "FOR", "2027-01-20", null), "base64");
  assert.equal(tfs[tfs.length - 1], 0x02);
  assert.equal(tfs.toString("latin1").split("2027-01-20").length - 1, 1);
});

test("lê um voo da lista como o Google mostra", () => {
  const linha = g.lerLinhaVoo("06:15\n–\n07:35\nGol\n1h 20 min\nCGH–CNF\nSem escalas\n85 kg CO2e\n23% mais emissões\nR$ 633\nida e volta");
  assert.deepEqual({ ...linha }, { companhia: "Gol", preco: 633, escalas: 0, minutos: 80, saida: "06:15", chegada: "07:35", rota: "CGH–CNF" });
});

test("lê preço com milhar, escalas e chegada no dia seguinte", () => {
  const linha = g.lerLinhaVoo("13:50\n–\n09:45\n+1\nLATAM\n14 h 55 min\nGYN–CDG\n1 escala\nR$ 8.624\nida e volta");
  assert.equal(linha.preco, 8624);
  assert.equal(linha.escalas, 1);
  assert.equal(linha.minutos, 14 * 60 + 55);
  assert.equal(linha.companhia, "LATAM");
});

test("ignora itens que não são voos", () => {
  assert.equal(g.lerLinhaVoo("Adultos\nRemover adulto\n1 passageiro adulto"), null);
});

test("escolhe o mais barato, depois menos escalas, depois o mais curto", () => {
  const base = { companhia: "X", saida: "", chegada: "", rota: "" };
  const linhas = [
    { ...base, preco: 700, escalas: 0, minutos: 80 },
    { ...base, preco: 633, escalas: 1, minutos: 200 },
    { ...base, preco: 633, escalas: 0, minutos: 95 },
    { ...base, preco: 633, escalas: 0, minutos: 80 },
  ];
  assert.equal(g.indiceDoMaisBarato(linhas), 3);
  assert.equal(g.indiceDoMaisBarato([]), -1);
});

test("compara o menor preço de cada companhia", () => {
  const base = { saida: "", chegada: "", rota: "", minutos: 1 };
  const comparativo = g.menorPrecoPorCompanhia([
    { ...base, companhia: "Gol", preco: 633, escalas: 0 },
    { ...base, companhia: "Gol", preco: 700, escalas: 0 },
    { ...base, companhia: "LATAM", preco: 816, escalas: 1 },
    { ...base, companhia: "Azul", preco: 643, escalas: 0 },
  ]);
  assert.equal(JSON.stringify(comparativo.map((item) => [item.companhia, item.preco])), JSON.stringify([["Gol", 633], ["Azul", 643], ["LATAM", 816]]));
});

test("entende a faixa de preço da página", () => {
  assert.equal(g.lerNivelPreco("Os preços estão normais"), "typical");
  assert.equal(g.lerNivelPreco("Os preços estão baixos"), "low");
  assert.equal(g.lerNivelPreco("Os preços estão altos"), "high");
  assert.equal(g.lerNivelPreco("Voos de ida"), null);
});

test("link final traz idioma, moeda e o tfu simples no lugar do código longo da sessão", () => {
  const url = g.linkParaCompartilhar("https://www.google.com/travel/flights/booking?tfs=ABC&tfu=CnhDalJJUVdweFJXaDJiM0ZY");
  assert.ok(url.includes("hl=pt") && url.includes("gl=br") && url.includes("curr=BRL") && url.includes("tfs=ABC"));
  assert.ok(url.includes("tfu=EgIIAQ") && !url.includes("CnhDalJJ"));
});

test("tira o 'Operado por' do nome da companhia", () => {
  const linha = g.lerLinhaVoo("08:05\n–\n10:25\nLATAMOperado por Latam Airlines Brasil\n2h 20 min\nGRU–SSA\nSem escalas\nR$ 422\nsó ida");
  assert.equal(linha.companhia, "LATAM");
});

test("descarta voos com passagens separadas", () => {
  assert.equal(g.lerLinhaVoo("04:10\n–\n10:20\nPassagens separadas\n6h 10 min\nFOR–GYN\n1 escala\nR$ 1.996\nida e volta"), null);
});

test("candidatos: o melhor voo das companhias mais baratas", () => {
  const base = { saida: "", chegada: "", rota: "" };
  const linhas = [
    { ...base, companhia: "Gol", preco: 1828, escalas: 2, minutos: 720 },
    { ...base, companhia: "Gol", preco: 1828, escalas: 1, minutos: 365 },
    { ...base, companhia: "Azul", preco: 1874, escalas: 1, minutos: 325 },
    { ...base, companhia: "LATAM", preco: 2411, escalas: 1, minutos: 300 },
    { ...base, companhia: "Voepass", preco: 3000, escalas: 1, minutos: 300 },
  ];
  const candidatos = g.escolherCandidatos(linhas, 3);
  assert.equal(JSON.stringify(candidatos.map((c) => [c.companhia, c.escalas])), JSON.stringify([["Gol", 1], ["Azul", 1], ["LATAM", 1]]));
});

test("reconhece o mesmo voo pela companhia e pelos horários", () => {
  const a = { companhia: "Gol", saida: "05:00", chegada: "17:00" };
  assert.equal(g.mesmoVoo(a, { ...a, preco: 1 }), true);
  assert.equal(g.mesmoVoo(a, { ...a, chegada: "18:00" }), false);
});

test("lê os voos internacionais reais do Google (chegada no dia seguinte, várias companhias)", () => {
  const latam = g.lerLinhaVoo("12:10\n – \n09:45+1\nLATAMOperado por Latam Airlines Brasil, Latam Airlines Brasil\n17h 35 min\nGYN–CDG\n1 parada\n4h 30 min GRU\n600 kg CO2e\n10% menos emissões\nR$ 7.496\nida e volta");
  assert.equal(latam.companhia, "LATAM");
  assert.equal(latam.preco, 7496);
  assert.equal(latam.escalas, 1);
  assert.equal(latam.minutos, 17 * 60 + 35);
  assert.equal(g.descreverVoo(latam), "LATAM · 12:10 → 09:45 (+1 dia) · 1 escala");

  const mista = g.lerLinhaVoo("11:00\n – \n15:30+1\nGol, KLM, Air France\n24h 30 min\nGYN–CDG\n2 paradas\nGRU, AMS\n814 kg CO2e\n22% mais emissões\nR$ 8.577\nida e volta");
  assert.equal(mista.companhia, "Gol, KLM, Air France");
  assert.equal(mista.escalas, 2);
});
