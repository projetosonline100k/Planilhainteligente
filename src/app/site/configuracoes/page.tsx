"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Sessao = { nome: string; email: string } | null;

export default function SiteConfiguracoes() {
  const router = useRouter();
  const [sessao, setSessao] = useState<Sessao>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) { setCarregando(false); return; }
      const meta = user.user_metadata || {};
      setSessao({ nome: meta.full_name || meta.name || "Viajante", email: user.email || "" });
      setCarregando(false);
    });
  }, []);

  async function sair() {
    await supabase.auth.signOut();
    router.push("/site");
  }

  return (
    <div className="px-5 py-8 sm:px-8 lg:py-10">
      <p className="text-xs font-black uppercase tracking-widest text-blue-600">Preferências</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Minha conta</h1>

      {!carregando && !sessao && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Entre na sua conta para gerenciar suas configurações.
          <Link href="/login" className="ml-2 font-black text-blue-700 hover:underline">Entrar</Link>
        </div>
      )}

      {sessao && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-black text-slate-900">Conta</p>
          <p className="mt-2 text-sm text-slate-600">{sessao.nome}</p>
          <p className="text-sm text-slate-500">{sessao.email}</p>
          <button
            type="button"
            onClick={() => void sair()}
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            Sair da conta
          </button>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-black text-slate-900">Notificações</p>
        <p className="mt-1 text-sm text-slate-500">Gerencie a permissão de notificações nas configurações do seu dispositivo ou navegador.</p>
      </section>
    </div>
  );
}
