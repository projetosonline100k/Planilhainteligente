import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicFlightOffer } from "@/lib/publicFlightOffer";
import OfferMembershipStatus from "@/components/OfferMembershipStatus";
import { AvisoOferta, CabecalhoOferta } from "@/components/OfertaLayout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Oportunidade de viagem | Vaiviajar" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatarData(value: string | null): string {
  if (!value) return "Não informada";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Não informada" : `${String(date.getUTCDate()).padStart(2, "0")} ${MESES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
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
    return <AvisoOferta titulo="Não foi possível buscar esta oportunidade agora." texto="Tente novamente em alguns instantes." />;
  }
  if (!offer) notFound();

  const active = offer.status === "active";
  const image = imagemPublica(offer.image_url);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <CabecalhoOferta />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6 lg:pt-10">
        <nav className="mb-4 hidden text-sm text-slate-500 lg:block">
          <Link href="/site/radar" className="hover:text-blue-700">Radar de ofertas</Link>
          <span className="mx-2">/</span>
          <span className="font-semibold text-slate-700">{offer.origin_name} → {offer.destination_name}</span>
        </nav>

        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:gap-8">
          <section className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-blue-100 to-slate-200 shadow-sm lg:aspect-auto lg:min-h-[560px]">
            {image ? (
              <Image
                src={image}
                alt={`Destino: ${offer.destination_name}`}
                fill
                unoptimized
                priority
                sizes="(max-width: 1024px) 100vw, 640px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-7xl" role="img" aria-label="Destino de viagem">✈️</div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-5 pt-16 sm:p-7">
              {offer.savings_percentage != null && (
                <span className="inline-flex rounded-full bg-emerald-400 px-3 py-1.5 text-sm font-black text-slate-950 shadow">
                  {offer.savings_percentage}% abaixo do normal
                </span>
              )}
              <p className="mt-3 text-sm font-semibold text-white/80">Saindo de {offer.origin_name}</p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{offer.destination_name}</h1>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:self-start">
            <p className="text-xs font-black uppercase tracking-widest text-blue-600">Oportunidade de viagem</p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">
              {offer.origin_name} <span className="text-blue-600">→</span> {offer.destination_name}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">{offer.origin_code} → {offer.destination_code} · ida e volta</p>

            {!active && (
              <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Esta oportunidade não está mais ativa.
              </p>
            )}

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-4xl font-black tracking-tight text-slate-900">{moeda.format(offer.price)}</p>
              <p className="text-sm text-slate-500">por pessoa, ida e volta</p>
              {offer.typical_price != null && (
                <p className="mt-3 text-sm text-slate-500">
                  Preço normal: <span className="line-through">{moeda.format(offer.typical_price)}</span>
                </p>
              )}
              {offer.savings_amount != null && (
                <p className="mt-1 text-sm font-black text-emerald-600">Você economiza {moeda.format(offer.savings_amount)}</p>
              )}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 p-3">
                <dt className="text-xs font-semibold text-slate-400">Ida</dt>
                <dd className="mt-1 text-sm font-black">{formatarData(offer.outbound_date)}</dd>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <dt className="text-xs font-semibold text-slate-400">Volta</dt>
                <dd className="mt-1 text-sm font-black">{formatarData(offer.return_date)}</dd>
              </div>
            </dl>

            <OfferMembershipStatus offerId={offer.id} />

            <ul className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-xs font-semibold text-slate-500">
              <li>⚡ Ofertas reais encontradas pelo nosso radar</li>
              <li>🔔 Preços promocionais costumam acabar rápido</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
