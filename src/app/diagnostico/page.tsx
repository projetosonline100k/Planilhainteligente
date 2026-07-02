import type { Metadata } from "next";
import FormularioDiagnostico from "@/components/FormularioDiagnostico";

export const metadata: Metadata = {
  title: "Diagnóstico da viagem | Planejador Financeiro de Viagens",
};

export default async function PaginaDiagnostico({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  const { editar } = await searchParams;
  const modoEdicao = editar === "1";

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#020617] sm:bg-slate-950 sm:flex sm:items-start sm:justify-center sm:px-4 sm:py-10">
      <div className="w-full min-w-0 sm:max-w-sm">
        <div className="min-h-dvh overflow-hidden bg-[#020617] sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
          <div className="px-4 py-7 sm:px-6 sm:py-8">
            <h1 className="text-center text-lg font-semibold text-white mb-7 sm:text-base sm:mb-6">
              Diagnóstico
            </h1>
            <div className="rounded-3xl bg-white px-4 py-5 shadow-xl shadow-black/20">
              <FormularioDiagnostico modoEdicao={modoEdicao} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
