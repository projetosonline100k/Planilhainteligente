"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { isAdminEmail } from "@/lib/admin";
import AppLoading from "@/components/AppLoading";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsLoading(false);
      setError(signInError.message);
      return;
    }

    const userId = data.user?.id;
    const userEmail = data.user?.email;

    if (!userId) {
      setIsLoading(false);
      setError("Nao foi possivel identificar o usuario logado.");
      return;
    }

    if (isAdminEmail(userEmail)) {
      setIsLoading(false);
      router.push("/admin");
      return;
    }

    setIsLoading(false);
    router.push("/minha-viagem");
  }

  if (checkingSession) {
    return <AppLoading label="Verificando acesso" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_78%_0%,rgba(14,165,233,0.34),transparent_34%),linear-gradient(180deg,#020617_0%,#020617_55%,#07111f_100%)] px-4 py-10">
      <section className="w-full max-w-sm">
        <Link href="/" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
          Voltar
        </Link>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white p-6 shadow-xl shadow-black/20">
          <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
          <p className="mt-2 text-sm text-gray-500">
            Acesse sua conta para continuar planejando sua viagem.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Acesso liberado apenas para usuários cadastrados.
          </p>
        </div>
      </section>
    </main>
  );
}
