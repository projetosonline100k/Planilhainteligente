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
    <main className="min-h-screen bg-slate-100 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white shadow-xl overflow-hidden">
          <div className="px-6 py-8">
            <h1 className="text-center text-base font-semibold text-gray-800 mb-6">
              Diagnóstico
            </h1>
            <FormularioDiagnostico modoEdicao={modoEdicao} />
          </div>
        </div>
      </div>
    </main>
  );
}
