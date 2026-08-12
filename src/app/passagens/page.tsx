import type { Metadata } from "next";
import Passagens from "@/components/Passagens";

export const metadata: Metadata = {
  title: "Passagens | Planejador Financeiro de Viagens",
};

export default function PaginaPassagens() {
  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#020617] sm:bg-slate-950 sm:flex sm:items-start sm:justify-center sm:px-4 sm:py-10">
      <div className="w-full min-w-0 sm:max-w-sm">
        <div className="min-h-dvh overflow-hidden bg-[#020617] sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
          <Passagens />
        </div>
      </div>
    </main>
  );
}
