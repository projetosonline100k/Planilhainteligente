import type { Metadata } from "next";
import Roteiro from "@/components/Roteiro";

export const metadata: Metadata = {
  title: "Roteiro | Planejador Financeiro de Viagens",
};

export default function PaginaRoteiro() {
  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#020617] sm:bg-slate-950 sm:flex sm:items-start sm:justify-center sm:px-4 sm:py-10">
      <div className="w-full min-w-0 sm:max-w-sm">
        <div className="min-h-dvh overflow-hidden bg-[#020617] sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
          <Roteiro />
        </div>
      </div>
    </main>
  );
}
