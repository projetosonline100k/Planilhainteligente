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
  vm.runInNewContext(code, { exports, process: { env: {} }, Number, Math });
  return exports;
}

const { formatarOferta, periodo, linkDaOferta, codigoCurto, formatarCartaoBusca, formatarComparativo } = load("src/lib/agente/ofertaTexto.ts");

const oferta = {
  id: "abc",
  origin_name: "Goiânia",
  destination_name: "Fortaleza",
  price: 909,
  typical_price: 1673,
  savings_percentage: 46,
  outbound_date: "2027-01-30",
  return_date: "2027-02-06",
  booking_url: "https://www.google.com/travel/flights?tfs=XYZ",
};

test("cartão da oferta igual ao modelo, com o link direto da passagem", () => {
  assert.equal(
    formatarOferta(oferta),
    [
      "Achei a melhor opção pra você ✈️",
      "Goiânia → Fortaleza",
      "📅 30/01 a 06/02/2027",
      "💰 R$ 909 ida e volta",
      "📉 46% abaixo do preço normal (R$ 1.673)",
      "🔗 Ver oferta",
      "https://www.google.com/travel/flights?tfs=XYZ",
    ].join("\n")
  );
});

test("sem cabeçalho e só ida", () => {
  const texto = formatarOferta({ ...oferta, return_date: null }, { cabecalho: false });
  assert.ok(!texto.includes("Achei a melhor"));
  assert.ok(texto.includes("💰 R$ 909 só ida"));
  assert.ok(texto.includes("📅 30/01/2027"));
});

test("virada de ano mostra o ano nas duas datas", () => {
  assert.equal(periodo("2026-12-28", "2027-01-04"), "28/12/2026 a 04/01/2027");
});

test("sem link direto usa o link /o/ com o código sem hífens", () => {
  const id = "a970179b-26fd-4076-9e4a-bd5c44f63d95";
  assert.equal(linkDaOferta({ id, booking_url: null }), "https://vaiviajar.vercel.app/o/a970179b26fd40769e4abd5c44f63d95");
});

test("link curto usa os 10 primeiros caracteres do id e só vale quando há link direto", () => {
  const id = "A970179B-26fd-4076-9e4a-bd5c44f63d95";
  assert.equal(codigoCurto(id), "a970179b26");
  assert.equal(linkDaOferta({ id, booking_url: "https://www.google.com/travel/flights?tfs=X" }, true), "https://vaiviajar.vercel.app/r/a970179b26");
  assert.equal(linkDaOferta({ id, booking_url: null }, true), "https://vaiviajar.vercel.app/o/a970179b26fd40769e4abd5c44f63d95");
});

test("cartão com link curto fica com a última linha curta", () => {
  const ultima = formatarOferta(oferta, { linkCurto: true }).split("\n").pop();
  assert.equal(ultima, "https://vaiviajar.vercel.app/r/abc");
});

test("com voo conferido, o link é o do voo mais barato e não o da oferta do radar", () => {
  const direto = linkDaOferta({ id: "abc", booking_url: "https://radar", link_voo: "https://voo-especifico" });
  assert.equal(direto, "https://voo-especifico");
  assert.equal(linkDaOferta({ id: "abcdef0123456789", booking_url: "https://radar", link_voo: "https://voo-especifico" }, true), "https://vaiviajar.vercel.app/r/abcdef0123");
});

test("cartão da busca ao vivo traz avaliação do preço, o voo e o link", () => {
  const texto = formatarCartaoBusca({
    origem: "Fortaleza", destino: "Belo Horizonte", ida: "2027-02-19", volta: "2027-02-25",
    preco: 969, nivel: "low", faixa: [1100, 1900], voo: "Gol G3 2057 · 03:25 → 09:30 · 1 escala", link: "https://vaiviajar.vercel.app/r/abc",
  });
  assert.equal(
    texto,
    [
      "Achei a melhor opção pra você ✈️",
      "Fortaleza → Belo Horizonte",
      "📅 19/02 a 25/02/2027",
      "💰 R$ 969 ida e volta",
      "📉 Preço baixo pra essa rota (o normal é R$ 1.100 a R$ 1.900)",
      "🛫 Gol G3 2057 · 03:25 → 09:30 · 1 escala",
      "🔗 Ver oferta",
      "https://vaiviajar.vercel.app/r/abc",
    ].join("\n")
  );
});

test("preço acima do normal é avisado e sem avaliação a linha some", () => {
  const base = { origem: "A", destino: "B", ida: "2027-02-19", volta: null, preco: 500, voo: null, link: "https://x" };
  assert.ok(formatarCartaoBusca({ ...base, nivel: "high", faixa: [200, 400] }).includes("⚠️ Preço acima do normal"));
  assert.ok(!formatarCartaoBusca({ ...base, nivel: null, faixa: null }).includes("normal"));
  assert.ok(formatarCartaoBusca({ ...base, nivel: null, faixa: null }).includes("só ida"));
});

test("comparativo lista as companhias e só aparece com mais de uma", () => {
  const texto = formatarComparativo([
    { companhia: "Gol", preco: 633, escalas: 0 },
    { companhia: "LATAM", preco: 816, escalas: 1 },
  ]);
  assert.equal(texto, "Comparei as companhias nessa data:\n✈️ Gol: R$ 633 (sem escalas)\n✈️ LATAM: R$ 816");
  assert.equal(formatarComparativo([{ companhia: "Gol", preco: 633, escalas: 0 }]), "");
});

test("sem faixa numérica, a avaliação do preço aparece só com a palavra", () => {
  const base = { origem: "A", destino: "B", ida: "2027-02-19", volta: "2027-02-25", preco: 633, voo: null, link: "https://x", faixa: null };
  assert.ok(formatarCartaoBusca({ ...base, nivel: "typical" }).includes("📊 Preço normal pra essa rota\n"));
  assert.ok(formatarCartaoBusca({ ...base, nivel: "low" }).includes("📉 Preço baixo pra essa rota\n"));
});
