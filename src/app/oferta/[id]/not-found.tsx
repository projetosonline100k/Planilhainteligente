export default function OfertaNaoEncontrada() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 pb-32 text-white">
      <div className="max-w-sm rounded-3xl border border-white/10 bg-white/[0.05] p-7 text-center">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Vaiviajar</p>
        <h1 className="mt-3 text-xl font-bold">Esta oportunidade não foi encontrada.</h1>
        <p className="mt-3 text-sm text-white/60">Confira o link da oportunidade.</p>
      </div>
    </main>
  );
}
