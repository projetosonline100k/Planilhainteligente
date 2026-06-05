"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CadastroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setIsLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/diagnostico");
      return;
    }

    setMessage("Cadastro criado. Confira seu email para confirmar a conta.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-sm">
        <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Voltar
        </Link>

        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Criar cadastro</h1>
          <p className="mt-2 text-sm text-gray-500">
            Crie sua conta para salvar a evolucao do seu planejamento.
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
                minLength={6}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            {message && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {isLoading ? "Criando..." : "Criar cadastro"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Ja tem conta?{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              Entrar
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
