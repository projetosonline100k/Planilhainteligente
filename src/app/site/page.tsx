"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LocalAutocomplete from "@/components/site/LocalAutocomplete";
import OfferDrawer from "@/components/site/OfferDrawer";
import { fetchOffers, sanitizeImageUrl, type OfferSummary, type OffersResult } from "@/lib/offers";
import { formatarDataCurta, formatarPreco, selecionarMelhoresOfertas } from "@/lib/offersFormat";
import { ofertaCombinaComAlgumaRota, ordenarPorRotas } from "@/lib/offersRelevance";
import { fetchRotasAcompanhadas, type RotaAcompanhada } from "@/lib/rotasAcompanhadas";
import { supabase } from "@/lib/supabase";

function CardDestaque({ offer, combina, onVerOferta }: { offer: OfferSummary; combina: boolean; onVerOferta: (offer: OfferSummary) => void }) {
  const imagem = sanitizeImageUrl(offer.image_url);
  const ida = formatarDataCurta(offer.outbound_date);
  const volta = formatarDataCurta(offer.return_date);

  return (
    <button
      type="button"
      onClick={() => onVerOferta(offer)}
      className="block w-60 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-100 to-slate-100">
        {imagem ? (
          <Image src={imagem} alt={`Destino: ${offer.destination_name}`} fill unoptimized sizes="240px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl" role="img" aria-label="Destino de viagem">✈️</div>
        )}
        {offer.savings_percentage != null && (
          <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow">
            -{offer.savings_percentage}%
          </span>
        )}
      </div>
      <div className="p-3.5">
        {combina && (
          <p className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
            ✓ Você acompanha essa rota
          </p>
        )}
        <p className="truncate text-base font-black text-slate-900">{offer.destination_name}</p>
        <p className="text-xs font-semibold text-slate-500">Saindo de {offer.origin_name}</p>
        <p className="mt-2 text-lg font-black text-slate-900">{formatarPreco(offer.price)}</p>
        <p className="text-xs text-slate-500">ida e volta</p>
        {(ida || volta) && <p className="mt-1 text-xs font-semibold text-slate-600">{ida ?? "?"} a {volta ?? "?"}</p>}
      </div>
    </button>
  );
}

export default function SiteInicio() {
  const router = useRouter();
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [offers, setOffers] = useState<OfferSummary[]>([]);

  const [rotas, setRotas] = useState<RotaAcompanhada[]>([]);
  const [rotasEstado, setRotasEstado] = useState<"loading" | "ready" | "error">("loading");

  const [ofertaAberta, setOfertaAberta] = useState<OfferSummary | null>(null);

  useEffect(() => {
    let disposed = false;
    fetchOffers().then((result: OffersResult) => {
      if (disposed) return;
      if (result.state === "error") { setState("error"); return; }
      setOffers(result.offers);
      setState(result.state);
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let disposed = false;
    void supabase.auth.getSession().then(async ({ data: sessao }) => {
      const token = sessao.session?.access_token;
      if (!token) { if (!disposed) setRotasEstado("error"); return; }
      const resultado = await fetchRotasAcompanhadas(token);
      if (disposed) return;
      if (resultado.state === "error") { setRotasEstado("error"); return; }
      setRotas(resultado.rotas);
      setRotasEstado("ready");
    });
    return () => { disposed = true; };
  }, []);

  function buscar(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (origem.trim()) params.set("origem", origem.trim());
    if (destino.trim()) params.set("destino", destino.trim());
    router.push(`/site/radar${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const personalizado = rotasEstado === "ready" && rotas.length > 0;
  const semRotaConfirmado = rotasEstado === "ready" && rotas.length === 0;
  const destaques = personalizado ? ordenarPorRotas(offers, rotas) : offers;

  return (
    <div className="px-5 py-8 sm:px-8 lg:py-10">
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#eff6ff_100%)] p-6 sm:p-10">
        <p className="text-xs font-black uppercase tracking-widest text-blue-600">Planejamento de viagens</p>
        <h1 className="mt-3 max-w-xl text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
          O Vaiviajar encontra. Você vive.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
          Passagens em promoção, sem complicação. Diga de onde você sai e para onde quer ir.
        </p>

        <form onSubmit={buscar} className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
          <LocalAutocomplete titulo="Saindo de" placeholder="Qualquer origem" value={origem} onChange={setOrigem} />
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <LocalAutocomplete titulo="Para onde?" placeholder="Qualquer destino" value={destino} onChange={setDestino} />
          <button type="submit" className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700">
            Ver ofertas
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
          <span>⚡ Ofertas reais e verificadas</span>
          <span>🛡 O Radar trabalha por você, 24h</span>
          <span>🌍 Mais viagens, menos preocupação</span>
        </div>
      </section>

      {semRotaConfirmado && (
        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-black text-blue-900">Quer ofertas mais relevantes?</p>
            <p className="mt-1 text-sm text-blue-800">Cadastre uma rota e o Radar procura oportunidades especificamente para ela.</p>
          </div>
          <Link
            href="/site/radar"
            className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700"
          >
            Acompanhar uma rota
          </Link>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">{personalizado ? "Melhores oportunidades para você" : "Melhores oportunidades agora"}</h2>
          <Link href="/site/radar" className="text-sm font-bold text-blue-600 hover:text-blue-700">
            Ver todas as ofertas →
          </Link>
        </div>

        {state === "loading" && <p className="mt-4 text-sm font-semibold text-slate-500">Buscando oportunidades...</p>}
        {state === "error" && <p className="mt-4 text-sm font-semibold text-slate-500">Não conseguimos carregar as oportunidades agora.</p>}
        {state === "empty" && <p className="mt-4 text-sm font-semibold text-slate-500">Novas oportunidades estão sendo procuradas pelo Radar.</p>}

        {state === "ready" && (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {selecionarMelhoresOfertas(destaques).map((offer) => (
              <CardDestaque key={offer.id} offer={offer} combina={ofertaCombinaComAlgumaRota(offer, rotas)} onVerOferta={setOfertaAberta} />
            ))}
          </div>
        )}
      </section>

      <OfferDrawer offer={ofertaAberta} onClose={() => setOfertaAberta(null)} />
    </div>
  );
}
