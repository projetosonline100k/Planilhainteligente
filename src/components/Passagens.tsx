"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BuscaSalva, listarRecentes } from "@/lib/flightSearchStorage";

function formatarData(data: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${data}T12:00:00Z`)); }

function NavegacaoPassagens() {
  return <nav className="hidden"><span /></nav>;
}

export default function Passagens() {
  const [ultimaBusca, setUltimaBusca] = useState<BuscaSalva | null>(null);
  useEffect(() => { queueMicrotask(() => setUltimaBusca(listarRecentes()[0] ?? null)); }, []);
  return <div className="min-h-dvh bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.25),transparent_28%),linear-gradient(160deg,#061b31_0%,#020617_58%,#05192b_100%)] pb-28 text-white"><header className="px-5 pb-5 pt-10"><Link href="/minha-viagem" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-2xl text-white/80" aria-label="Voltar">‹</Link><p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Suas passagens</p><h1 className="mt-2 text-3xl font-black tracking-tight">Planeje e acompanhe</h1><p className="mt-2 text-sm leading-relaxed text-white/65">Pesquise voos em tempo real e acompanhe os alertas que criou.</p></header><main className="space-y-4 px-4">{ultimaBusca && <Link href="/buscar-passagens" className="block rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">Sua última pesquisa</p><div className="mt-2 flex items-center justify-between gap-3"><div><p className="text-xl font-black">{ultimaBusca.origin} <span className="text-cyan-300">→</span> {ultimaBusca.destination}</p><p className="mt-1 text-xs text-white/55">Ida: {formatarData(ultimaBusca.outboundDate)}{ultimaBusca.returnDate ? ` · Volta: ${formatarData(ultimaBusca.returnDate)}` : " · Só ida"}</p></div><span className="shrink-0 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950">Continuar</span></div></Link>}<div className="grid gap-3 sm:grid-cols-2"><Link href="/buscar-passagens" className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-cyan-300/30"><span className="text-2xl">⌕</span><h2 className="mt-3 font-black">Buscar passagens</h2><p className="mt-1 text-xs leading-relaxed text-white/50">Consulte preços e datas diretamente no Google Flights.</p></Link><Link href="/alertas" className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-amber-300/30"><span className="text-2xl">🔔</span><h2 className="mt-3 font-black">Meus alertas</h2><p className="mt-1 text-xs leading-relaxed text-white/50">Veja alertas ativos e expirados ou remova os que não deseja mais.</p></Link></div></main><NavegacaoPassagens /></div>;
}
