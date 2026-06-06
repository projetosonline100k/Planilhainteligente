"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_EMAIL } from "@/lib/admin";
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

      if (userEmail === ADMIN_EMAIL) {
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
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-500">Abrindo sua viagem...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Planejador Financeiro de Viagens
        </h1>
        <p className="mt-4 text-base text-gray-500">
          Descubra quanto precisa guardar por mês para realizar sua próxima viagem.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
