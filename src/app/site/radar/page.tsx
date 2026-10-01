"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import LocalAutocomplete from "@/components/site/LocalAutocomplete";
import OfferDrawer from "@/components/site/OfferDrawer";
import PainelRotasAcompanhadas from "@/components/site/RotasAcompanhadas";
import { codigoPorCidade } from "@/data/airports";
import { fetchOffers, sanitizeImageUrl, type OfferSummary, type OffersResult } from "@/lib/offers";
import { filtrarOrdenarOfertas, type OrdemOfertas } from "@/lib/offersFilter";
import { formatarDataCurta, formatarPreco } from "@/lib/offersFormat";
import { ofertaCombinaComAlgumaRota } from "@/lib/offersRelevance";
import { criarRotaAcompanhada, fetchRotasAcompanhadas, type RotaAcompanhada } from "@/lib/rotasAcompanhadas";
import { supabase } from "@/lib/supabase";

type Ordem = OrdemOfertas;
type Estado = "loading" | "ready" | "empty" | "error";
type Aba = "para-voce" | "todas";
type RotasEstado = "carregando" | "sem-sessao" | "erro" | "pronto";

function CardOferta({ offer, combina, onVerOferta }: { offer: OfferSummary; combina: boolean; onVerOferta: (offer: OfferSummary) => void }) {
  const imagem = sanitizeImageUrl(offer.image_url);
  const ida = formatarDataCurta(offer.outbound_date);
  const volta = formatarDataCurta(offer.return_date);

  return (
    <button
      type="button"
      onClick={() => onVerOferta(offer)}
      className="block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] bg-gradient-to-br from-blue-100 to-slate-100">
        {imagem ? (
          <Image src={imagem} alt={`Destino: ${offer.destination_name}`} fill unoptimized sizes="(max-width: 640px) 100vw, 360px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl" role="img" aria-label="Destino de viagem">✈️</div>
        )}
        {offer.savings_percentage != null && (
          <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-3 py-1.5 text-sm font-black text-white shadow">
            -{offer.savings_percentage}%
          </span>
        )}
      </div>
      <div className="p-5">
        {combina && (
          <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
            ✓ Você acompanha essa rota
          </p>
        )}
        <p className="text-sm font-bold text-slate-500">Saindo de {offer.origin_name}</p>
        <h3 className="mt-0.5 text-2xl font-black leading-tight text-slate-900">{offer.destination_name}</h3>

        {offer.savings_percentage != null && (
          <p className="mt-2 text-sm font-bold text-rose-600">{offer.savings_percentage}% abaixo do normal</p>
        )}

        <p className="mt-3 text-3xl font-black text-slate-900">{formatarPreco(offer.price)}</p>
        <p className="text-sm text-slate-500">ida e volta</p>

        {offer.typical_price != null && (
          <p className="mt-2 text-sm text-slate-500">
            Normal: <span className="line-through">{formatarPreco(offer.typical_price)}</span>
          </p>
        )}
        {offer.savings_amount != null && (
          <p className="text-sm font-bold text-emerald-600">Economize {formatarPreco(offer.savings_amount)}</p>
        )}

        {(ida || volta) && (
          <p className="mt-3 text-base font-semibold text-slate-700">{ida ?? "?"} a {volta ?? "?"}</p>
        )}

        <span className="mt-4 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-base font-black text-white">
          Ver oferta
        </span>
      </div>
    </button>
  );
}

function RadarConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [origem, setOrigem] = useState(searchParams.get("origem") ?? "");
  const [destino, setDestino] = useState(searchParams.get("destino") ?? "");
  const [ordem, setOrdem] = useState<Ordem>("relevantes");
  const [estado, setEstado] = useState<Estado>("loading");
  const [offers, setOffers] = useState<OfferSummary[]>([]);
  const [tentativa, setTentativa] = useState(0);

  const veioDeBusca = Boolean(searchParams.get("origem") || searchParams.get("destino"));
  const [aba, setAba] = useState<Aba>(veioDeBusca ? "todas" : "para-voce");

  const [token, setToken] = useState("");
  const [rotas, setRotas] = useState<RotaAcompanhada[]>([]);
  const [rotasEstado, setRotasEstado] = useState<RotasEstado>("carregando");
  const [acompanhando, setAcompanhando] = useState(false);
  const [erroAcompanhar, setErroAcompanhar] = useState("");

  const [ofertaAberta, setOfertaAberta] = useState<OfferSummary | null>(null);

  useEffect(() => {
    let disposed = false;
    fetchOffers().then((result: OffersResult) => {
      if (disposed) return;
      if (result.state === "error") { setEstado("error"); return; }
      setOffers(result.offers);
      setEstado(result.state);
    });
    return () => { disposed = true; };
  }, [tentativa]);

  useEffect(() => {
    let disposed = false;
    void supabase.auth.getSession().then(async ({ data: sessao }) => {
      const accessToken = sessao.session?.access_token;
      if (!accessToken) {
        if (!disposed) setRotasEstado("sem-sessao");
        return;
      }
      setToken(accessToken);
      const resultado = await fetchRotasAcompanhadas(accessToken);
      if (disposed) return;
      if (resultado.state === "error") { setRotasEstado("erro"); return; }
      setRotas(resultado.rotas);
      setRotasEstado("pronto");
    });
    return () => { disposed = true; };
  }, []);

  async function acompanharRota() {
    if (!token) { router.push(`/login?returnTo=${encodeURIComponent("/site/radar")}`); return; }
    setAcompanhando(true);
    setErroAcompanhar("");
    const resultado = await criarRotaAcompanhada(
      token,
      { name: origem.trim(), code: codigoPorCidade(origem) },
      { name: destino.trim(), code: codigoPorCidade(destino) },
    );
    setAcompanhando(false);
    if (!resultado.ok) { setErroAcompanhar(resultado.error); return; }
    setRotas((atuais) => (atuais.some((item) => item.id === resultado.rota.id) ? atuais : [resultado.rota, ...atuais]));
    setOrigem("");
    setDestino("");
    setAba("para-voce");
  }

  const filtradas = useMemo(() => filtrarOrdenarOfertas(offers, { origem, destino, ordem }), [offers, origem, destino, ordem]);

  return (
    <div className="px-5 py-8 sm:px-8 lg:py-10">
      <p className="text-xs font-black uppercase tracking-widest text-blue-600">Radar de ofertas</p>
      <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">O Radar encontra as melhores oportunidades para você</h1>

      <div className="mt-6 flex gap-2">
        {([
          ["todas", "Todas as ofertas"],
          ["para-voce", "Para você"],
        ] as [Aba, string][]).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setAba(valor)}
            className={`rounded-full px-5 py-2.5 text-sm font-black transition-colors ${
              aba === valor ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "para-voce" && (
        <div className="mt-6">
          {rotasEstado === "sem-sessao" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Entre na sua conta para ver as rotas que você acompanha.
              <Link href="/login" className="ml-2 font-black text-blue-700 hover:underline">Entrar</Link>
            </div>
          )}
          {rotasEstado === "carregando" && <p className="text-base font-semibold text-slate-500">Carregando...</p>}
          {rotasEstado === "erro" && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-base font-semibold text-rose-800">
              Não foi possível carregar suas passagens acompanhadas.
            </div>
          )}
          {rotasEstado === "pronto" && (
            <PainelRotasAcompanhadas token={token} rotas={rotas} setRotas={setRotas} offers={offers} onVerOferta={setOfertaAberta} />
          )}
        </div>
      )}

      {aba === "todas" && (
        <>
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <LocalAutocomplete titulo="Saindo de" placeholder="Saindo de" value={origem} onChange={setOrigem} />
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <LocalAutocomplete titulo="Para onde?" placeholder="Para onde?" value={destino} onChange={setDestino} />
            {(origem.trim() || destino.trim()) && (
              <button
                type="button"
                onClick={() => { setOrigem(""); setDestino(""); }}
                className="shrink-0 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Limpar filtro
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ["relevantes", "Mais relevantes"],
              ["desconto", "Maior desconto"],
              ["preco", "Menor preço"],
            ] as [Ordem, string][]).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setOrdem(valor)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                  ordem === valor ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {estado === "loading" && <p className="text-base font-semibold text-slate-600">Buscando as melhores oportunidades...</p>}
            {estado === "error" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-base font-semibold text-slate-700">Não conseguimos carregar as ofertas agora.</p>
                <button type="button" onClick={() => { setEstado("loading"); setTentativa((v) => v + 1); }} className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-base font-black text-white">
                  Tentar novamente
                </button>
              </div>
            )}
            {estado === "empty" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-base font-semibold text-slate-700">Nenhuma oportunidade encontrada agora.</p>
                <p className="mt-1 text-sm text-slate-500">Nosso radar continua procurando novas passagens.</p>
              </div>
            )}
            {estado === "ready" && filtradas.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm font-semibold text-slate-500">Nenhuma oferta encontrada para essa busca.</p>
                {origem.trim() && destino.trim() && (
                  <>
                    <p className="mt-1 text-sm text-slate-500">
                      O VaiViajar pode continuar procurando essa passagem para você e avisar assim que aparecer.
                    </p>
                    {erroAcompanhar && <p className="mt-2 text-sm font-semibold text-rose-600">{erroAcompanhar}</p>}
                    <button
                      type="button"
                      onClick={() => void acompanharRota()}
                      disabled={acompanhando}
                      className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {acompanhando ? "Ativando..." : "Acompanhar esta rota"}
                    </button>
                  </>
                )}
              </div>
            )}
            {estado === "ready" && filtradas.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtradas.map((offer) => (
                  <CardOferta key={offer.id} offer={offer} combina={ofertaCombinaComAlgumaRota(offer, rotas)} onVerOferta={setOfertaAberta} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <OfferDrawer offer={ofertaAberta} onClose={() => setOfertaAberta(null)} />
    </div>
  );
}

export default function SiteRadar() {
  return (
    <Suspense fallback={<div className="px-5 py-8 text-sm font-semibold text-slate-500 sm:px-8">Carregando...</div>}>
      <RadarConteudo />
    </Suspense>
  );
}
