"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { isAdminEmail } from "@/lib/admin";
import AppLoading from "@/components/AppLoading";
import { supabase } from "@/lib/supabase";

type Usuario = {
  id: string;
  email?: string;
  createdAt?: string;
  lastSignInAt?: string;
};

type MetricasVendas = {
  approvedSales: number;
  activeCustomers: number;
  revenueCents: number;
  newCustomers30Days: number;
};

function moedaCentavos(valor: number): string {
  return (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data?: string): string {
  if (!data) return "Ainda não acessou";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(data)
  );
}

function adicionarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");
  const [totalUsuarios, setTotalUsuarios] = useState<number | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [metricas, setMetricas] = useState<MetricasVendas | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isImportingSales, setIsImportingSales] = useState(false);

  const getHeaders = useCallback(async (): Promise<HeadersInit | null> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }, []);

  const carregarPainel = useCallback(async () => {
    const headers = await getHeaders();
    if (!headers) {
      router.replace("/login");
      return;
    }

    setIsLoadingData(true);
    const [usuariosResponse, promptResponse, metricasResponse] = await Promise.all([
      fetch("/api/admin/users", { headers }),
      fetch("/api/admin/flight-prompt", { headers }),
      fetch("/api/admin/sales-metrics", { headers }),
    ]);
    const usuariosBody = (await usuariosResponse.json()) as { total?: number; users?: Usuario[]; error?: string };
    const promptBody = (await promptResponse.json()) as { prompt?: string; updatedAt?: string | null; error?: string };
    const metricasBody = (await metricasResponse.json()) as MetricasVendas & { error?: string };

    if (usuariosResponse.ok) {
      setTotalUsuarios(usuariosBody.total ?? 0);
      setUsuarios(usuariosBody.users ?? []);
    } else {
      setError(usuariosBody.error ?? "Não foi possível carregar os usuários.");
    }

    if (promptResponse.ok && promptBody.prompt) {
      setPrompt(promptBody.prompt);
      setUpdatedAt(promptBody.updatedAt ?? null);
    } else {
      setError((atual) => atual || promptBody.error || "Não foi possível carregar o prompt.");
    }
    if (metricasResponse.ok) setMetricas(metricasBody);

    setIsLoadingData(false);
  }, [getHeaders, router]);

  useEffect(() => {
    let cancelado = false;

    async function verificarAdmin() {
      const { data } = await supabase.auth.getUser();
      if (cancelado) return;
      if (!isAdminEmail(data.user?.email)) {
        router.replace("/login");
        return;
      }
      setIsChecking(false);
      void carregarPainel();
    }

    void verificarAdmin();
    return () => {
      cancelado = true;
    };
  }, [carregarPainel, router]);

  async function handleCriarUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setIsSavingUser(true);
    const headers = await getHeaders();
    if (!headers) {
      setIsSavingUser(false);
      setError("Sessão expirada. Entre novamente.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = (await response.json()) as { error?: string; user?: { email?: string } };
    setIsSavingUser(false);
    if (!response.ok) {
      setError(result.error ?? "Não foi possível criar o usuário.");
      return;
    }
    setStatus(`Usuário ${result.user?.email ?? email} criado com sucesso.`);
    setEmail("");
    setPassword("");
    void carregarPainel();
  }

  async function handleSalvarPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    setIsSavingPrompt(true);
    const headers = await getHeaders();
    if (!headers) {
      setIsSavingPrompt(false);
      setError("Sessão expirada. Entre novamente.");
      return;
    }

    const response = await fetch("/api/admin/flight-prompt", {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const result = (await response.json()) as { error?: string; updatedAt?: string };
    setIsSavingPrompt(false);
    if (!response.ok) {
      setError(result.error ?? "Não foi possível salvar o prompt.");
      return;
    }
    setUpdatedAt(result.updatedAt ?? new Date().toISOString());
    setStatus("Prompt de passagens atualizado com sucesso.");
  }

  async function handleImportarVendas() {
    if (!window.confirm("Importar todo o historico de vendas do produto Aplicativo Inteligente? Isso tambem criara ou atualizara os acessos dos compradores.")) return;

    setStatus("");
    setError("");
    setIsImportingSales(true);
    const headers = await getHeaders();
    if (!headers) {
      setIsImportingSales(false);
      setError("Sessao expirada. Entre novamente.");
      return;
    }

    const agora = new Date();
    let inicio = new Date("2020-01-01T00:00:00.000Z");
    let totalImportado = 0;
    let totalAtivado = 0;
    let totalBloqueado = 0;

    try {
      while (inicio <= agora) {
        const fim = new Date(Math.min(adicionarDias(inicio, 90).getTime() - 1, agora.getTime()));
        setStatus(`Importando vendas de ${inicio.toLocaleDateString("pt-BR")} ate ${fim.toLocaleDateString("pt-BR")}…`);
        const response = await fetch("/api/admin/import-kiwify-sales", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: inicio.toISOString(), endDate: fim.toISOString() }),
        });
        const result = (await response.json()) as { imported?: number; activated?: number; blocked?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Nao foi possivel importar as vendas.");
        totalImportado += result.imported ?? 0;
        totalAtivado += result.activated ?? 0;
        totalBloqueado += result.blocked ?? 0;
        inicio = adicionarDias(inicio, 90);
      }
      setStatus(`${totalImportado} vendas importadas. ${totalAtivado} acessos liberados e ${totalBloqueado} bloqueados.`);
      void carregarPainel();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Nao foi possivel importar as vendas.");
    } finally {
      setIsImportingSales(false);
    }
  }

  async function handleSair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (isChecking) return <AppLoading label="Verificando acesso" />;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_78%_0%,rgba(14,165,233,0.34),transparent_34%),linear-gradient(180deg,#020617_0%,#020617_55%,#07111f_100%)] px-4 py-8 text-slate-900">
      <section className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-cyan-200 hover:text-cyan-100">Início</Link>
          <button type="button" onClick={handleSair} className="text-sm font-medium text-red-300 hover:text-red-200">Sair</button>
        </div>

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Área restrita</p>
          <h1 className="mt-2 text-3xl font-black text-white">Painel administrativo</h1>
          <p className="mt-2 text-sm text-slate-300">Gerencie os acessos e as instruções do assistente de passagens.</p>
        </header>

        {(error || status) && <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{error || status}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <article className="rounded-3xl border border-white/10 bg-white p-6 shadow-xl shadow-black/20">
              <p className="text-sm font-medium text-slate-500">Vendas Kiwify</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">{metricas ? moedaCentavos(metricas.revenueCents) : "…"}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><p><strong>{metricas?.approvedSales ?? "…"}</strong><br /><span className="text-slate-500">vendas ativas</span></p><p><strong>{metricas?.newCustomers30Days ?? "…"}</strong><br /><span className="text-slate-500">novos em 30 dias</span></p></div>
              <button type="button" onClick={handleImportarVendas} disabled={isImportingSales} className="mt-5 w-full rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">{isImportingSales ? "Importando historico…" : "Importar historico de vendas"}</button>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white p-6 shadow-xl shadow-black/20">
              <p className="text-sm font-medium text-slate-500">Usuários cadastrados</p>
              <p className="mt-2 text-4xl font-black text-slate-950">{isLoadingData || totalUsuarios === null ? "…" : totalUsuarios}</p>
              <p className="mt-2 text-sm text-slate-500">Total de contas com acesso ao planejador.</p>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white p-6 shadow-xl shadow-black/20">
              <h2 className="text-xl font-bold">Cadastrar usuário</h2>
              <p className="mt-1 text-sm text-slate-500">Crie uma conta já confirmada, pronta para entrar.</p>
              <form onSubmit={handleCriarUsuario} className="mt-5 space-y-4">
                <label className="block"><span className="text-sm font-medium text-slate-700">E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                <label className="block"><span className="text-sm font-medium text-slate-700">Senha inicial</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
                <button type="submit" disabled={isSavingUser} className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isSavingUser ? "Criando…" : "Adicionar usuário"}</button>
              </form>
            </article>
          </div>

          <article className="rounded-3xl border border-white/10 bg-white p-6 shadow-xl shadow-black/20">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-xl font-bold">Prompt de passagens</h2><p className="mt-1 text-sm text-slate-500">Estas instruções serão usadas na próxima consulta do assistente.</p></div>{updatedAt && <span className="text-xs text-slate-400">Atualizado: {formatarData(updatedAt)}</span>}</div>
            <form onSubmit={handleSalvarPrompt} className="mt-5"><label className="block"><span className="sr-only">Instruções do assistente de passagens</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} required maxLength={20_000} rows={22} className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs leading-relaxed outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{prompt.length.toLocaleString("pt-BR")} / 20.000 caracteres</span><button type="submit" disabled={isSavingPrompt || !prompt.trim()} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isSavingPrompt ? "Salvando…" : "Salvar prompt"}</button></div></form>
          </article>
        </div>

        <article className="mt-6 rounded-3xl border border-white/10 bg-white p-6 shadow-xl shadow-black/20">
          <div className="flex items-baseline justify-between gap-3"><h2 className="text-xl font-bold">Usuários cadastrados</h2><span className="text-sm text-slate-500">{usuarios.length} exibidos</span></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="pb-3 font-semibold">E-mail</th><th className="pb-3 font-semibold">Cadastro</th><th className="pb-3 font-semibold">Último acesso</th></tr></thead><tbody>{usuarios.map((usuario) => <tr key={usuario.id} className="border-b border-slate-100 last:border-0"><td className="py-3 font-medium text-slate-800">{usuario.email ?? "Sem e-mail"}</td><td className="py-3 text-slate-500">{formatarData(usuario.createdAt)}</td><td className="py-3 text-slate-500">{formatarData(usuario.lastSignInAt)}</td></tr>)}{!isLoadingData && usuarios.length === 0 && <tr><td colSpan={3} className="py-5 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>}</tbody></table></div>
        </article>
      </section>
    </main>
  );
}
