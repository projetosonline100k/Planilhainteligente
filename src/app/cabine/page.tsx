import type { Metadata } from "next";
import Cabine from "@/components/Cabine";

export const metadata: Metadata = {
  title: "Cabine | Planejador Financeiro de Viagens",
};

export default function PaginaCabine() {
  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-black sm:bg-slate-100 sm:flex sm:items-start sm:justify-center sm:px-4 sm:py-10">
      <div className="w-full min-w-0 sm:max-w-sm">
        <div className="min-h-dvh overflow-hidden bg-black sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
          <Cabine />
        </div>
      </div>
    </main>
  );
}
