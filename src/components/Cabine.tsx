"use client";

import Link from "next/link";

type Aula = {
  id: string;
  titulo: string;
  modulo: string;
  duracao: string;
  progresso: number;
  destaque?: boolean;
  cor: string;
};

const aulas: Aula[] = [
  {
    id: "boas-vindas",
    titulo: "Boas-vindas à Cabine",
    modulo: "Comece por aqui",
    duracao: "06 min",
    progresso: 72,
    destaque: true,
    cor: "from-sky-500 via-blue-600 to-indigo-700",
  },
  {
    id: "primeira-meta",
    titulo: "Como montar sua primeira meta",
    modulo: "Planejamento",
    duracao: "14 min",
    progresso: 28,
    destaque: true,
    cor: "from-emerald-400 via-teal-600 to-slate-900",
  },
  {
    id: "passagens",
    titulo: "Estratégia para pesquisar passagens",
    modulo: "Economia",
    duracao: "18 min",
    progresso: 0,
    cor: "from-amber-300 via-orange-500 to-rose-700",
  },
  {
    id: "roteiro",
    titulo: "Roteiro simples sem estourar orçamento",
    modulo: "Viagem",
    duracao: "21 min",
    progresso: 0,
    cor: "from-violet-400 via-fuchsia-600 to-zinc-950",
  },
];

const modulos = [
  { titulo: "Comece por aqui", aulas: 3, progresso: 72, cor: "from-cyan-400 to-blue-700" },
  { titulo: "Guardar dinheiro", aulas: 5, progresso: 28, cor: "from-emerald-400 to-teal-800" },
  { titulo: "Comprar melhor", aulas: 4, progresso: 0, cor: "from-orange-300 to-rose-700" },
];

function BarraProgresso({ valor }: { valor: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
      <div
        className="h-full rounded-full bg-red-400"
        style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
      />
    </div>
  );
}

function PlayIcon({ pequeno = false }: { pequeno?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-white text-black ${
        pequeno ? "h-9 w-9 text-base" : "h-14 w-14 text-2xl"
      }`}
      aria-hidden="true"
    >
      ▶
    </span>
  );
}

function AulaCard({ aula }: { aula: Aula }) {
  return (
    <button
      type="button"
      className="group w-40 shrink-0 text-left"
      onClick={() => alert("Player de vídeo em breve")}
    >
      <div
        className={`relative flex aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-br ${aula.cor} p-3 shadow-lg`}
      >
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="relative mt-auto w-full space-y-3">
          <PlayIcon pequeno />
          <div>
            <p className="line-clamp-2 text-lg font-bold leading-tight text-white">
              {aula.titulo}
            </p>
            <p className="mt-1 text-xs font-medium text-white/70">{aula.duracao}</p>
          </div>
          <BarraProgresso valor={aula.progresso} />
        </div>
      </div>
      <p className="mt-2 truncate text-xs font-medium text-white/50">{aula.modulo}</p>
    </button>
  );
}

function AulaHorizontal({ aula }: { aula: Aula }) {
  return (
    <button
      type="button"
      onClick={() => alert("Player de vídeo em breve")}
      className="flex w-[17rem] shrink-0 flex-col text-left"
    >
      <div
        className={`relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br ${aula.cor} p-4`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="relative flex h-full flex-col justify-end gap-3">
          <PlayIcon pequeno />
          <p className="line-clamp-2 text-xl font-bold leading-tight text-white">{aula.titulo}</p>
        </div>
      </div>
      <div className="mt-3 px-1">
        <BarraProgresso valor={aula.progresso} />
        <p className="mt-2 text-xs text-white/45">{aula.duracao}</p>
      </div>
    </button>
  );
}

export default function Cabine() {
  return (
    <div className="flex min-h-dvh animate-[appFadeIn_220ms_ease-out] flex-col bg-black text-white">
      <div className="flex-1 overflow-hidden pb-28">
        <section className="relative min-h-[25rem] overflow-hidden px-5 pb-8 pt-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(14,165,233,0.5),transparent_34%),linear-gradient(135deg,#111827_0%,#020617_54%,#000_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/10" />
          <Link
            href="/minha-viagem"
            className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-2xl text-white backdrop-blur"
            aria-label="Voltar"
          >
            ‹
          </Link>
          <div className="relative z-10 mt-16 max-w-xs">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Cabine
            </p>
            <h1 className="mt-3 text-5xl font-black leading-none text-white">
              Aula pronta para sua próxima viagem
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/72">
              Aprenda a planejar, economizar e comprar melhor sem sair do seu app.
            </p>
            <button
              type="button"
              onClick={() => alert("Player de vídeo em breve")}
              className="mt-6 inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-bold text-black"
            >
              <PlayIcon pequeno />
              Continuar aula
            </button>
          </div>
        </section>

        <section className="px-5 pt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Programa Cabine</h2>
            <span className="text-xs font-semibold text-white/45">12 aulas</span>
          </div>
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
            {modulos.map((modulo) => (
              <div key={modulo.titulo} className="w-40 shrink-0">
                <div
                  className={`flex aspect-[3/4] flex-col justify-end rounded-xl bg-gradient-to-br ${modulo.cor} p-4 shadow-lg`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                    Módulo
                  </p>
                  <p className="mt-2 text-xl font-black leading-tight">{modulo.titulo}</p>
                </div>
                <p className="mt-2 text-xs text-white/45">{modulo.aulas} aulas</p>
                <div className="mt-2">
                  <BarraProgresso valor={modulo.progresso} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pt-8">
          <h2 className="text-2xl font-bold">Continuar assistindo</h2>
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
            {aulas.filter((aula) => aula.progresso > 0).map((aula) => (
              <AulaHorizontal key={aula.id} aula={aula} />
            ))}
          </div>
        </section>

        <section className="px-5 pt-8">
          <h2 className="text-2xl font-bold">Todas as aulas</h2>
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
            {aulas.map((aula) => (
              <AulaCard key={aula.id} aula={aula} />
            ))}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-none border-t border-white/10 bg-black/95 px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 backdrop-blur sm:max-w-sm">
        <div className="grid grid-cols-5 items-end gap-1 text-[11px] font-semibold">
          <Link href="/minha-viagem" prefetch className="flex flex-col items-center gap-1 text-white/55">
            <span className="text-2xl leading-none">✈</span>
            <span className="max-w-full truncate">Passagens</span>
          </Link>
          <Link href="/cabine" prefetch className="flex min-w-0 flex-col items-center gap-1 text-cyan-300">
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
          <Link href="/roteiro" prefetch className="flex min-w-0 flex-col items-center gap-1 text-white/55">
            <span className="text-2xl leading-none">🧭</span>
            <span className="max-w-full truncate">Roteiro</span>
          </Link>
          <Link href="/minha-viagem" prefetch className="flex min-w-0 flex-col items-center gap-1 text-white/55">
            <span className="text-2xl leading-none">🗺️</span>
            <span className="max-w-full truncate">Destinos</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
