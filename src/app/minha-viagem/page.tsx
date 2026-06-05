import type { Metadata } from "next";
import MinhaViagem from "@/components/MinhaViagem";

export const metadata: Metadata = {
  title: "Minha Viagem | Planejador Financeiro de Viagens",
};

export default function PaginaMinhaViagem() {
  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-white sm:bg-slate-100 sm:flex sm:items-start sm:justify-center sm:px-4 sm:py-10">
      <div className="w-full min-w-0 sm:max-w-sm">
        <div className="min-h-dvh overflow-hidden bg-white sm:min-h-0 sm:rounded-3xl sm:shadow-xl">
          <MinhaViagem />
        </div>
      </div>
    </main>
  );
}
