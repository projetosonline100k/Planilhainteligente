import type { Metadata } from "next";
import MinhaViagem from "@/components/MinhaViagem";

export const metadata: Metadata = {
  title: "Minha Viagem | Planejador Financeiro de Viagens",
};

export default function PaginaMinhaViagem() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white shadow-xl overflow-hidden">
          <MinhaViagem />
        </div>
      </div>
    </main>
  );
}
