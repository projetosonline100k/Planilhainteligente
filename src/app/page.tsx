"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLoading from "@/components/AppLoading";
import { isAdminEmail } from "@/lib/admin";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function verificarSessao() {
      const { data } = await supabase.auth.getSession();
      const userEmail = data.session?.user.email;

      if (cancelado) return;

      if (isAdminEmail(userEmail)) {
        router.replace("/admin");
        return;
      }

      if (data.session) {
        router.replace("/minha-viagem");
        return;
      }

      setCheckingSession(false);
    }

    verificarSessao();

    return () => {
      cancelado = true;
    };
  }, [router]);

  if (checkingSession) {
    return <AppLoading label="Abrindo sua viagem" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_78%_0%,rgba(14,165,233,0.34),transparent_34%),linear-gradient(180deg,#020617_0%,#020617_55%,#07111f_100%)] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-black tracking-tight text-white">
          Planejador Financeiro de Viagens
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/65">
          Descubra quanto precisa guardar por mês para realizar sua próxima viagem.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-100"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
