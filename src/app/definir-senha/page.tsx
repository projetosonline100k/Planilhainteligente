"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLoading from "@/components/AppLoading";
import { supabase } from "@/lib/supabase";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setReady(true);
      else setError("Este convite expirou ou não é mais válido. Solicite um novo acesso.");
    });
  }, []);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setError("Use uma senha de pelo menos 8 caracteres.");
    if (password !== confirmacao) return setError("As senhas não coincidem.");
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    router.replace("/minha-viagem");
  }

  if (!ready && !error) return <AppLoading label="Validando convite" />;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4"><form onSubmit={salvar} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl"><h1 className="text-2xl font-bold text-slate-900">Crie sua senha</h1><p className="mt-2 text-sm text-slate-500">Use esta senha nos próximos acessos.</p>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="mt-5 block text-sm font-medium text-slate-700">Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="mt-4 block text-sm font-medium text-slate-700">Confirme a senha<input type="password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} required minLength={8} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button disabled={saving || !ready} className="mt-6 w-full rounded-full bg-slate-950 px-4 py-3 font-semibold text-white disabled:bg-slate-300">{saving ? "Salvando..." : "Salvar e entrar"}</button></form></main>;
}
