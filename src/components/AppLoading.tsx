export default function AppLoading({ label = "Preparando sua viagem" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_50%_38%,rgba(14,165,233,0.28),transparent_32%),linear-gradient(180deg,#020617_0%,#020617_58%,#07111f_100%)] px-6 text-white">
      <div className="flex flex-col items-center text-center">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border border-cyan-200/15" />
          <div className="absolute inset-2 rounded-full border border-cyan-300/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-cyan-300 border-r-cyan-300/70" />
          <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-2xl font-black text-slate-950 shadow-xl shadow-cyan-950/40">
            V
          </div>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
          Vaiviajar
        </p>
        <p className="mt-2 text-sm text-white/55">{label}</p>
      </div>
    </div>
  );
}
