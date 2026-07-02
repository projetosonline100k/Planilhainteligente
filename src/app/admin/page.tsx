"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ADMIN_EMAIL } from "@/lib/admin";
import AppLoading from "@/components/AppLoading";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function verificarAdmin() {
      const { data } = await supabase.auth.getUser();

      if (cancelado) return;

      if (data.user?.email !== ADMIN_EMAIL) {
        router.replace("/login");
        return;
      }

      setIsChecking(false);
    }

    verificarAdmin();

    return () => {
      cancelado = true;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setIsSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setIsSaving(false);
      setError("Sessao expirada. Entre novamente.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const result = (await response.json()) as { error?: string; user?: { email?: string } };
    setIsSaving(false);

    if (!response.ok) {
      setError(result.error ?? "Nao foi possivel criar o usuario.");
      return;
    }

    setStatus(`Usuario ${result.user?.email ?? email} criado com sucesso.`);
    setEmail("");
    setPassword("");
  }

  async function handleSair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (isChecking) {
    return <AppLoading label="Verificando acesso" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_78%_0%,rgba(14,165,233,0.34),transparent_34%),linear-gradient(180deg,#020617_0%,#020617_55%,#07111f_100%)] px-4 py-10">
      <section className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">
            Início
          </Link>
          <button
            type="button"
            onClick={handleSair}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Sair
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white p-6 shadow-xl shadow-black/20">
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="mt-2 text-sm text-gray-500">
            Adicione usuários que poderão acessar o planejador.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Email do usuário</span>
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
              <span className="text-sm font-medium text-gray-700">Senha inicial</span>
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

            {status && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {status}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "Criando..." : "Adicionar usuário"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
