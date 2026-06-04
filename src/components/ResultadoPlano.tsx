import { PlanoViagem } from "@/types/travel";

type Props = {
  plano: PlanoViagem;
  onNovaSimulacao: () => void;
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pluralMes(n: number): string {
  return `${n} ${n === 1 ? "mês" : "meses"}`;
}

function MetricaCard({
  label,
  valor,
  destaque = false,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque
          ? "border-amber-200 bg-amber-50"
          : "border-gray-100 bg-gray-50"
      }`}
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-lg font-semibold ${
          destaque ? "text-amber-700" : "text-gray-900"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

export default function ResultadoPlano({ plano, onNovaSimulacao }: Props) {
  const {
    custoTotal,
    mesesAteViagem,
    valorNecessarioPorMes,
    valorGuardadoPorMes,
    consegueViajarNaData,
    mesesNecessariosComValorAtual,
    mensagemResumo,
  } = plano;

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border p-5 ${
          consegueViajarNaData
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <p
          className={`text-base font-medium leading-relaxed ${
            consegueViajarNaData ? "text-green-800" : "text-amber-800"
          }`}
        >
          {mensagemResumo}
        </p>
      </div>

      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
          consegueViajarNaData
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {consegueViajarNaData
          ? "✓ Você consegue viajar na data desejada"
          : "⚠ Você precisará de mais tempo"}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricaCard label="Custo total estimado" valor={formatarMoeda(custoTotal)} />
        <MetricaCard label="Meses até a viagem" valor={pluralMes(mesesAteViagem)} />
        <MetricaCard label="Precisa guardar por mês" valor={formatarMoeda(valorNecessarioPorMes)} />
        <MetricaCard label="Você guarda por mês" valor={formatarMoeda(valorGuardadoPorMes)} />
        {!consegueViajarNaData && (
          <MetricaCard
            label="Com seu ritmo atual, você viaja em"
            valor={pluralMes(mesesNecessariosComValorAtual)}
            destaque
          />
        )}
      </div>

      <button
        onClick={onNovaSimulacao}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        Fazer nova simulação
      </button>
    </div>
  );
}
