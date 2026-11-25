"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLoading from "@/components/AppLoading";
import Conversas from "@/components/agente/Conversas";
import Fluxo from "@/components/agente/Fluxo";
import Simulador from "@/components/agente/Simulador";
import VisaoGeral from "@/components/agente/VisaoGeral";
import { isAdminEmail } from "@/lib/admin";
import { supabase } from "@/lib/supabase";

type Aba = "visao" | "conversas" | "fluxo" | "simulador";

const ABAS: Array<{ id: Aba; titulo: string; icone: string }> = [
  { id: "visao", titulo: "Visão geral", icone: "📊" },
  { id: "conversas", titulo: "Conversas", icone: "💬" },
  { id: "fluxo", titulo: "Fluxo e configuração", icone: "🧭" },
  { id: "simulador", titulo: "Simulador", icone: "🧪" },
];

export default function AgentePage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [aba, setAba] = useState<Aba>("visao");
  const [contatoAberto, setContatoAberto] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelado) return;
      if (!isAdminEmail(data.user?.email)) router.replace("/login");
      else setVerificando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [router]);

  if (verificando) return <AppLoading label="Verificando acesso" />;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_78%_0%,rgba(16,185,129,0.22),transparent_34%),linear-gradient(180deg,#020617_0%,#020617_55%,#07111f_100%)] px-4 py-6 text-slate-900">
      <section className="mx-auto w-full max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">← Painel administrativo</Link>
        </div>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">WhatsApp</p>
            <h1 className="mt-1 text-3xl font-black text-white">Agente de viagens</h1>
            <p className="mt-1 text-sm text-slate-300">Configure o fluxo, teste no simulador e acompanhe quem está conversando.</p>
          </div>
        </header>

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Seções do agente">
          {ABAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAba(item.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${aba === item.id ? "bg-white text-slate-950" : "bg-white/10 text-slate-200 hover:bg-white/20"}`}
            >
              <span className="mr-1.5" aria-hidden>{item.icone}</span>
              {item.titulo}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {aba === "visao" && (
            <VisaoGeral
              onAbrirConversa={(id) => {
                setContatoAberto(id);
                setAba("conversas");
              }}
            />
          )}
          {aba === "conversas" && <Conversas contatoInicial={contatoAberto} />}
          {aba === "fluxo" && <Fluxo />}
          {aba === "simulador" && <Simulador />}
        </div>
      </section>
    </main>
  );
}
