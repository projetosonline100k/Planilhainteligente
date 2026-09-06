"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppLoading from "@/components/AppLoading";
import { carregarViagemStore } from "@/lib/travelRepository";
import { ViagemItem, ViagemStore } from "@/types/travel";

type AtividadeRoteiro = {
  id: string;
  data: string;
  horario: string;
  titulo: string;
  categoria: string;
  concluida: boolean;
};

const CHAVE_ROTEIROS = "viagem-roteiros";
const CHAVE_STORE = "viagem-store";
const CATEGORIAS = ["Passeio", "Comida", "Reserva", "Transporte", "Livre"];

function dataLocal(dataIso: string): Date {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function formatarData(dataIso: string): string {
  if (!dataIso) return "";
  return dataLocal(dataIso).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function listarDias(dataIda: string, dataVolta: string): string[] {
  if (!dataIda) return [];

  const inicio = dataLocal(dataIda);
  const fim = dataVolta ? dataLocal(dataVolta) : inicio;
  const totalDias = Math.max(
    1,
    Math.min(21, Math.floor((fim.getTime() - inicio.getTime()) / 86400000) + 1)
  );

  return Array.from({ length: totalDias }, (_, index) => {
    const data = new Date(inicio);
    data.setDate(inicio.getDate() + index);
    return [
      data.getFullYear(),
      String(data.getMonth() + 1).padStart(2, "0"),
      String(data.getDate()).padStart(2, "0"),
    ].join("-");
  });
}

function carregarRoteiro(viagemId: string): AtividadeRoteiro[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(CHAVE_ROTEIROS);
    const roteiros = raw ? (JSON.parse(raw) as Record<string, AtividadeRoteiro[]>) : {};
    return roteiros[viagemId] ?? [];
  } catch {
    return [];
  }
}

function salvarRoteiro(viagemId: string, atividades: AtividadeRoteiro[]): void {
  if (typeof window === "undefined") return;

  try {
    const raw = localStorage.getItem(CHAVE_ROTEIROS);
    const roteiros = raw ? (JSON.parse(raw) as Record<string, AtividadeRoteiro[]>) : {};
    localStorage.setItem(CHAVE_ROTEIROS, JSON.stringify({ ...roteiros, [viagemId]: atividades }));
  } catch {}
}

function carregarViagemAtivaLocal(): ViagemItem | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CHAVE_STORE);
    if (!raw) return null;
    const store = JSON.parse(raw) as ViagemStore;
    return store.viagens.find((item) => item.id === store.viagemAtivaId) ?? null;
  } catch {
    return null;
  }
}

function NavRoteiro() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-none border-t border-white/10 bg-[#020617]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] backdrop-blur sm:max-w-sm">
      <div className="grid grid-cols-5 items-end gap-1 text-[11px] font-semibold">
        <Link
          href="/passagens"
          prefetch
          className="flex min-w-0 flex-col items-center gap-1 text-white/45"
        >
          <span className="text-2xl leading-none">✈️</span>
          <span className="max-w-full truncate">Passagens</span>
        </Link>
        <Link href="/cabine" prefetch className="flex min-w-0 flex-col items-center gap-1 text-white/45">
          <span className="text-2xl leading-none">▶</span>
          <span className="max-w-full truncate">Cabine</span>
        </Link>
        <Link
          href="/minha-viagem"
          prefetch
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-medium text-black shadow-lg"
          aria-label="Início"
        >
          +
        </Link>
        <Link href="/roteiro" prefetch className="flex min-w-0 flex-col items-center gap-1 text-cyan-300">
          <span className="text-2xl leading-none">🧭</span>
          <span className="max-w-full truncate">Roteiro</span>
        </Link>
        <Link
          href="/minha-viagem"
          prefetch
          className="flex min-w-0 flex-col items-center gap-1 text-white/45"
        >
          <span className="text-2xl leading-none">🗺️</span>
          <span className="max-w-full truncate">Destinos</span>
        </Link>
      </div>
    </nav>
  );
}

