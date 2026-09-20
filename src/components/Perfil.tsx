"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Perfil() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [nome, setNome] = useState("Viajante");
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { const user = data.user; if (!user) return; setEmail(user.email || ""); setNome(user.user_metadata?.full_name || user.user_metadata?.name || "Viajante"); }); }, []);
  return <main className="min-h-dvh bg-[linear-gradient(160deg,#061b31,#020617_60%,#05192b)] px-4 pb-32 pt-[calc(env(safe-area-inset-top)+5rem)] text-white"><div className="mx-auto max-w-lg"><p className="text-xs font-bold tracking-[.2em] text-cyan-300">SUA CONTA</p><h1 className="mt-2 text-3xl font-black">Perfil</h1><section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] p-5"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-300/15 text-3xl">👤</div><h2 className="mt-4 text-xl font-black">{nome}</h2><p className="mt-1 text-sm text-white/50">{email}</p></section><button type="button" onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }} className="mt-4 w-full rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200">Sair da conta</button></div></main>;
}
