"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ADMIN_EMAIL } from "@/lib/admin";
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

    if (userEmail === ADMIN_EMAIL) {
      setIsLoading(false);
      router.push("/admin");
      return;
    }

    setIsLoading(false);
    router.push("/minha-viagem");
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <p className="text-sm text-gray-500">Verificando acesso...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-sm">
        <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Voltar
        </Link>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
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
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
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