export default function Roteiro() {
  const [viagem, setViagem] = useState<ViagemItem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atividades, setAtividades] = useState<AtividadeRoteiro[]>([]);
  const [diaSelecionado, setDiaSelecionado] = useState("");
  const [titulo, setTitulo] = useState("");
  const [horario, setHorario] = useState("09:00");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const local = carregarViagemAtivaLocal();
        if (local && !cancelado) {
          const dias = listarDias(local.dados.dataIda, local.dados.dataVolta);
          setViagem(local);
          setDiaSelecionado(dias[0] ?? "");
          setAtividades(carregarRoteiro(local.id));
          setCarregando(false);
        }

        const store = await carregarViagemStore();
        const ativa = store.viagens.find((item) => item.id === store.viagemAtivaId) ?? null;
        if (cancelado) return;

        setViagem(ativa);
        if (ativa) {
          const dias = listarDias(ativa.dados.dataIda, ativa.dados.dataVolta);
          setDiaSelecionado(dias[0] ?? "");
          setAtividades(carregarRoteiro(ativa.id));
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, []);

  const dias = useMemo(
    () => listarDias(viagem?.dados.dataIda ?? "", viagem?.dados.dataVolta ?? ""),
    [viagem]
  );

  const atividadesDoDia = atividades
    .filter((atividade) => atividade.data === diaSelecionado)
    .sort((a, b) => a.horario.localeCompare(b.horario));

  function atualizarAtividades(proximas: AtividadeRoteiro[]) {
    if (!viagem) return;
    setAtividades(proximas);
    salvarRoteiro(viagem.id, proximas);
  }

  function handleAdicionar() {
    setErro("");
    const tituloLimpo = titulo.trim();

    if (!viagem || !diaSelecionado || !tituloLimpo) {
      setErro("Informe o que voce quer colocar no roteiro.");
      return;
    }

    atualizarAtividades([
      ...atividades,
      {
        id: gerarId(),
        data: diaSelecionado,
        horario,
        titulo: tituloLimpo,
        categoria,
        concluida: false,
      },
    ]);
    setTitulo("");
  }

  function handleAlternar(id: string) {
    atualizarAtividades(
      atividades.map((atividade) =>
        atividade.id === id ? { ...atividade, concluida: !atividade.concluida } : atividade
      )
    );
  }

  if (carregando) {
    return <AppLoading label="Montando seu roteiro" />;
  }

  if (!viagem) {
    return (
      <div className="flex min-h-dvh flex-col bg-[#020617] text-white">
        <div className="flex-1 px-5 py-14 text-center">
          <h1 className="text-2xl font-bold text-white">Roteiro</h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/60">
            Cadastre uma viagem primeiro para montar seu roteiro por dia.
          </p>
          <Link
            href="/diagnostico"
            className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
          >
            Criar viagem
          </Link>
        </div>
        <NavRoteiro />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh animate-[appFadeIn_220ms_ease-out] flex-col bg-[radial-gradient(circle_at_78%_0%,rgba(14,165,233,0.34),transparent_34%),linear-gradient(180deg,#020617_0%,#020617_42%,#07111f_100%)]">
      <div className="flex-1 px-4 pb-32 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
              Roteiro
            </p>
            <h1 className="mt-2 truncate text-3xl font-black text-white">
              {viagem.dados.destino}
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {formatarData(viagem.dados.dataIda)}
              {viagem.dados.dataVolta ? ` a ${formatarData(viagem.dados.dataVolta)}` : ""}
            </p>
          </div>
          <Link
            href="/minha-viagem"
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Voltar
          </Link>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {dias.map((dia, index) => (
            <button
              key={dia}
              type="button"
              onClick={() => setDiaSelecionado(dia)}
              className={`w-24 shrink-0 rounded-2xl px-3 py-3 text-left transition-colors ${
                diaSelecionado === dia
                  ? "bg-cyan-300 text-slate-950"
                  : "bg-white/10 text-white/65 shadow-sm"
              }`}
            >
              <span className="block text-xs font-semibold uppercase opacity-70">Dia {index + 1}</span>
              <span className="mt-1 block text-sm font-bold">{formatarData(dia)}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-sm backdrop-blur">
          <p className="text-sm font-semibold text-white">Adicionar ao roteiro</p>
          <div className="mt-3 grid grid-cols-[1fr_6.5rem] gap-2">
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex: Almoço, museu, check-in..."
              className="min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            />
            <input
              type="time"
              value={horario}
              onChange={(event) => setHorario(event.target.value)}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIAS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategoria(item)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${
                  categoria === item ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white/55"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {erro && <p className="mt-3 text-xs text-red-600">{erro}</p>}
          <button
            type="button"
            onClick={handleAdicionar}
            className="mt-4 w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-600"
          >
            Adicionar atividade
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Agenda do dia</h2>
            <span className="text-xs font-semibold text-white/45">
              {atividadesDoDia.length} {atividadesDoDia.length === 1 ? "item" : "itens"}
            </span>
          </div>

          {atividadesDoDia.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.06] px-4 py-8 text-center">
              <p className="text-sm font-semibold text-white">Nada planejado ainda</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">
                Adicione reservas, passeios e horários importantes para esse dia.
              </p>
            </div>
          ) : (
            atividadesDoDia.map((atividade) => (
              <button
                key={atividade.id}
                type="button"
                onClick={() => handleAlternar(atividade.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-left shadow-sm"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm ${
                    atividade.concluida
                      ? "border-green-400 bg-green-500 text-white"
                      : "border-white/20 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-bold ${
                      atividade.concluida ? "text-white/35 line-through" : "text-white"
                    }`}
                  >
                    {atividade.titulo}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {atividade.horario} · {atividade.categoria}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <NavRoteiro />
    </div>
  );
}
