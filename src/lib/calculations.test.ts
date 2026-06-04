// Testes para calcularPlanoViagem
// Para ativar: instale vitest (`npm install -D vitest`) e adicione
// "test": "vitest" nos scripts do package.json.
//
// import { describe, it, expect } from "vitest";
// import { calcularPlanoViagem } from "./calculations";
//
// const HOJE = new Date("2025-01-01");
//
// describe("calcularPlanoViagem", () => {
//   it("calcula custo total corretamente", () => {
//     const resultado = calcularPlanoViagem(
//       {
//         destino: "Cancún",
//         dataIda: "2025-11-01",
//         dataVolta: "2025-11-15",
//         valorPassagem: 2000,
//         valorHospedagem: 1500,
//         valorAlimentacao: 800,
//         valorPasseios: 700,
//         valorGuardadoPorMes: 600,
//       },
//       HOJE
//     );
//     expect(resultado.custoTotal).toBe(5000);
//   });
//
//   it("indica que consegue viajar na data quando valor guardado é suficiente", () => {
//     // custoTotal = 5000, mesesAteViagem = 10, valorNecessario = 500
//     // valorGuardadoPorMes = 600 >= 500 → consegueViajarNaData = true
//     const resultado = calcularPlanoViagem(
//       {
//         destino: "Cancún",
//         dataIda: "2025-11-01",
//         dataVolta: "2025-11-15",
//         valorPassagem: 2000,
//         valorHospedagem: 1500,
//         valorAlimentacao: 800,
//         valorPasseios: 700,
//         valorGuardadoPorMes: 600,
//       },
//       HOJE
//     );
//     expect(resultado.consegueViajarNaData).toBe(true);
//     expect(resultado.mesesNecessariosComValorAtual).toBe(9); // ceil(5000/600)
//   });
//
//   it("indica que não consegue viajar na data quando valor guardado é insuficiente", () => {
//     // custoTotal = 14000, mesesAteViagem = 6, valorNecessario ≈ 2334
//     // valorGuardadoPorMes = 500 < 2334 → consegueViajarNaData = false
//     // mesesNecessarios = ceil(14000/500) = 28
//     const resultado = calcularPlanoViagem(
//       {
//         destino: "Maldivas",
//         dataIda: "2025-07-01",
//         dataVolta: "2025-07-15",
//         valorPassagem: 8000,
//         valorHospedagem: 4000,
//         valorAlimentacao: 1500,
//         valorPasseios: 500,
//         valorGuardadoPorMes: 500,
//       },
//       HOJE
//     );
//     expect(resultado.consegueViajarNaData).toBe(false);
//     expect(resultado.mesesNecessariosComValorAtual).toBe(28);
//     expect(resultado.mensagemResumo).toContain("28 meses");
//   });
//
//   it("nunca retorna mesesAteViagem menor que 1", () => {
//     const resultado = calcularPlanoViagem(
//       {
//         destino: "Paris",
//         dataIda: "2024-01-01", // data no passado
//         dataVolta: "2024-01-10",
//         valorPassagem: 3000,
//         valorHospedagem: 2000,
//         valorAlimentacao: 1000,
//         valorPasseios: 500,
//         valorGuardadoPorMes: 1000,
//       },
//       HOJE
//     );
//     expect(resultado.mesesAteViagem).toBeGreaterThanOrEqual(1);
//   });
//
//   it("ecoa valorGuardadoPorMes na saída", () => {
//     const resultado = calcularPlanoViagem(
//       {
//         destino: "Tóquio",
//         dataIda: "2025-12-01",
//         dataVolta: "2025-12-15",
//         valorPassagem: 5000,
//         valorHospedagem: 3000,
//         valorAlimentacao: 1500,
//         valorPasseios: 500,
//         valorGuardadoPorMes: 800,
//       },
//       HOJE
//     );
//     expect(resultado.valorGuardadoPorMes).toBe(800);
//   });
// });
