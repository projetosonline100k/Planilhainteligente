"use client";

import Image from "next/image";
import { useState } from "react";
import LocalAutocomplete from "@/components/site/LocalAutocomplete";
import { codigoPorCidade } from "@/data/airports";
import { sanitizeImageUrl, type OfferSummary } from "@/lib/offers";
import { formatarDataCurta, formatarPreco } from "@/lib/offersFormat";
import { ofertasDaRota } from "@/lib/offersRelevance";
import {
  criarRotaAcompanhada,
  editarRotaAcompanhada,
  pararDeAcompanhar,
  type RotaAcompanhada,
} from "@/lib/rotasAcompanhadas";

function CardOfertaRota({ offer, onVerOferta }: { offer: OfferSummary; onVerOferta: (offer: OfferSummary) => void }) {
  const imagem = sanitizeImageUrl(offer.image_url);
  const ida = formatarDataCurta(offer.outbound_date);
  const volta = formatarDataCurta(offer.return_date);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white sm:flex">
      <div className="relative aspect-[16/10] bg-gradient-to-br from-blue-100 to-slate-100 sm:aspect-auto sm:w-48 sm:shrink-0">
        {imagem ? (
          <Image src={imagem} alt={`Destino: ${offer.destination_name}`} fill unoptimized sizes="192px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl" role="img" aria-label="Destino de viagem">✈️</div>
        )}
        {offer.savings_percentage != null && (
          <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow">
            -{offer.savings_percentage}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center p-4">
        <p className="text-base font-bold text-slate-500">{offer.destination_name}</p>
        <p className="text-xs text-slate-400">Saindo de {offer.origin_name}</p>
        <p className="mt-2 text-2xl font-black text-slate-900">{formatarPreco(offer.price)}</p>
        <p className="text-xs text-slate-500">ida e volta</p>
        {offer.typical_price != null && (
          <p className="mt-1 text-sm text-slate-500">
            Preço normal: <span className="line-through">{formatarPreco(offer.typical_price)}</span>
          </p>
        )}
        {(ida || volta) && <p className="mt-1 text-sm font-semibold text-slate-600">{ida ?? "?"} a {volta ?? "?"}</p>}
        <button
          type="button"
          onClick={() => onVerOferta(offer)}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white sm:w-auto"
        >
          Ver oferta
        </button>
      </div>
    </div>
  );
}

function RotaForm({
  titulo,
  origemInicial = "",
  destinoInicial = "",
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  origemInicial?: string;
  destinoInicial?: string;
  salvando: boolean;
  erro: string;
  onSalvar: (origem: string, destino: string) => void;
  onCancelar?: () => void;
}) {
  const [origem, setOrigem] = useState(origemInicial);
  const [destino, setDestino] = useState(destinoInicial);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSalvar(origem, destino);
      }}
      className="rounded-2xl border border-slate-200 bg-white p-5"
    >
      <p className="text-sm font-black text-slate-900">{titulo}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 rounded-xl border border-slate-200 px-1">
          <LocalAutocomplete titulo="Saindo de" placeholder="Ex: São Paulo" value={origem} onChange={setOrigem} />
        </div>
        <div className="flex-1 rounded-xl border border-slate-200 px-1">
          <LocalAutocomplete titulo="Destino" placeholder="Ex: Goiânia" value={destino} onChange={setDestino} />
        </div>
      </div>
      {erro && <p className="mt-3 text-sm font-semibold text-rose-600">{erro}</p>}
      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={salvando || !origem.trim() || !destino.trim()}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar rota"}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function CardRota({
  rota,
  offers,
  onEditar,
  onParar,
  parando,
  onVerOferta,
}: {
  rota: RotaAcompanhada;
  offers: OfferSummary[];
  onEditar: () => void;
  onParar: () => void;
  parando: boolean;
  onVerOferta: (offer: OfferSummary) => void;
}) {
  const encontradas = ofertasDaRota(offers, rota);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-slate-900">
          {rota.origin_name} <span className="text-blue-500">→</span> {rota.destination_name}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
          🟢 Acompanhamento ativo
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-500">
        {encontradas.length === 0
          ? "Ainda não encontramos uma oportunidade para essa rota."
          : `${encontradas.length} ${encontradas.length === 1 ? "oportunidade encontrada" : "oportunidades encontradas"}`}
      </p>

      {encontradas.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-3xl" role="img" aria-label="Avião">✈️</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">O Radar continua procurando.</p>
          <p className="mt-1 text-sm text-slate-500">Quando aparecer uma passagem interessante, ela será mostrada aqui automaticamente.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {encontradas.map((offer) => (
            <CardOfertaRota key={offer.id} offer={offer} onVerOferta={onVerOferta} />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={onEditar} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Editar rota
        </button>
        <button
          type="button"
          onClick={onParar}
          disabled={parando}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          {parando ? "Parando..." : "Parar de acompanhar"}
        </button>
      </div>
    </article>
  );
}

export default function PainelRotasAcompanhadas({
  token,
  rotas,
  setRotas,
  offers,
  onVerOferta,
  abrirFormularioAoIniciar = false,
}: {
  token: string;
  rotas: RotaAcompanhada[];
  setRotas: React.Dispatch<React.SetStateAction<RotaAcompanhada[]>>;
  offers: OfferSummary[];
  onVerOferta: (offer: OfferSummary) => void;
  abrirFormularioAoIniciar?: boolean;
}) {
  const [mostrarForm, setMostrarForm] = useState(abrirFormularioAoIniciar);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const [parandoId, setParandoId] = useState<string | null>(null);

  async function salvarNovaRota(origem: string, destino: string) {
    setSalvando(true);
    setErroForm("");
    const resultado = await criarRotaAcompanhada(
      token,
      { name: origem.trim(), code: codigoPorCidade(origem) },
      { name: destino.trim(), code: codigoPorCidade(destino) },
    );
    setSalvando(false);
    if (!resultado.ok) {
      setErroForm(resultado.error);
      return;
    }
    setRotas((atuais) => (atuais.some((item) => item.id === resultado.rota.id) ? atuais : [resultado.rota, ...atuais]));
    setMostrarForm(false);
  }

  async function salvarEdicao(id: string, origem: string, destino: string) {
    setSalvando(true);
    setErroForm("");
    const resultado = await editarRotaAcompanhada(
      token,
      id,
      { name: origem.trim(), code: codigoPorCidade(origem) },
      { name: destino.trim(), code: codigoPorCidade(destino) },
    );
    setSalvando(false);
    if (!resultado.ok) {
      setErroForm(resultado.error);
      return;
    }
    setRotas((atuais) => atuais.map((item) => (item.id === id ? resultado.rota : item)));
    setEditandoId(null);
  }

  async function parar(id: string) {
    setParandoId(id);
    const ok = await pararDeAcompanhar(token, id);
    setParandoId(null);
    if (ok) setRotas((atuais) => atuais.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-4">
      {rotas.length === 0 && !mostrarForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-3xl" role="img" aria-label="Avião">✈️</p>
          <p className="mt-3 text-base font-black text-slate-900">Você ainda não acompanha nenhuma passagem.</p>
          <p className="mt-1 text-sm text-slate-500">Cadastre uma rota e o VaiViajar começa a procurar oportunidades para você.</p>
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700"
          >
            + Cadastrar rota
          </button>
        </div>
      )}

      {rotas.map((rota) =>
        editandoId === rota.id ? (
          <RotaForm
            key={rota.id}
            titulo="Editar rota"
            origemInicial={rota.origin_name}
            destinoInicial={rota.destination_name}
            salvando={salvando}
            erro={erroForm}
            onSalvar={(origem, destino) => void salvarEdicao(rota.id, origem, destino)}
            onCancelar={() => { setEditandoId(null); setErroForm(""); }}
          />
        ) : (
          <CardRota
            key={rota.id}
            rota={rota}
            offers={offers}
            onEditar={() => { setEditandoId(rota.id); setErroForm(""); setMostrarForm(false); }}
            onParar={() => void parar(rota.id)}
            parando={parandoId === rota.id}
            onVerOferta={onVerOferta}
          />
        ),
      )}

      {mostrarForm && (
        <RotaForm
          titulo="Cadastrar rota"
          salvando={salvando}
          erro={erroForm}
          onSalvar={(origem, destino) => void salvarNovaRota(origem, destino)}
          onCancelar={() => { setMostrarForm(false); setErroForm(""); }}
        />
      )}

      {rotas.length > 0 && !mostrarForm && !editandoId && (
        <button
          type="button"
          onClick={() => setMostrarForm(true)}
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          + Cadastrar outra rota
        </button>
      )}
    </div>
  );
}
