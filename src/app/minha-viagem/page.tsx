import type { Metadata } from "next";
import MinhaViagem from "@/components/MinhaViagem";

export const metadata: Metadata = {
  title: "Minha Viagem | Planejador Financeiro de Viagens",
};

export default function PaginaMinhaViagem() {
  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 flex items-start justify-center px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-sm min-w-0">
        <div className="rounded-3xl bg-white shadow-xl overflow-hidden">
          <MinhaViagem />
        </div>
      </div>
    </main>
  );
}
