import Link from "next/link";

export function CabecalhoOferta() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/site" className="text-lg font-black tracking-tight text-slate-900">
          ✈ Vaiviajar
        </Link>
        <Link
          href="/site/radar"
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 sm:text-sm"
        >
          Ver mais ofertas
        </Link>
      </div>
    </header>
  );
}

export function AvisoOferta({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <CabecalhoOferta />
      <main className="flex items-center justify-center px-4 py-20">
        <div role="alert" className="max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-4xl" aria-hidden="true">✈️</p>
          <h1 className="mt-4 text-xl font-black">{titulo}</h1>
          <p className="mt-2 text-sm text-slate-500">{texto}</p>
          <Link href="/site/radar" className="mt-6 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-700">
            Ver outras oportunidades
          </Link>
        </div>
      </main>
    </div>
  );
}
