import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublicFlightOffer } from "@/lib/publicFlightOffer";
import OfferMembershipStatus from "@/components/OfferMembershipStatus";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Oportunidade de viagem | Vaiviajar" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataPtBr = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function formatarData(value: string | null): string {
  if (!value) return "Não informada";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Não informada" : dataPtBr.format(date);
}

function imagemPublica(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  let offer;
  try {
    offer = await getPublicFlightOffer(id);
  } catch {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-6 pb-32 text-white">
        <div role="alert" className="max-w-sm rounded-3xl border border-white/10 bg-white/[0.05] p-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Vaiviajar</p>
          <h1 className="mt-3 text-xl font-bold">Não foi possível buscar esta oportunidade agora.</h1>
          <p className="mt-3 text-sm text-white/60">Tente novamente em alguns instantes.</p>
        </div>
      </main>
    );
  }
  if (!offer) notFound();

  const active = offer.status === "active";
  const image = imagemPublica(offer.image_url);

  return (
    <main className="min-h-dvh bg-[linear-gradient(160deg,#061b31,#020617_60%,#05192b)] px-4 pb-32 pt-[calc(env(safe-area-inset-top)+5rem)] text-white">
      <article className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] shadow-xl shadow-black/20">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-cyan-900 to-slate-900">
          {image ? (
            <Image src={image} alt={`Destino: ${offer.destination_name}`} fill unoptimized sizes="(max-width: 544px) 100vw, 512px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl" role="img" aria-label="Destino de viagem">✈️</div>
          )}
          {offer.savings_percentage != null && (
            <span className="absolute bottom-4 left-4 rounded-full bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg">
              {offer.savings_percentage}% abaixo do normal
            </span>
          )}
        </div>
        <div className="p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Oportunidade de viagem</p>
          <h1 className="mt-3 text-2xl font-black">{offer.origin_name} <span className="text-cyan-300">→</span> {offer.destination_name}</h1>
          <p className="mt-2 text-xs text-white/50">{offer.origin_code} → {offer.destination_code}</p>
          <p className="mt-5 text-sm font-semibold text-white/70">Status: {active ? "Ativa" : "Inativa"}</p>
          {!active && <p role="status" className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-200">Esta oportunidade não está mais ativa.</p>}
          <div className="mt-6">
            <p className="text-4xl font-black tracking-tight text-white">{moeda.format(offer.price)}</p>
            <p className="mt-1 text-sm text-white/60">ida e volta</p>
            <p className="mt-4 text-sm text-white/60">Preço normal: {offer.typical_price == null ? "Não informado" : moeda.format(offer.typical_price)}</p>
            {offer.savings_amount != null && <p className="mt-2 font-bold text-emerald-300">Você economiza {moeda.format(offer.savings_amount)}</p>}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
            <div><dt className="text-xs text-white/50">Ida</dt><dd className="mt-1 text-sm font-bold">{formatarData(offer.outbound_date)}</dd></div>
            <div><dt className="text-xs text-white/50">Volta</dt><dd className="mt-1 text-sm font-bold">{formatarData(offer.return_date)}</dd></div>
          </dl>
          <OfferMembershipStatus offerId={offer.id} />
        </div>
      </article>
    </main>
  );
}
