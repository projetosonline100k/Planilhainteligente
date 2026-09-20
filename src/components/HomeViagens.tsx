"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppLoading from "@/components/AppLoading";
import { hojeIso, progressoJornada } from "@/lib/journey";
import { carregarViagemStore, concluirViagemRepository, definirViagemAtivaRepository } from "@/lib/travelRepository";
import { supabase } from "@/lib/supabase";
import { ViagemItem, ViagemStore } from "@/types/travel";

const META_KEY = "viagem-meta-anual";
const ETAPAS = ["Sonho", "Passagens", "Roteiro", "Preparação", "Viagem"];
type Alerta = { ativo: boolean; destination: string; outbound_date: string };
const localDate = (value: string) => { const [y, m, d] = value.split("-").map(Number); return new Date(y, m - 1, d); };
const shortDate = (value: string) => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(localDate(value)) : "Data a definir";
const hasAlert = (trip: ViagemItem, alerts: Alerta[]) => alerts.some((alert) => alert.ativo && alert.outbound_date >= hojeIso() && (alert.destination === trip.dados.destino.toUpperCase() || trip.dados.destino.toUpperCase().includes(alert.destination)));

export default function HomeViagens() {
  const [store, setStore] = useState<ViagemStore | null>(null);
  const [name, setName] = useState("Viajante");
  const [goal, setGoal] = useState(4);
  const [editingGoal, setEditingGoal] = useState(false);
  const [alerts, setAlerts] = useState<Alerta[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    void Promise.all([carregarViagemStore(), supabase.auth.getSession()]).then(([trips, session]) => {
      setStore(trips);
      const user = session.data.session?.user; const metadata = user?.user_metadata || {};
      setName(metadata.full_name?.split(" ")[0] || metadata.name?.split(" ")[0] || "Viajante");
      const savedGoal = Number(localStorage.getItem(META_KEY)); if (savedGoal > 0) setGoal(savedGoal);
      const token = session.data.session?.access_token;
      if (token) void fetch("/api/alertas", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : null).then((body) => setAlerts(body?.alertas || []));
    });
  }, []);

  const data = useMemo(() => {
    if (!store) return null;
    const completed = store.viagens.filter((trip) => trip.concluida);
    const completedThisYear = completed.filter((trip) => new Date(trip.dataConclusao || trip.dados.dataVolta).getFullYear() === now.getFullYear());
    const current = store.viagens.find((trip) => trip.id === store.viagemAtivaId && !trip.concluida) ?? null;
    const expired = current?.dados.dataVolta && current.dados.dataVolta < hojeIso() ? current : null;
    const dreams = store.viagens.filter((trip) => !trip.concluida && trip.id !== current?.id).slice(0, 4);
    const progress = new Map(store.viagens.map((trip) => [trip.id, progressoJornada(trip, hasAlert(trip, alerts))]));
    const recommended = [...dreams].sort((a, b) => (progress.get(b.id)?.score || 0) - (progress.get(a.id)?.score || 0))[0] ?? null;
    const economy = store.viagens.flatMap((trip) => trip.movimentacoes).reduce((total, item) => total + (item.tipo === "entrada" ? item.valor : -item.valor), 0);
    return { completed, completedThisYear, current, expired, dreams, progress, recommended, economy };
  }, [store, alerts, now]);

  if (!store || !data) return <AppLoading label="Montando sua Home" />;
  const progress = data.current ? data.progress.get(data.current.id)! : null;
  const traveling = progress?.etapa === "Viagem";
  const yearlyProgress = Math.min(100, Math.round(data.completedThisYear.length / goal * 100));
  const days = data.current?.dados.dataIda ? Math.max(0, Math.ceil((localDate(data.current.dados.dataIda).getTime() - now.getTime()) / 86400000)) : null;
  const tripDay = traveling && data.current ? Math.max(1, Math.floor((now.getTime() - localDate(data.current.dados.dataIda).getTime()) / 86400000) + 1) : 0;
  const duration = data.current?.dados.dataVolta ? Math.max(1, Math.floor((localDate(data.current.dados.dataVolta).getTime() - localDate(data.current.dados.dataIda).getTime()) / 86400000) + 1) : 1;
  async function finish() { const expired = data?.expired; if (!expired) return; setFinishing(true); try { setStore(await concluirViagemRepository(expired.id)); } finally { setFinishing(false); } }
  async function choose(trip: ViagemItem) { setStore(await definirViagemAtivaRepository(trip.id)); }

  return <main className="min-h-dvh overflow-x-hidden bg-[radial-gradient(circle_at_80%_0%,rgba(14,165,233,.28),transparent_28%),linear-gradient(180deg,#041d33,#020617_55%,#061524)] px-4 pb-32 pt-[calc(env(safe-area-inset-top)+5rem)] text-white"><div className="mx-auto max-w-lg">
    <header className="pl-12"><h1 className="text-2xl font-black">Olá, {name}! 👋</h1><p className="mt-1 text-sm text-white/55">Onde você está, quanto avançou e qual é o próximo passo.</p></header>

    {data.expired ? <section className="mt-6 rounded-3xl border border-emerald-300/30 bg-[linear-gradient(145deg,rgba(5,88,88,.7),rgba(3,18,35,.96))] p-5 shadow-2xl"><p className="eyebrow text-emerald-300">JORNADA ENCERRADA</p><h2 className="mt-3 text-2xl font-black">Sua viagem para {data.expired.dados.destino} terminou.</h2><p className="mt-2 text-sm text-white/60">Vamos concluir essa jornada e guardar a conquista no seu passaporte?</p><button type="button" onClick={() => void finish()} disabled={finishing} className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-4 text-sm font-black disabled:opacity-60">{finishing ? "Concluindo…" : "Concluir viagem ✨"}</button></section>
    : data.current && progress ? <section className="mt-6 overflow-hidden rounded-3xl border border-cyan-300/25 bg-[radial-gradient(circle_at_90%_5%,rgba(34,211,238,.25),transparent_30%),linear-gradient(145deg,rgba(6,52,82,.98),rgba(3,18,35,.96))] p-5 shadow-2xl shadow-cyan-950/30"><p className="eyebrow text-cyan-300">{traveling ? `VOCÊ ESTÁ EM ${data.current.dados.destino.toUpperCase()} ✈` : "JORNADA ATUAL"}</p><h2 className="mt-3 text-3xl font-black">{data.current.dados.destino}</h2><p className="mt-1 text-sm text-white/60">{traveling ? `Dia ${tripDay} de ${duration}` : `${shortDate(data.current.dados.dataIda)}${data.current.dados.dataVolta ? ` a ${shortDate(data.current.dados.dataVolta)}` : ""}`}</p><div className="mt-5 flex items-end justify-between"><p className="text-sm font-bold">Etapa {progress.indiceEtapa} de 5 · {progress.etapa}</p><strong className="text-cyan-200">{progress.percentual}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${progress.percentual}%` }} /></div><div className="mt-4 grid grid-cols-5 gap-1">{ETAPAS.map((stage, index) => <div key={stage} className="text-center"><span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${index + 1 < progress.indiceEtapa ? "bg-emerald-400 text-slate-950" : index + 1 === progress.indiceEtapa ? "bg-cyan-300 text-slate-950 ring-4 ring-cyan-300/15" : "border border-white/20 text-white/35"}`}>{index + 1 < progress.indiceEtapa ? "✓" : index + 1 === progress.indiceEtapa ? "●" : "○"}</span><span className="mt-2 block truncate text-[8px] text-white/45">{stage}</span></div>)}</div><p className="mt-5 text-sm font-bold text-emerald-300">{traveling ? "Seu dia de hoje está pronto para você" : days === null ? "Defina as datas para acompanhar a contagem" : `Faltam ${days} ${days === 1 ? "dia" : "dias"} para embarcar`}</p><Link href={progress.proximoPasso.href} className="mt-4 flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-4 text-sm font-black">{traveling ? "Ver meu dia de hoje" : "Continuar jornada"} →</Link></section>
    : store.viagens.length === 0 ? <EmptyState />
    : <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-white/[0.05] p-5"><p className="eyebrow text-cyan-300">ESCOLHA SUA PRÓXIMA JORNADA</p><h2 className="mt-2 text-2xl font-black">Sua próxima jornada começa aqui</h2>{data.recommended && <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4"><span className="text-[10px] font-black text-amber-200">⭐ RECOMENDADO</span><h3 className="mt-2 text-xl font-black">{data.recommended.dados.destino}</h3><p className="mt-1 text-xs text-white/55">Parece ser sua viagem mais avançada{data.progress.get(data.recommended.id)?.motivos.length ? `: ${data.progress.get(data.recommended.id)?.motivos.join(", ")}.` : "."}</p><button type="button" onClick={() => void choose(data.recommended!)} className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950">Transformar em Jornada Atual</button></div>}<Link href="/destinos" className="mt-4 flex justify-center text-sm font-bold text-cyan-200">Escolher outro destino →</Link></section>}

    {progress && !data.expired && <Card title="PRÓXIMO PASSO"><p className="text-xs text-white/50">Uma ação de cada vez para avançar sua jornada.</p><Link href={progress.proximoPasso.href} className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4 font-bold"><span>▣ &nbsp;{progress.proximoPasso.titulo}</span><span>›</span></Link></Card>}
    <Card title="SEU ANO EM VIAGENS"><div className="flex justify-end"><button type="button" onClick={() => setEditingGoal((value) => !value)} className="-mt-5 text-xs font-bold text-white/50">Editar meta</button></div><div className="mt-3 flex items-end justify-between"><p className="text-2xl font-black">{data.completedThisYear.length} de {goal} viagens</p><strong>{yearlyProgress}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${yearlyProgress}%` }} /></div>{editingGoal && <div className="mt-4 flex gap-2"><input type="number" min="1" max="30" value={goal} onChange={(event) => setGoal(Math.max(1, Number(event.target.value)))} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 outline-none"/><button type="button" onClick={() => { localStorage.setItem(META_KEY, String(goal)); setEditingGoal(false); }} className="rounded-lg bg-cyan-400 px-4 text-sm font-black text-slate-950">Salvar</button></div>}</Card>
    {data.dreams.length > 0 && <section className="mt-4"><div className="flex items-center justify-between"><p className="eyebrow text-cyan-300">SEUS PRÓXIMOS SONHOS</p><Link href="/destinos" className="text-xs font-bold text-white/50">Ver todos →</Link></div><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{data.dreams.map((trip) => <article key={trip.id} className="min-w-40 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#075985,#0f172a)] p-4"><span className="text-3xl">✈️</span><h3 className="mt-6 truncate font-black">{trip.dados.destino}</h3><p className="mt-1 text-[10px] text-white/55">{data.progress.get(trip.id)?.etapa}</p></article>)}</div></section>}
    <Card title="SEU PASSAPORTE"><div className="flex justify-end"><Link href="/destinos?filtro=concluidos" className="-mt-5 text-xs font-bold text-cyan-200">Ver meu passaporte →</Link></div><div className="mt-4 flex gap-3 overflow-x-auto pb-1">{data.completed.slice(0, 4).map((trip) => <div key={trip.id} className="min-w-32 rotate-[-1deg] rounded-sm border-4 border-dotted border-slate-200 bg-slate-50 p-2 text-center text-slate-900"><div className="flex h-20 items-center justify-center rounded bg-gradient-to-br from-cyan-400 to-blue-800 text-3xl">✈️</div><strong className="mt-2 block truncate text-sm">{trip.dados.destino}</strong></div>)}{data.completed.length === 0 && <p className="py-4 text-sm text-white/40">As jornadas concluídas aparecerão aqui.</p>}</div></Card>
    <section className="mt-4 grid grid-cols-3 gap-2">{[["✈", "Viagens", store.viagens.length], ["🔔", "Alertas", alerts.filter((item) => item.ativo && item.outbound_date >= hojeIso()).length], ["◉", "Economia", new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.max(0, data.economy))]].map(([icon, label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"><span className="text-xl text-cyan-300">{icon}</span><p className="mt-1 text-[10px] text-white/45">{label}</p><strong className="text-sm">{value}</strong></div>)}</section>
  </div></main>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="eyebrow text-cyan-300">{title}</p>{children}</section>; }
function EmptyState() { return <section className="mt-6 rounded-3xl border border-dashed border-cyan-300/25 bg-white/[0.04] p-7 text-center"><span className="text-5xl">🌍</span><h2 className="mt-4 text-2xl font-black">Para onde você quer ir primeiro?</h2><p className="mt-2 text-sm text-white/55">Sua próxima jornada começa com um destino.</p><Link href="/diagnostico" className="mt-5 inline-flex rounded-xl bg-emerald-500 px-5 py-4 text-sm font-black">Adicionar destino</Link></section>; }
