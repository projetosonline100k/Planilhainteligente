"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppLoading from "@/components/AppLoading";
import { estadoDestino, progressoJornada } from "@/lib/journey";
import { carregarViagemStore, definirViagemAtivaRepository } from "@/lib/travelRepository";
import { ViagemItem, ViagemStore } from "@/types/travel";

type Filter = "Todos" | "Sonhos" | "Planejamento" | "Concluídos";
const FAVORITES_KEY = "viagem-destinos-favoritos";

export default function Destinos() {
  const [store, setStore] = useState<ViagemStore | null>(null);
  const [filter, setFilter] = useState<Filter>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("filtro") === "concluidos" ? "Concluídos" : "Todos");
  const [favorites, setFavorites] = useState<string[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as string[]; } catch { return []; } });
  const [changing, setChanging] = useState<string | null>(null);

  useEffect(() => {
    void carregarViagemStore().then(setStore);
  }, []);
  const trips = useMemo(() => {
    if (!store) return [];
    return store.viagens.filter((trip) => {
      const status = estadoDestino(trip, store, progressoJornada(trip));
      if (filter === "Sonhos") return status === "Sonho" || status === "Em avaliação";
      if (filter === "Planejamento") return status === "Planejamento" || status === "Jornada Atual";
      if (filter === "Concluídos") return status === "Concluída";
      return true;
    });
  }, [store, filter]);
  if (!store) return <AppLoading label="Carregando destinos" />;

  function favorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next); localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }
  async function makeCurrent(trip: ViagemItem) {
    const current = store!.viagens.find((item) => item.id === store!.viagemAtivaId);
    if (current && current.id !== trip.id && !window.confirm(`Você já está acompanhando ${current.dados.destino} como sua Jornada Atual. Deseja trocar para ${trip.dados.destino}?`)) return;
    setChanging(trip.id); try { setStore(await definirViagemAtivaRepository(trip.id)); } finally { setChanging(null); }
  }

  return <main className="min-h-dvh bg-[linear-gradient(160deg,#061b31,#020617_60%,#05192b)] px-4 pb-32 pt-[calc(env(safe-area-inset-top)+5rem)] text-white"><div className="mx-auto max-w-lg">
    <p className="text-xs font-bold tracking-[.2em] text-cyan-300">BIBLIOTECA DE VIAGENS</p><h1 className="mt-2 text-3xl font-black">Seus destinos</h1><p className="mt-2 text-sm leading-relaxed text-white/55">Aqui estão todos os lugares que você quer conhecer. Salve quantos quiser e planeje no seu tempo.</p>
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{(["Todos", "Sonhos", "Planejamento", "Concluídos"] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === item ? "bg-cyan-400 text-slate-950" : "border border-white/10 bg-white/[0.04] text-white/60"}`}>{item}</button>)}</div>
    <div className="mt-6 space-y-4">{trips.map((trip) => { const progress = progressoJornada(trip); const status = estadoDestino(trip, store, progress); const current = trip.id === store.viagemAtivaId; return <article key={trip.id} className={`overflow-hidden rounded-2xl border bg-white/[0.05] ${current ? "border-cyan-300/45 shadow-lg shadow-cyan-950/30" : "border-white/10"}`}>
      <div className="flex h-28 items-end justify-between bg-[radial-gradient(circle_at_80%_20%,rgba(34,211,238,.35),transparent_30%),linear-gradient(135deg,#075985,#0f172a)] p-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${status === "Concluída" ? "bg-emerald-400 text-slate-950" : current ? "bg-cyan-300 text-slate-950" : "bg-slate-950/60 text-white"}`}>{status.toUpperCase()}</span><button type="button" onClick={() => favorite(trip.id)} aria-label={favorites.includes(trip.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"} className="text-2xl">{favorites.includes(trip.id) ? "★" : "☆"}</button></div>
      <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">{trip.dados.destino}</h2><p className="mt-1 text-xs text-white/45">{trip.dados.dataIda || "Datas a definir"}</p></div>{!trip.concluida && <strong className="text-sm text-cyan-200">{progress.percentual}%</strong>}</div>{!trip.concluida && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${progress.percentual}%` }} /></div>}
      {!trip.concluida && !current && <button type="button" onClick={() => void makeCurrent(trip)} disabled={changing === trip.id} className="mt-4 w-full rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50">{changing === trip.id ? "Trocando…" : status === "Sonho" ? "Transformar em jornada" : "Definir como Jornada Atual"}</button>}
      {current && <Link href={progress.proximoPasso.href} className="mt-4 flex w-full justify-center rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black">Continuar Jornada Atual</Link>}
      </div></article>; })}{trips.length === 0 && <p className="rounded-2xl border border-white/10 p-5 text-sm text-white/50">Nenhum destino nesta categoria.</p>}</div>
    <Link href="/diagnostico" className="mt-5 flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-4 text-sm font-black">+ Adicionar destino</Link>
  </div></main>;
}
