"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Movimentacao,
  CategoriaMovimentacao,
  TipoMovimentacao,
  ViagemItem,
  ViagemStore,
} from "@/types/travel";
import { calcularPlanoViagem } from "@/lib/calculations";
import {
  adicionarMovimentacaoRepository,
  apagarViagemRepository,
  carregarViagemStore,
  definirViagemAtivaRepository,
} from "@/lib/travelRepository";
import { supabase } from "@/lib/supabase";

const STORE_VAZIO: ViagemStore = { viagens: [], viagemAtivaId: null };
const CHAVE_AVATAR = "viagem-user-avatar";
const CHAVE_CHECKLIST = "viagem-checklists";

type StatusMensal = "em_andamento" | "meta_batida" | "concluido" | "superou" | "abaixo";

type ChecklistItem = {
  id: string;
  titulo: string;
  concluido: boolean;
};

type ChecklistSubitem = {
  id: string;
  titulo: string;
  concluido: boolean;
};

type ChecklistPessoal = {
  id: string;
  titulo: string;
  subitens: ChecklistSubitem[];
};

type ChecklistEstado = {
  recomendados: ChecklistItem[];
  pessoais: ChecklistPessoal[];
};

type MesEconomia = {
  chave: string;
  nome: string;
  guardado: number;
  meta: number;
  percentual: number;
  status: StatusMensal;
  atual: boolean;
};

const CHECKLIST_PADRAO: ChecklistItem[] = [
  { id: "documentos", titulo: "Documentos separados", concluido: false },
  { id: "hospedagem", titulo: "Hospedagem confirmada", concluido: false },
  { id: "passagens", titulo: "Passagens salvas", concluido: false },
];

function criarChecklistPadrao(): ChecklistItem[] {
  return CHECKLIST_PADRAO.map((item) => ({ ...item }));
}

function normalizarChecklistRecomendado(tarefas?: ChecklistItem[]): ChecklistItem[] {
  return CHECKLIST_PADRAO.map((item) => {
    const tarefaSalva = tarefas?.find((tarefa) => tarefa.id === item.id);
    return { ...item, concluido: tarefaSalva?.concluido ?? false };
  });
}

function criarEstadoChecklist(): ChecklistEstado {
  return {
    recomendados: criarChecklistPadrao(),
    pessoais: [],
  };
}

// ─── Cálculo de capital reservado por categoria ───────────────────────────────

