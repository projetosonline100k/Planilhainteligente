"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BuscaSalva, listarRecentes } from "@/lib/flightSearchStorage";
import { buildOfferPath, fetchOffers, sanitizeImageUrl, type OfferSummary, type OffersResult } from "@/lib/offers";

type OffersState = "loading" | "ready" | "empty" | "error";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${data}T12:00:00Z`));
}

function formatarDataCurta(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : dataCurta.format(date);
}

function NavegacaoPassagens() {
  return <nav className="hidden"><span /></nav>;
}

function CardOferta({ offer, destaque }: { offer: OfferSummary; destaque?: boolean }) {
  const router = useRouter();
  const imagem = sanitizeImageUrl(offer.image_url);
  const ida = formatarDataCurta(offer.outbound_date);
  const volta = formatarDataCurta(offer.return_date);

  return (
    <button
      type="button"
      onClick={() => router.push(buildOfferPath(offer.id))}
      className={`block w-full overflow-hidden rounded-2xl border text-left transition ${destaque ? "border-amber-300/40 bg-amber-300/[0.06]" : "border-white/10 bg-white/[0.05] hover:border-cyan-300/30"}`}
    >
      <div className="relative aspect-[16/9] bg-gradient-to-br from-cyan-900 to-slate-900">
        {imagem ? (
          <Image src={imagem} alt={`Destino: ${offer.destination_name}`} fill unoptimized sizes="(max-width: 640px) 100vw, 400px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl" role="img" aria-label="Destino de viagem">✈️</div>
        )}
        {offer.savings_percentage != null && (
          <span className="absolute bottom-3 left-3 rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950 shadow-lg">
            {offer.savings_percentage}% abaixo do normal
          </span>
        )}
      </div>
      <div className="p-4">
        {destaque && <p className="mb-2 text-xs font-black uppercase tracking-widest text-amber-300">🔥 Melhor oportunidade agora</p>}
        <p className="text-lg font-black text-white">{offer.origin_name} <span className="text-cyan-300">→</span> {offer.destination_name}</p>
        <p className="mt-2 text-2xl font-black text-white">{moeda.format(offer.price)}</p>
        <p className="text-xs text-white/50">ida e volta</p>
        {offer.typical_price != null && <p className="mt-2 text-xs text-white/50">Preço normal: {moeda.format(offer.typical_price)}</p>}
        {offer.savings_amount != null && <p className="mt-1 text-xs font-bold text-emerald-300">Economize {moeda.format(offer.savings_amount)}</p>}
        {(ida || volta) && <p className="mt-2 text-xs text-white/60">{ida ?? "?"} → {volta ?? "?"}</p>}
        <span className="mt-3 inline-flex rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">Ver oferta</span>
      </div>
    </button>
  );
}

function Oportunidades() {
  const [state, setState] = useState<OffersState>("loading");
  const [offers, setOffers] = useState<OfferSummary[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    setState("loading");
    fetchOffers().then((result: OffersResult) => {
      if (disposed) return;
      if (result.state === "error") { setState("error"); return; }
      setOffers(result.offers);
      setState(result.state);
    });
    return () => { disposed = true; };
  }, [attempt]);

  if (state === "loading") {
    return <p className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center text-sm font-semibold text-white/70">Buscando as melhores oportunidades...</p>;
  }

  if (state === "error") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center">
        <p className="text-sm font-semibold text-white/70">Não conseguimos carregar as oportunidades agora.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 rounded-full bg-cyan-300 px-5 py-2 text-sm font-black text-slate-950">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 text-center">
        <p className="text-sm font-semibold text-white/70">Nenhuma oportunidade forte encontrada agora.</p>
        <p className="mt-1 text-xs text-white/50">O radar continua procurando novas passagens.</p>
      </div>
    );
  }

  const [melhor, ...outras] = offers;

  return (
    <div>
      <CardOferta offer={melhor} destaque />
      {outras.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-sm font-black uppercase tracking-widest text-white/60">Outras oportunidades</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {outras.map((offer) => <CardOferta key={offer.id} offer={offer} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default function Passagens() {
  const [ultimaBusca, setUltimaBusca] = useState<BuscaSalva | null>(null);
  useEffect(() => { queueMicrotask(() => setUltimaBusca(listarRecentes()[0] ?? null)); }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.25),transparent_28%),linear-gradient(160deg,#061b31_0%,#020617_58%,#05192b_100%)] pb-28 text-white">
      <header className="px-5 pb-5 pt-10">
        <Link href="/minha-viagem" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-2xl text-white/80" aria-label="Voltar">‹</Link>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Passagens</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Passagens baratas encontradas para você</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">O VaiViajar monitora oportunidades e mostra quando encontra preços muito abaixo do normal.</p>
      </header>

      <main className="space-y-4 px-4">
        <Oportunidades />

        <div className="space-y-3 border-t border-white/10 pt-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-white/50">Prefere buscar você mesmo?</h2>

          {ultimaBusca && (
            <Link href="/buscar-passagens" className="block rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">Sua última pesquisa</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-black">{ultimaBusca.origin} <span className="text-cyan-300">→</span> {ultimaBusca.destination}</p>
                  <p className="mt-1 text-xs text-white/55">
                    Ida: {formatarData(ultimaBusca.outboundDate)}{ultimaBusca.returnDate ? ` · Volta: ${formatarData(ultimaBusca.returnDate)}` : " · Só ida"}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950">Continuar</span>
              </div>
            </Link>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/buscar-passagens" className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-cyan-300/30">
              <span className="text-2xl">⌕</span>
              <h3 className="mt-3 font-black">Buscar passagens</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/50">Consulte preços e datas diretamente no Google Flights.</p>
            </Link>
            <Link href="/alertas" className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-amber-300/30">
              <span className="text-2xl">🔔</span>
              <h3 className="mt-3 font-black">Meus alertas</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/50">Veja alertas ativos e expirados ou remova os que não deseja mais.</p>
            </Link>
          </div>
        </div>
      </main>

      <NavegacaoPassagens />
    </div>
  );
}
