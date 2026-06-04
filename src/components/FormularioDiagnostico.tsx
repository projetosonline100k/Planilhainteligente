"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DiagnosticoViagem } from "@/types/travel";
import { calcularPlanoViagem } from "@/lib/calculations";
import { criarNovaViagem, atualizarViagemAtiva, obterViagemAtiva } from "@/lib/storage";

const ESTADO_INICIAL: DiagnosticoViagem = {
  destino: "",
  dataIda: "",
  dataVolta: "",
  valorPassagem: 0,
  valorHospedagem: 0,
  valorAlimentacao: 0,
  valorPasseios: 0,
  valorGuardadoPorMes: 150,
};

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarTempo(plano: { diasAteViagem: number; mesesAteViagem: number }): string {
  if (plano.diasAteViagem < 30) {
    const d = plano.diasAteViagem;
    return `${d} ${d === 1 ? "dia" : "dias"}`;
  }
  const m = plano.mesesAteViagem;
  return `${m} ${m === 1 ? "mês" : "meses"}`;
}

function InputMoeda({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <p className="text-sm text-gray-700 mb-1">{label}</p>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400 text-sm">
          R$
        </span>
        <input
          id={id}
          name={id}
          type="number"
          min={0}
          value={value}
          onChange={onChange}
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-colors"
        />
      </div>
    </div>
  );
}

export default function FormularioDiagnostico({ modoEdicao = false }: { modoEdicao?: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState<DiagnosticoViagem>(() => {
    if (!modoEdicao) return ESTADO_INICIAL;
    // Lê a viagem ativa do store (guard SSR dentro de obterViagemAtiva)
    return obterViagemAtiva()?.dados ?? ESTADO_INICIAL;
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target;
    setDados((prev) => ({
      ...prev,
      [name]: type === "number" || type === "range" ? Number(value) : value,
    }));
  }

  function handleContinuar() {
    if (modoEdicao) {
      atualizarViagemAtiva(dados);
    } else {
      criarNovaViagem(dados);
    }
    router.push("/minha-viagem");
  }

  const destinoPreenchido = dados.destino.trim() !== "";
  const dataPreenchida = dados.dataIda !== "";
  const dataFutura = dataPreenchida && new Date(dados.dataIda) > new Date();
  const dataPassada = dataPreenchida && !dataFutura;

  const plano = destinoPreenchido && dataFutura ? calcularPlanoViagem(dados) : null;
  const podeMostrarResumo = plano !== null && plano.custoTotal > 0;
  const podeMostrarResultado = podeMostrarResumo && dados.valorGuardadoPorMes > 0;

  return (
    <div className="space-y-5">

      {/* Banner modo edição */}
      {modoEdicao && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs text-blue-700 leading-relaxed">
            ✏️ Você está editando sua viagem. Fique tranquilo: seu progresso não será perdido.
          </p>
        </div>
      )}

      {/* Destino */}
      <div>
        <p className="text-sm text-gray-700 mb-2">- Qual lugar você quer conhecer?</p>
        <input
          name="destino"
          type="text"
          autoComplete="off"
          placeholder="Ex: Maldivas, Paris, Cancún..."
          value={dados.destino}
          onChange={handleChange}
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-colors"
        />
      </div>

      {/* Datas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="dataIda" className="block text-xs text-gray-500 mb-1">
            Data de ida
          </label>
          <input
            id="dataIda"
            name="dataIda"
            type="date"
            value={dados.dataIda}
            onChange={handleChange}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="dataVolta" className="block text-xs text-gray-500 mb-1">
            Data de volta
          </label>
          <input
            id="dataVolta"
            name="dataVolta"
            type="date"
            value={dados.dataVolta}
            onChange={handleChange}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-colors"
          />
        </div>
      </div>

      {/* Aviso: data no passado */}
      {destinoPreenchido && dataPassada && (
        <p className="text-xs text-red-400">
          Escolha uma data futura para calcular sua viagem.
        </p>
      )}

      {/* Custos */}
      <div className="space-y-3">
        <InputMoeda
          id="valorPassagem"
          label="- Qual o valor da sua passagem?"
          hint="Ainda não comprou? Coloque uma estimativa."
          value={dados.valorPassagem}
          onChange={handleChange}
        />
        <InputMoeda
          id="valorHospedagem"
          label="- Qual o valor da hospedagem?"
          value={dados.valorHospedagem}
          onChange={handleChange}
        />
        <InputMoeda
          id="valorAlimentacao"
          label="- Quanto vai gastar em alimentação?"
          value={dados.valorAlimentacao}
          onChange={handleChange}
        />
        <InputMoeda
          id="valorPasseios"
          label="- Quanto vai gastar em passeios?"
          value={dados.valorPasseios}
          onChange={handleChange}
        />
      </div>

      {/* Aviso: custo zero com data válida */}
      {destinoPreenchido && dataFutura && plano && !podeMostrarResumo && (
        <p className="text-xs text-gray-400 italic">
          Preencha os custos estimados para ver sua projeção.
        </p>
      )}

      {/* Resumo dinâmico */}
      {podeMostrarResumo && plano && (
        <>
          <hr className="border-dashed border-gray-200" />
          <p className="text-sm text-gray-600 leading-relaxed">
            Você vai para{" "}
            <strong className="text-gray-900">{dados.destino}</strong>, seu custo vai ser{" "}
            <strong className="text-gray-900">{moeda(plano.custoTotal)}</strong>. Para chegar lá na
            data, você precisa guardar{" "}
            {plano.diasAteViagem < 30 ? (
              <>
                <strong className="text-gray-900">{moeda(plano.custoTotal)}</strong> em{" "}
                <strong className="text-gray-900">{formatarTempo(plano)}</strong>.
              </>
            ) : (
              <>
                <strong className="text-gray-900">{moeda(plano.valorNecessarioPorMes)}</strong> por
                mês durante{" "}
                <strong className="text-gray-900">{formatarTempo(plano)}</strong>.
              </>
            )}
          </p>
        </>
      )}

      {/* Slider */}
      <div>
        <p className="text-sm text-gray-700 mb-3">- Quanto você consegue guardar hoje?</p>
        <input
          type="range"
          name="valorGuardadoPorMes"
          min={0}
          max={5000}
          step={50}
          value={dados.valorGuardadoPorMes}
          onChange={handleChange}
          className="w-full cursor-pointer accent-orange-400"
        />
        <p className="text-center text-sm font-semibold text-green-600 mt-2">
          {moeda(dados.valorGuardadoPorMes)}
        </p>
      </div>

      {/* Resultado dinâmico */}
      {podeMostrarResultado && plano && (
        <p className="text-sm text-gray-700 leading-relaxed">
          Com base na sua resposta,{" "}
          {plano.consegueViajarNaData ? (
            "você consegue fazer sua viagem na data planejada."
          ) : (
            <>
              você vai levar{" "}
              <span className="font-bold text-orange-500">
                {plano.mesesNecessariosComValorAtual}{" "}
                {plano.mesesNecessariosComValorAtual === 1 ? "mês" : "meses"}
              </span>{" "}
              para fazer a sua viagem.
            </>
          )}
        </p>
      )}

      {/* Botão continuar */}
      <button
        type="button"
        onClick={handleContinuar}
        disabled={!destinoPreenchido || !dataFutura}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors ${
          destinoPreenchido && dataFutura
            ? "bg-green-500 hover:bg-green-600 cursor-pointer"
            : "bg-gray-300 cursor-not-allowed"
        }`}
      >
        Continuar
      </button>

    </div>
  );
}