function calcularReservado(movs: Movimentacao[], categoria: CategoriaMovimentacao): number {
  const total = movs
    .filter((m) => m.categoria === categoria)
    .reduce((acc, m) => (m.tipo === "entrada" ? acc + m.valor : acc - m.valor), 0);
  return Math.max(0, total);
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

function moeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  if (!iso) return "";
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function formatarDataCompleta(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function chaveMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMes(chave: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  const data = new Date(ano, mes - 1, 1);
  const nome = data.toLocaleDateString("pt-BR", { month: "long" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function calcularGuardadoNoMes(movs: Movimentacao[], chave: string): number {
  const total = movs
    .filter((mov) => chaveMes(new Date(mov.dataCriacao)) === chave)
    .reduce((acc, mov) => (mov.tipo === "entrada" ? acc + mov.valor : acc - mov.valor), 0);

  return Math.max(0, total);
}

function statusMensal({
  atual,
  guardado,
  meta,
}: {
  atual: boolean;
  guardado: number;
  meta: number;
}): StatusMensal {
  if (atual && guardado >= meta) return "meta_batida";
  if (atual) return "em_andamento";
  if (guardado > meta) return "superou";
  if (guardado >= meta) return "concluido";
  return "abaixo";
}

function carregarChecklists(): Record<string, ChecklistEstado> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(CHAVE_CHECKLIST);
    const parsed = raw ? JSON.parse(raw) : {};
    const entradas = Object.entries(parsed as Record<string, ChecklistItem[] | ChecklistEstado>);

    return entradas.reduce<Record<string, ChecklistEstado>>((acc, [tripId, valor]) => {
      if (Array.isArray(valor)) {
        acc[tripId] = { recomendados: normalizarChecklistRecomendado(valor), pessoais: [] };
        return acc;
      }

      acc[tripId] = {
        recomendados: normalizarChecklistRecomendado(valor.recomendados),
        pessoais: valor.pessoais ?? [],
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function salvarChecklists(checklists: Record<string, ChecklistEstado>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE_CHECKLIST, JSON.stringify(checklists));
}

function obterChecklistEstado(
  checklists: Record<string, ChecklistEstado>,
  tripId: string
): ChecklistEstado {
  return checklists[tripId] ?? criarEstadoChecklist();
}

function calcularHistoricoMensal(movs: Movimentacao[], meta: number): MesEconomia[] {
  const agora = new Date();
  const chaveAtual = chaveMes(agora);
  const chaves = new Set<string>([chaveAtual]);

  movs.forEach((mov) => {
    chaves.add(chaveMes(new Date(mov.dataCriacao)));
  });

  return Array.from(chaves)
    .sort((a, b) => b.localeCompare(a))
    .map((chave) => {
      const guardado = calcularGuardadoNoMes(movs, chave);
      const percentual = meta > 0 ? Math.round((guardado / meta) * 100) : 0;
      const atual = chave === chaveAtual;

      return {
        chave,
        nome: nomeMes(chave),
        guardado,
        meta,
        percentual,
        status: statusMensal({ atual, guardado, meta }),
        atual,
      };
    });
}

// ─── Anel de progresso (SVG puro) ─────────────────────────────────────────────

function AnelProgresso({ percentual, consegue }: { percentual: number; consegue: boolean }) {
  const r = 45;
  const circ = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percentual));
  const offset = circ * (1 - p / 100);
  const cor = consegue ? "#22c55e" : "#f59e0b";

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={r}
          fill="none" stroke={cor} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{Math.round(p)}%</span>
        <span className="text-xs text-gray-400 text-center leading-tight px-1">
          reservado
        </span>
      </div>
    </div>
  );
}

// ─── Item de legenda ──────────────────────────────────────────────────────────

function LegendaItem({ cor, label, valor }: { cor: string; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cor}`} />
      <div className="min-w-0">
        <p className="text-sm text-gray-500 leading-tight">{label}</p>
        <p className="text-base font-semibold text-gray-900 leading-tight">{valor}</p>
      </div>
    </div>
  );
}

// ─── Mini card de categoria ───────────────────────────────────────────────────

function CardCategoria({
  emoji, nome, meta, reservado, cor,
}: {
  emoji: string;
  nome: string;
  meta: number;
  reservado: number;
  cor: string;
}) {
  const percentual = meta > 0 ? Math.min(100, (reservado / meta) * 100) : 0;

  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-white p-3.5 flex flex-col gap-2">
      <span className="text-3xl leading-none">{emoji}</span>
      <div>
        <p className="truncate text-base text-gray-500">{nome}</p>
        <p className="text-xs text-gray-400 mt-0.5">Meta: {moeda(meta)}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{moeda(reservado)}</p>
        <p className="text-base text-gray-400 leading-tight">{Math.round(percentual)}%</p>
      </div>
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${cor} rounded-full`} style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}

function etiquetaStatus(status: StatusMensal): {
  label: string;
  classe: string;
} {
  if (status === "meta_batida") {
    return { label: "Meta batida", classe: "bg-green-50 text-green-600" };
  }

  if (status === "em_andamento") {
    return { label: "Em andamento", classe: "bg-gray-100 text-gray-600" };
  }

  if (status === "abaixo") {
    return { label: "Abaixo da meta", classe: "bg-orange-50 text-orange-600" };
  }

  if (status === "superou") {
    return { label: "Superou", classe: "bg-green-50 text-green-600" };
  }

  return { label: "Concluído", classe: "bg-green-50 text-green-600" };
}

function BarraProgressoMensal({ percentual }: { percentual: number }) {
  const progresso = Math.min(100, Math.max(0, percentual));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-green-500 transition-all"
        style={{ width: `${progresso}%` }}
      />
    </div>
  );
}

function CardMetaMes({
  metaMensal,
  guardadoMes,
  onAbrirHistorico,
}: {
  metaMensal: number;
  guardadoMes: number;
  onAbrirHistorico: () => void;
}) {
  if (metaMensal <= 0) {
    return (
      <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-gray-400">Meta do mês</p>
        <p className="mt-3 text-base leading-relaxed text-gray-500">
          Defina quanto você quer guardar por mês para acompanhar seu progresso.
        </p>
        <Link
          href="/diagnostico?editar=1"
          className="mt-4 inline-flex rounded-full bg-gray-100 px-4 py-2 text-base font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          Definir meta mensal
        </Link>
      </div>
    );
  }

  const faltam = Math.max(0, metaMensal - guardadoMes);
  const percentual = Math.round((guardadoMes / metaMensal) * 100);
  const percentualLimitado = Math.min(100, Math.max(0, percentual));
  const bateuMeta = guardadoMes >= metaMensal;

  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm ${
        bateuMeta ? "border-green-200 shadow-green-100/80" : "border-gray-100"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-widest text-gray-400">Meta do mês</p>
          {bateuMeta && (
            <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
              Meta batida
            </span>
          )}
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-3 gap-2">
          <div>
            <p className="text-sm text-gray-500 leading-tight">Meta mensal</p>
            <p className="mt-1 text-base font-bold text-gray-900">{moeda(metaMensal)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 leading-tight">Guardado no mês</p>
            <p className="mt-1 text-base font-bold text-green-600">{moeda(guardadoMes)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 leading-tight">Faltam</p>
            <p className={`mt-1 text-base font-bold ${bateuMeta ? "text-green-600" : "text-gray-900"}`}>
              {bateuMeta ? "✓ Meta!" : moeda(faltam)}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <BarraProgressoMensal percentual={percentualLimitado} />
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {moeda(guardadoMes)} de {moeda(metaMensal)}
            </span>
            <span>{percentual}%</span>
          </div>
          {bateuMeta && (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              Parabéns, você bateu a meta deste mês.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onAbrirHistorico}
        className="flex w-full items-center justify-between border-t border-gray-100 px-4 py-4 text-left text-base text-gray-500 transition-colors hover:bg-gray-50"
      >
        <span className="flex items-center gap-3">
          <span>Ver meses anteriores</span>
        </span>
        <span className="text-2xl leading-none text-gray-400">›</span>
      </button>
    </div>
  );
}

function ItemHistoricoMensal({ mes }: { mes: MesEconomia }) {
  const status = etiquetaStatus(mes.status);
  const destaque = mes.status === "meta_batida" || mes.status === "concluido" || mes.status === "superou";

  return (
    <button
      type="button"
      className={`w-full rounded-xl border bg-white p-4 text-left transition-colors hover:bg-gray-50 ${
        destaque ? "border-green-100" : "border-gray-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-gray-900">{mes.nome}</p>
          <p className="mt-1 text-sm text-gray-500">
            {moeda(mes.guardado)} de {moeda(mes.meta)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.classe}`}>
            {status.label}
          </span>
          <span className="text-3xl leading-none text-gray-400">›</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <BarraProgressoMensal percentual={mes.percentual} />
        </div>
        <span className="w-11 shrink-0 text-right text-sm text-gray-500">{mes.percentual}%</span>
      </div>
    </button>
  );
}

function resumoChecklist(tarefas: ChecklistItem[]): { concluidas: number; total: number; percentual: number } {
  const total = tarefas.length;
  const concluidas = tarefas.filter((tarefa) => tarefa.concluido).length;
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return { concluidas, total, percentual };
}

function resumoSubitens(checklists: ChecklistPessoal[]): {
  concluidas: number;
  total: number;
  percentual: number;
} {
  const subitens = checklists.flatMap((checklist) => checklist.subitens);
  const total = subitens.length;
  const concluidas = subitens.filter((subitem) => subitem.concluido).length;
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return { concluidas, total, percentual };
}

function resumoChecklistGeral(estado: ChecklistEstado): {
  concluidas: number;
  total: number;
  percentual: number;
} {
  const recomendados = resumoChecklist(estado.recomendados);
  const pessoais = resumoSubitens(estado.pessoais);
  const total = recomendados.total + pessoais.total;
  const concluidas = recomendados.concluidas + pessoais.concluidas;
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return { concluidas, total, percentual };
}

function CardChecklist({
  estado,
  onAbrir,
}: {
  estado: ChecklistEstado;
  onAbrir: () => void;
}) {
  const resumo = resumoChecklistGeral(estado);

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-green-500 text-2xl text-green-600">
        ✓
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-gray-900">Checklist</p>
        <p className="text-sm text-gray-500">
          {resumo.total > 0
            ? `2 áreas • ${resumo.concluidas} de ${resumo.total} itens`
            : "2 áreas • nenhum item pessoal"}
        </p>
      </div>
      <span className="shrink-0 text-3xl leading-none text-gray-400">›</span>
    </button>
  );
}

function ModalChecklist({
  estado,
  onFechar,
  onAlternarRecomendado,
  onCriarChecklist,
  onAdicionarSubitem,
  onAlternarSubitem,
}: {
  estado: ChecklistEstado;
  onFechar: () => void;
  onAlternarRecomendado: (id: string) => void;
  onCriarChecklist: (titulo: string) => void;
  onAdicionarSubitem: (checklistId: string, titulo: string) => void;
  onAlternarSubitem: (checklistId: string, subitemId: string) => void;
}) {
  const [recomendadoAberto, setRecomendadoAberto] = useState(false);
  const [checklistAbertoId, setChecklistAbertoId] = useState<string | null>(null);
  const [criandoChecklist, setCriandoChecklist] = useState(false);
  const [novoChecklist, setNovoChecklist] = useState("");
  const [novoSubitem, setNovoSubitem] = useState<Record<string, string>>({});
  const resumoGeral = resumoChecklistGeral(estado);
  const resumoRecomendado = resumoChecklist(estado.recomendados);
  const resumoPessoal = resumoSubitens(estado.pessoais);

  function handleCriarChecklist() {
    if (!criandoChecklist) {
      setCriandoChecklist(true);
      return;
    }

    const titulo = novoChecklist.trim();
    if (!titulo) return;

    onCriarChecklist(titulo);
    setNovoChecklist("");
    setCriandoChecklist(false);
  }

  function handleAdicionarSubitem(checklistId: string) {
    const titulo = (novoSubitem[checklistId] ?? "").trim();
    if (!titulo) return;

    onAdicionarSubitem(checklistId, titulo);
    setNovoSubitem((prev) => ({ ...prev, [checklistId]: "" }));
    setChecklistAbertoId(checklistId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onFechar}>
      <div
        className="max-h-[82dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-xl sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-gray-200" />

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-900">Checklist da viagem</h2>
            <p className="mt-2 text-base leading-relaxed text-gray-500">
              Organize tudo o que falta antes de viajar.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="shrink-0 text-3xl leading-none text-gray-400 hover:text-gray-600"
            aria-label="Fechar checklist"
          >
            ×
          </button>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-base font-bold text-gray-900">
            {resumoGeral.concluidas} de {resumoGeral.total} itens concluídos
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <BarraProgressoMensal percentual={resumoGeral.percentual} />
            </div>
            <span className="w-11 shrink-0 text-right text-sm text-gray-500">
              {resumoGeral.percentual}%
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100 bg-white">
          <button
            type="button"
            onClick={() => setRecomendadoAberto((aberto) => !aberto)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-xl text-green-600">
              ✓
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-gray-900">
                Vaiviajar recomenda
              </span>
              <span className="block text-sm text-gray-500">
                {resumoRecomendado.concluidas} de {resumoRecomendado.total} concluídos
              </span>
            </span>
            <span className="shrink-0 text-2xl leading-none text-gray-400">
              {recomendadoAberto ? "⌃" : "⌄"}
            </span>
          </button>

          {recomendadoAberto && (
            <div className="border-t border-gray-100">
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <BarraProgressoMensal percentual={resumoRecomendado.percentual} />
                  </div>
                  <span className="w-11 shrink-0 text-right text-sm text-gray-500">
                    {resumoRecomendado.percentual}%
                  </span>
                </div>
              </div>

              {estado.recomendados.map((tarefa) => (
                <button
                  key={tarefa.id}
                  type="button"
                  onClick={() => onAlternarRecomendado(tarefa.id)}
                  className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3.5 text-left hover:bg-gray-50"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-base font-bold ${
                      tarefa.concluido
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span
                    className={`min-w-0 flex-1 text-base ${
                      tarefa.concluido ? "text-gray-400 line-through" : "text-gray-900"
                    }`}
                  >
                    {tarefa.titulo}
                  </span>
                  <span className="shrink-0 text-2xl leading-none text-gray-400">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900">Meu Checklist</p>
              <p className="mt-1 text-sm text-gray-500">
                {resumoPessoal.concluidas} de {resumoPessoal.total} itens concluídos
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCriandoChecklist(true)}
              className="shrink-0 text-sm font-semibold text-green-600"
            >
              + Criar checklist
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <BarraProgressoMensal percentual={resumoPessoal.percentual} />
            </div>
            <span className="w-11 shrink-0 text-right text-sm text-gray-500">
              {resumoPessoal.percentual}%
            </span>
          </div>

          {criandoChecklist && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={novoChecklist}
                onChange={(e) => setNovoChecklist(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCriarChecklist();
                }}
                placeholder="Nome do checklist"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20"
                autoFocus
              />
              <button
                type="button"
                onClick={handleCriarChecklist}
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Criar
              </button>
            </div>
          )}

          {estado.pessoais.length === 0 ? (
            <div className="mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center">
              <p className="text-sm text-gray-500">
                Você ainda não criou nenhum checklist pessoal.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Crie uma lista para mala, compras, documentos ou qualquer outra coisa da viagem.
              </p>
              <button
                type="button"
                onClick={() => setCriandoChecklist(true)}
                className="mt-4 rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white"
              >
                + Criar checklist
              </button>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-100 bg-white">
              {estado.pessoais.map((checklist) => {
                const aberto = checklistAbertoId === checklist.id;
                const resumo = resumoSubitens([checklist]);

                return (
                  <div key={checklist.id} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setChecklistAbertoId(aberto ? null : checklist.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-xl text-green-600">
                        ▣
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold text-gray-900">
                          {checklist.titulo}
                        </span>
                        <span className="block text-sm text-gray-500">
                          {resumo.concluidas} de {resumo.total} itens concluídos
                        </span>
                      </span>
                      <span className="shrink-0 text-2xl leading-none text-gray-400">
                        {aberto ? "⌃" : "⌄"}
                      </span>
                    </button>

                    {aberto && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                        {checklist.subitens.length === 0 ? (
                          <p className="py-2 text-sm text-gray-500">
                            Nenhum item adicionado ainda.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {checklist.subitens.map((subitem) => (
                              <button
                                key={subitem.id}
                                type="button"
                                onClick={() => onAlternarSubitem(checklist.id, subitem.id)}
                                className="flex w-full items-center gap-3 text-left"
                              >
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                                    subitem.concluido
                                      ? "border-green-500 bg-green-500 text-white"
                                      : "border-gray-300 bg-white text-transparent"
                                  }`}
                                >
                                  ✓
                                </span>
                                <span
                                  className={`min-w-0 flex-1 text-sm ${
                                    subitem.concluido
                                      ? "text-gray-400 line-through"
                                      : "text-gray-700"
                                  }`}
                                >
                                  {subitem.titulo}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={novoSubitem[checklist.id] ?? ""}
                            onChange={(e) =>
                              setNovoSubitem((prev) => ({
                                ...prev,
                                [checklist.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAdicionarSubitem(checklist.id);
                            }}
                            placeholder="Adicionar item"
                            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20"
                          />
                          <button
                            type="button"
                            onClick={() => handleAdicionarSubitem(checklist.id)}
                            className="rounded-xl bg-green-500 px-3 py-2 text-sm font-semibold text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalHistoricoMensal({
  historico,
  onFechar,
}: {
  historico: MesEconomia[];
  onFechar: () => void;
}) {
  const temMesesAnteriores = historico.some((mes) => !mes.atual);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onFechar}>
      <div
        className="max-h-[80dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white px-6 pb-8 pt-5 shadow-xl sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-gray-200" />

        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-900">Histórico mensal</h2>
            <p className="mt-2 text-base leading-relaxed text-gray-500">
              Acompanhe seu desempenho dos últimos meses.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="shrink-0 text-3xl leading-none text-gray-400 hover:text-gray-600"
            aria-label="Fechar histórico mensal"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {historico.map((mes) => (
            <ItemHistoricoMensal key={mes.chave} mes={mes} />
          ))}

          {!temMesesAnteriores && (
            <p className="rounded-xl bg-gray-50 px-4 py-4 text-center text-sm text-gray-500">
              Você ainda não possui histórico de meses anteriores.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal "Adicionar Capital" ────────────────────────────────────────────────

const CATEGORIAS: { id: CategoriaMovimentacao; label: string; emoji: string }[] = [
  { id: "passagem",    label: "Passagem",    emoji: "✈️" },
  { id: "hospedagem",  label: "Hospedagem",  emoji: "🏨" },
  { id: "alimentacao", label: "Alimentação", emoji: "🍽️" },
  { id: "passeios",    label: "Passeios",    emoji: "📸" },
];

function ModalAdicionarCapital({
  onFechar,
  onSalvar,
  meta,
  reservado,
}: {
  onFechar: () => void;
  onSalvar: (mov: Movimentacao) => Promise<void>;
  meta: Record<CategoriaMovimentacao, number>;
  reservado: Record<CategoriaMovimentacao, number>;
}) {
  const [categoria, setCategoria] = useState<CategoriaMovimentacao>("passagem");
  const [tipo, setTipo] = useState<TipoMovimentacao>("entrada");
  const [valorStr, setValorStr] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const valorValido = parseFloat(valorStr) > 0;

  const metaCat = meta[categoria];
  const reservadoCat = reservado[categoria];
  const faltaCat = Math.max(0, metaCat - reservadoCat);
  const progressoCat = metaCat > 0 ? Math.min(100, (reservadoCat / metaCat) * 100) : 0;
  const atingiuMeta = metaCat > 0 && reservadoCat >= metaCat;

  async function handleSalvar() {
    if (!valorValido || salvando) return;

    setErro("");
    setSalvando(true);

    try {
      await onSalvar({
        id: Date.now().toString(),
        categoria,
        tipo,
        valor: parseFloat(valorStr),
        dataCriacao: new Date().toISOString(),
      });
      onFechar();
    } catch {
      setErro("Nao foi possivel salvar a movimentacao.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white px-6 pt-6 pb-8 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Adicionar capital</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div>
          <p className="text-base text-gray-500 mb-2">Categoria</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoria(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-base font-medium transition-colors ${
                  categoria === cat.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <p className="text-base text-gray-500">
            Você está adicionando capital para{" "}
            <span className="font-semibold text-gray-800">
              {CATEGORIAS.find((c) => c.id === categoria)?.label}
            </span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-sm text-gray-400">Meta</p>
              <p className="text-base font-semibold text-gray-900">{moeda(metaCat)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Reservado</p>
              <p className="text-base font-semibold text-green-600">{moeda(reservadoCat)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Falta</p>
              <p className={`text-base font-semibold ${atingiuMeta ? "text-green-600" : "text-gray-900"}`}>
                {atingiuMeta ? "—" : moeda(faltaCat)}
              </p>
            </div>
          </div>
          <div>
            <div className="flex items-center mb-1">
              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden mr-2">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressoCat}%` }} />
              </div>
              <span className="text-sm text-gray-500 shrink-0">{Math.round(progressoCat)}%</span>
            </div>
            <p className={`text-sm leading-snug ${atingiuMeta ? "text-green-600 font-medium" : "text-gray-500"}`}>
              {atingiuMeta
                ? "✓ Essa categoria já atingiu a meta."
                : `Faltam ${moeda(faltaCat)} para completar essa categoria.`}
            </p>
          </div>
        </div>

        <div>
          <p className="text-base text-gray-500 mb-2">Tipo</p>
          <div className="flex gap-2">
            {(["entrada", "saida"] as TipoMovimentacao[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 py-3 rounded-xl text-base font-medium transition-colors ${
                  tipo === t
                    ? t === "entrada" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t === "entrada" ? "Entrada" : "Saída"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-base text-gray-500 mb-2">Valor</p>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400 text-base">R$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-colors"
            />
          </div>
        </div>

        {erro && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
        )}

        <div className="flex gap-3">
          <button onClick={onFechar} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!valorValido || salvando}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-colors ${
              valorValido && !salvando ? "bg-green-500 hover:bg-green-600 cursor-pointer" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal "Meus Destinos" ────────────────────────────────────────────────────

function ModalMeusDestinos({
  viagens,
  viagemAtivaId,
  onFechar,
  onSelecionar,
  onApagar,
  onDeslogar,
}: {
  viagens: ViagemItem[];
  viagemAtivaId: string | null;
  onFechar: () => void;
  onSelecionar: (id: string) => Promise<void>;
  onApagar: (id: string) => Promise<void>;
  onDeslogar: () => Promise<void>;
}) {
  const router = useRouter();
  const [selecionandoId, setSelecionandoId] = useState<string | null>(null);
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const [deslogando, setDeslogando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSelecionarViagem(id: string) {
    setErro("");
    setSelecionandoId(id);

    try {
      await onSelecionar(id);
      onFechar();
    } catch {
      setErro("Nao foi possivel selecionar esse destino.");
    } finally {
      setSelecionandoId(null);
    }
  }

  function handleAdicionarOutroDestino() {
    onFechar();
    router.push("/diagnostico");
  }

  async function handleApagarViagem(id: string, destino: string) {
    const confirmou = window.confirm(
      `Tem certeza que deseja apagar "${destino}"? Essa acao nao pode ser desfeita.`
    );

    if (!confirmou) return;

    setErro("");
    setApagandoId(id);

    try {
      await onApagar(id);
    } catch {
      setErro("Nao foi possivel apagar esse destino.");
    } finally {
      setApagandoId(null);
    }
  }

  async function handleDeslogar() {
    setErro("");
    setDeslogando(true);

    try {
      await onDeslogar();
      onFechar();
    } catch {
      setErro("Nao foi possivel sair da conta.");
    } finally {
      setDeslogando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white px-6 pt-6 pb-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Meus destinos</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {viagens.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum destino cadastrado ainda.</p>
        ) : (
          <div className="space-y-2 mb-5">
            {viagens.map((viagem) => {
              const ativa = viagem.id === viagemAtivaId;
              const custoTotal = calcularPlanoViagem(viagem.dados).custoTotal;
              return (
                <div
                  key={viagem.id}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    ativa
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-100 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelecionarViagem(viagem.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className={`text-sm font-semibold truncate ${ativa ? "text-blue-800" : "text-gray-900"}`}>
                        {viagem.dados.destino}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatarDataCompleta(viagem.dados.dataIda)}
                        {viagem.dados.dataVolta ? ` a ${formatarDataCompleta(viagem.dados.dataVolta)}` : ""}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{moeda(custoTotal)}</p>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {ativa && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          Ativa
                        </span>
                      )}
                      {selecionandoId === viagem.id && (
                        <span className="text-[10px] font-semibold text-gray-400">
                          Salvando...
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleApagarViagem(viagem.id, viagem.dados.destino)}
                        disabled={apagandoId === viagem.id}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        {apagandoId === viagem.id ? "Apagando..." : "Apagar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {erro && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>
        )}

        <button
          onClick={handleAdicionarOutroDestino}
          className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          + Adicionar outro destino
        </button>

        <button
          onClick={handleDeslogar}
          disabled={deslogando}
          className="mt-3 w-full rounded-xl border border-red-100 bg-red-50 py-3 text-sm font-medium text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
        >
          {deslogando ? "Saindo..." : "Deslogar"}
        </button>
      </div>
    </div>
  );
}

// ─── Navegação inferior com popover ──────────────────────────────────────────

function NavInferior({
  onAdicionarCapital,
  onMeusDestinos,
}: {
  onAdicionarCapital: () => void;
  onMeusDestinos: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {aberto && <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />}

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-none border-t border-gray-100 bg-white/95 shadow-[0_-12px_35px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:max-w-sm">

      {aberto && (
        <div className="absolute bottom-full left-1/2 z-20 mb-3 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
          <button
            onClick={() => { setAberto(false); onAdicionarCapital(); }}
            className="w-full px-4 py-4 text-left text-base text-gray-700 transition-colors hover:bg-gray-50"
          >
            Adicionar capital
          </button>
        </div>
      )}

      <div className="flex items-center justify-between px-8 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
        <button
          onClick={() => alert("Em breve")}
          className="flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-gray-600"
        >
          <span className="text-3xl leading-none">✈️</span>
          <span className="text-base leading-tight">Passagens</span>
        </button>

        <button
          onClick={() => setAberto(!aberto)}
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-4xl font-medium text-white shadow-lg transition-all duration-200 hover:bg-green-600 ${aberto ? "rotate-45" : ""}`}
        >
          +
        </button>

        <button
          onClick={onMeusDestinos}
          className="flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-gray-600"
        >
          <span className="text-3xl leading-none">🗺️</span>
          <span className="text-base leading-tight">Meus destinos</span>
        </button>
      </div>
    </div>
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MinhaViagem() {
  const router = useRouter();
  const [store, setStore] = useState<ViagemStore>(STORE_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modalCapitalAberto, setModalCapitalAberto] = useState(false);
  const [modalDestinosAberto, setModalDestinosAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [modalChecklistAberto, setModalChecklistAberto] = useState(false);
  const [checklists, setChecklists] = useState<Record<string, ChecklistEstado>>(() =>
    carregarChecklists()
  );
  const [avatar, setAvatar] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CHAVE_AVATAR);
  });

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setErro("");

      try {
        const storeCarregado = await carregarViagemStore();
        if (!cancelado) setStore(storeCarregado);
      } catch {
        if (!cancelado) setErro("Nao foi possivel carregar suas viagens.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, []);

  async function handleAdicionarMovimentacao(mov: Movimentacao) {
    const storeAtualizado = await adicionarMovimentacaoRepository(mov);
    setStore(storeAtualizado);
  }

  async function handleSelecionarViagem(id: string) {
    const storeAtualizado = await definirViagemAtivaRepository(id);
    setStore(storeAtualizado);
  }

  async function handleApagarViagem(id: string) {
    const storeAtualizado = await apagarViagemRepository(id);
    setStore(storeAtualizado);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const resultado = typeof reader.result === "string" ? reader.result : null;
      if (!resultado) return;

      localStorage.setItem(CHAVE_AVATAR, resultado);
      setAvatar(resultado);
    };
    reader.readAsDataURL(file);
  }

  function atualizarChecklistViagem(
    tripId: string,
    updater: (estado: ChecklistEstado) => ChecklistEstado
  ) {
    setChecklists((prev) => {
      const atual = obterChecklistEstado(prev, tripId);
      const proximo = { ...prev, [tripId]: updater(atual) };
      salvarChecklists(proximo);
      return proximo;
    });
  }

  function handleAlternarRecomendado(tripId: string, tarefaId: string) {
    atualizarChecklistViagem(tripId, (estado) => ({
      ...estado,
      recomendados: estado.recomendados.map((tarefa) =>
        tarefa.id === tarefaId ? { ...tarefa, concluido: !tarefa.concluido } : tarefa
      ),
    }));
  }

  function handleCriarChecklistPessoal(tripId: string, titulo: string) {
    atualizarChecklistViagem(tripId, (estado) => ({
      ...estado,
      pessoais: [
        ...estado.pessoais,
        {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          titulo,
          subitens: [],
        },
      ],
    }));
  }

  function handleAdicionarSubitem(tripId: string, checklistId: string, titulo: string) {
    atualizarChecklistViagem(tripId, (estado) => ({
      ...estado,
      pessoais: estado.pessoais.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              subitens: [
                ...checklist.subitens,
                {
                  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                  titulo,
                  concluido: false,
                },
              ],
            }
          : checklist
      ),
    }));
  }

  function handleAlternarSubitem(tripId: string, checklistId: string, subitemId: string) {
    atualizarChecklistViagem(tripId, (estado) => ({
      ...estado,
      pessoais: estado.pessoais.map((checklist) =>
        checklist.id === checklistId
          ? {
              ...checklist,
              subitens: checklist.subitens.map((subitem) =>
                subitem.id === subitemId
                  ? { ...subitem, concluido: !subitem.concluido }
                  : subitem
              ),
            }
          : checklist
      ),
    }));
  }

  async function handleDeslogar() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    const storeAtualizado = await carregarViagemStore();
    setStore(storeAtualizado);
    router.replace("/login");
  }

  const viagemAtiva = store.viagens.find((v) => v.id === store.viagemAtivaId) ?? null;

  if (carregando) {
    return (
      <div className="flex flex-col">
        <div className="flex-1 px-5 py-12 text-center">
          <p className="text-sm text-gray-400">Carregando sua viagem...</p>
        </div>
      </div>
    );
  }

  // Estado vazio
  if (!viagemAtiva) {
    return (
      <>
        {modalDestinosAberto && (
          <ModalMeusDestinos
            viagens={store.viagens}
            viagemAtivaId={store.viagemAtivaId}
            onFechar={() => setModalDestinosAberto(false)}
            onSelecionar={handleSelecionarViagem}
            onApagar={handleApagarViagem}
            onDeslogar={handleDeslogar}
          />
        )}
        <div className="flex min-h-dvh flex-col">
          <div className="flex-1 px-5 pb-36 pt-16 text-center space-y-6">
            {erro && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                {erro}
              </p>
            )}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl">
              ✈️
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-bold leading-tight text-gray-900">
                Opa, seja bem bem vindo viajante!
              </h1>
              <p className="mx-auto max-w-xs text-base leading-relaxed text-gray-500">
                Clique no botão abaixo para registrar o seu primeiro destino
              </p>
            </div>
            <Link
              href="/diagnostico"
              className="inline-block w-full max-w-xs rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Registrar primeiro destino
            </Link>
          </div>
          <NavInferior
            onAdicionarCapital={() => {}}
            onMeusDestinos={() => setModalDestinosAberto(true)}
          />
        </div>
      </>
    );
  }

  const { dados, movimentacoes } = viagemAtiva;
  const checklistViagem = obterChecklistEstado(checklists, viagemAtiva.id);
  const plano = calcularPlanoViagem(dados);

  const meta = {
    passagem:    dados.valorPassagem,
    hospedagem:  dados.valorHospedagem,
    alimentacao: dados.valorAlimentacao,
    passeios:    dados.valorPasseios,
  };

  const reservado = {
    passagem:    calcularReservado(movimentacoes, "passagem"),
    hospedagem:  calcularReservado(movimentacoes, "hospedagem"),
    alimentacao: calcularReservado(movimentacoes, "alimentacao"),
    passeios:    calcularReservado(movimentacoes, "passeios"),
  };

  const totalReservado = Object.values(reservado).reduce((a, b) => a + b, 0);
  const restante = Math.max(0, plano.custoTotal - totalReservado);
  const percentualReservado =
    plano.custoTotal > 0 ? (totalReservado / plano.custoTotal) * 100 : 0;
  const metaMensal = dados.valorGuardadoPorMes;
  const mesAtual = chaveMes(new Date());
  const guardadoMesAtual = calcularGuardadoNoMes(movimentacoes, mesAtual);
  const historicoMensal = calcularHistoricoMensal(movimentacoes, metaMensal);

  const tempoFaltando =
    plano.diasAteViagem < 30
      ? `${plano.diasAteViagem} ${plano.diasAteViagem === 1 ? "dia" : "dias"}`
      : `${plano.mesesAteViagem} ${plano.mesesAteViagem === 1 ? "mês" : "meses"}`;

  const categorias = [
    { emoji: "✈️", nome: "Passagens",   meta: meta.passagem,    reservado: reservado.passagem,    cor: "bg-blue-500"   },
    { emoji: "🏨", nome: "Hospedagem",  meta: meta.hospedagem,  reservado: reservado.hospedagem,  cor: "bg-purple-500" },
    { emoji: "🍽️", nome: "Alimentação", meta: meta.alimentacao, reservado: reservado.alimentacao, cor: "bg-orange-500" },
    { emoji: "📸", nome: "Passeios",    meta: meta.passeios,    reservado: reservado.passeios,    cor: "bg-amber-500"  },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-hidden">

      {modalCapitalAberto && (
        <ModalAdicionarCapital
          onFechar={() => setModalCapitalAberto(false)}
          onSalvar={handleAdicionarMovimentacao}
          meta={meta}
          reservado={reservado}
        />
      )}

      {modalDestinosAberto && (
        <ModalMeusDestinos
          viagens={store.viagens}
          viagemAtivaId={store.viagemAtivaId}
          onFechar={() => setModalDestinosAberto(false)}
          onSelecionar={handleSelecionarViagem}
          onApagar={handleApagarViagem}
          onDeslogar={handleDeslogar}
        />
      )}

      {modalHistoricoAberto && (
        <ModalHistoricoMensal
          historico={historicoMensal}
          onFechar={() => setModalHistoricoAberto(false)}
        />
      )}

      {modalChecklistAberto && (
        <ModalChecklist
          estado={checklistViagem}
          onFechar={() => setModalChecklistAberto(false)}
          onAlternarRecomendado={(id) => handleAlternarRecomendado(viagemAtiva.id, id)}
          onCriarChecklist={(titulo) => handleCriarChecklistPessoal(viagemAtiva.id, titulo)}
          onAdicionarSubitem={(checklistId, titulo) =>
            handleAdicionarSubitem(viagemAtiva.id, checklistId, titulo)
          }
          onAlternarSubitem={(checklistId, subitemId) =>
            handleAlternarSubitem(viagemAtiva.id, checklistId, subitemId)
          }
        />
      )}

      {/* Conteúdo rolável */}
      <div className="min-w-0 px-4 pt-5 pb-36 space-y-4 sm:px-5 sm:pt-6">
        {erro && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
            {erro}
          </p>
        )}

        {/* 1 — Header */}
        <div className="flex min-w-0 items-start justify-between gap-3 overflow-hidden">
          <div className="flex min-w-0 items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl shrink-0">✈️</div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Olá, Viajante! ✈️</h1>
              <p className="text-base text-gray-500 leading-snug mt-1">
                Pronto para mais<br />uma grande viagem?
              </p>
            </div>
          </div>
          <label
            className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-full bg-gradient-to-br from-teal-400 to-blue-500 bg-cover bg-center transition-transform active:scale-95"
            style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
            aria-label="Carregar foto de perfil"
            title="Carregar foto"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="sr-only"
            />
          </label>
        </div>

        {/* 2 — Próxima viagem */}
        <div className="min-w-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest text-gray-400">Próxima viagem</p>
              <p className="text-3xl font-bold text-gray-900 mt-1 truncate">{dados.destino}</p>
              <p className="text-base text-gray-400 mt-0.5">
                {formatarData(dados.dataIda)}
                {dados.dataVolta ? ` a ${formatarData(dados.dataVolta)}` : ""}
              </p>
              <Link
                href="/diagnostico?editar=1"
                className="inline-block mt-3 text-base bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-1.5 rounded-full transition-colors"
              >
                Editar info
              </Link>
            </div>
            <div className="w-px bg-gray-100 self-stretch shrink-0" />
            <div className="text-right shrink-0 pl-1">
              <p className="text-xs uppercase tracking-widest text-gray-400">Faltam</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{tempoFaltando}</p>
            </div>
          </div>
        </div>

        {/* 3 — Meta do mês */}
        <CardMetaMes
          metaMensal={metaMensal}
          guardadoMes={guardadoMesAtual}
          onAbrirHistorico={() => setModalHistoricoAberto(true)}
        />

        {/* 4 — Resumo do orçamento */}
        <div className="min-w-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-gray-400">Resumo do orçamento</p>
            <Link href="/diagnostico?editar=1" className="text-base text-blue-500 hover:text-blue-600">Editar</Link>
          </div>

          <div className="grid min-w-0 grid-cols-3 gap-2 mb-4">
            <div>
              <p className="text-xs text-gray-400 leading-tight">Orçamento total</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{moeda(plano.custoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 leading-tight">Reservado</p>
              <p className="text-base font-bold text-green-600 mt-0.5">{moeda(totalReservado)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 leading-tight">Restante</p>
              <p className={`text-base font-bold mt-0.5 ${restante === 0 ? "text-green-500" : "text-gray-900"}`}>
                {restante === 0 ? "✓ Meta!" : moeda(restante)}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-4">
            <AnelProgresso percentual={percentualReservado} consegue={plano.consegueViajarNaData} />
            <div className="space-y-2.5 flex-1 min-w-0">
              <LegendaItem cor="bg-blue-500"  label="Orçamento total" valor={moeda(plano.custoTotal)} />
              <LegendaItem cor="bg-green-500" label="Reservado"        valor={moeda(totalReservado)} />
              <LegendaItem cor="bg-gray-200"  label="Restante"         valor={moeda(restante)} />
            </div>
          </div>
        </div>

        {/* 5 — Checklist */}
        <CardChecklist
          estado={checklistViagem}
          onAbrir={() => setModalChecklistAberto(true)}
        />

        {/* 6 — Custos por categoria */}
        <div className="min-w-0 rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Custos por categoria</p>
          <div className="grid max-w-full grid-cols-2 gap-3 sm:flex sm:overflow-x-auto sm:overscroll-x-contain sm:pb-1">
            {categorias.map((cat) => (
              <CardCategoria key={cat.nome} {...cat} />
            ))}
          </div>
        </div>

      </div>

      {/* 5 — Navegação inferior */}
      <NavInferior
        onAdicionarCapital={() => setModalCapitalAberto(true)}
        onMeusDestinos={() => setModalDestinosAberto(true)}
      />

    </div>
  );
}
