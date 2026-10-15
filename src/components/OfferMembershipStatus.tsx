"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { initiateKiwifyCheckout } from "@/lib/kiwifyCheckout";
import { PLANOS, type Plano } from "@/lib/planos";

type Status = "loading" | "anonymous" | "inactive" | "active" | "error";
type BookingState = "idle" | "loading" | "error";

const BOOKING_ERROR_MESSAGES: Record<number, string> = {
  401: "Sua sessão expirou. Entre novamente para continuar.",
  403: "Seu acesso não está ativo.",
  410: "Esta oportunidade não está mais disponível.",
};
const BOOKING_GENERIC_ERROR = "Não conseguimos abrir esta oferta agora. Tente novamente.";
const botao = "inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60 sm:w-auto";
const botaoSecundario = "inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 sm:w-auto";

export default function OfferMembershipStatus({ offerId }: { offerId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [bookingState, setBookingState] = useState<BookingState>("idle");
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [escolhendoPlano, setEscolhendoPlano] = useState(false);

  useEffect(() => {
    let disposed = false;
    let version = 0;
    let controller: AbortController | undefined;

    async function verify(token?: string) {
      const current = ++version;
      controller?.abort();
      controller = new AbortController();
      setStatus("loading");
      if (!token) { setStatus("anonymous"); return; }
      try {
        const response = await fetch("/api/membership/status", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const body = await response.json();
        if (!response.ok && response.status !== 401) throw new Error("Indisponível");
        if (typeof body.authenticated !== "boolean" || typeof body.active !== "boolean" ||
          (response.status === 401 && body.authenticated)) throw new Error("Resposta inválida");
        if (!disposed && current === version) {
          setStatus(!body.authenticated ? "anonymous" : body.active ? "active" : "inactive");
        }
      } catch {
        if (!disposed && current === version) setStatus("error");
      }
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!disposed) void verify(session?.access_token);
    });
    const initialVersion = version;
    void supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (disposed || version !== initialVersion) return;
      if (error) setStatus("error");
      else void verify(sessionData.session?.access_token);
    }).catch(() => {
      if (!disposed && version === initialVersion) setStatus("error");
    });

    return () => { disposed = true; controller?.abort(); data.subscription.unsubscribe(); };
  }, [attempt]);

  async function comprarPassagem() {
    setBookingState("loading");
    setBookingMessage(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) {
        setBookingState("error");
        setBookingMessage(BOOKING_ERROR_MESSAGES[401]);
        return;
      }
      const response = await fetch(`/api/offers/${offerId}/booking`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        setBookingState("error");
        setBookingMessage(BOOKING_ERROR_MESSAGES[response.status] ?? BOOKING_GENERIC_ERROR);
        return;
      }
      const body = await response.json();
      if (typeof body.bookingUrl !== "string" || !body.bookingUrl) throw new Error("Resposta inválida");
      window.location.assign(body.bookingUrl);
    } catch {
      setBookingState("error");
      setBookingMessage(BOOKING_GENERIC_ERROR);
    }
  }

  async function assinar(plano: Plano) {
    setCheckoutMessage(null);
    const result = await initiateKiwifyCheckout({
      checkoutBaseUrl: plano.checkoutUrl,
      offerId,
      storage: typeof window === "undefined" ? null : window.localStorage,
      getEmail: async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        return sessionData.session?.user?.email;
      },
      redirect: (url) => window.location.assign(url),
    });
    if (!result.ok) setCheckoutMessage(result.message);
  }

  function escolhaDePlano() {
    return (
      <>
        <p className="text-base font-black text-slate-900">Escolha seu plano</p>
        <ul className="mt-5 space-y-4 text-left">
          {PLANOS.map((plano) => (
            <li
              key={plano.id}
              className={`relative rounded-2xl border bg-white p-4 ${plano.selo ? "border-2 border-blue-600 shadow-md shadow-blue-600/10" : "border-slate-200"}`}
            >
              {plano.selo && (
                <span className="absolute -top-3 left-4 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white">
                  ⭐ {plano.selo}
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-slate-900">{plano.nome}</p>
                  <p className="text-xs font-bold text-blue-700">{plano.chamada}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black leading-none text-slate-900">{plano.preco}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{plano.periodo}</p>
                </div>
              </div>
              {(plano.equivalenteMensal || plano.economia) && (
                <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs">
                  {plano.equivalenteMensal && <p className="font-black text-emerald-700">Sai por {plano.equivalenteMensal}</p>}
                  {plano.economia && <p className="font-semibold text-emerald-700">{plano.economia}</p>}
                </div>
              )}
              <ul className="mt-3 space-y-1.5">
                {plano.vantagens.map((vantagem) => (
                  <li key={vantagem} className="flex gap-2 text-xs font-semibold leading-snug text-slate-600">
                    <span aria-hidden="true">✅</span>
                    {vantagem}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void assinar(plano)}
                className={plano.selo ? `mt-3 ${botao} sm:w-full` : `mt-3 ${botaoSecundario} sm:w-full`}
              >
                Assinar {plano.nome}
              </button>
            </li>
          ))}
        </ul>
        {checkoutMessage && <p className="mt-3 text-amber-700">{checkoutMessage}</p>}
        <button type="button" onClick={() => setEscolhendoPlano(false)} className="mt-4 text-xs font-bold text-slate-500 underline">
          Voltar
        </button>
      </>
    );
  }

  function oportunidadeDisponivel(comLogin: boolean) {
    if (escolhendoPlano) return escolhaDePlano();
    return (
      <>
        <p className="font-black text-slate-900">Oportunidade encontrada pelo nosso radar.</p>
        <p className="mt-2 text-slate-500">O preço pode mudar a qualquer momento. Garanta seu acesso para ver os detalhes.</p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
          {comLogin && <Link href={`/login?returnTo=${encodeURIComponent(`/oferta/${offerId}`)}`} className={botaoSecundario}>Já sou membro</Link>}
          <button type="button" onClick={() => setEscolhendoPlano(true)} className={botao}>Quero ter acesso</button>
        </div>
      </>
    );
  }

  return (
    <section aria-live="polite" aria-busy={status === "loading"} className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-5 text-center text-sm font-semibold text-slate-700">
      {status === "loading" && <p>Verificando seu acesso...</p>}
      {status === "anonymous" && oportunidadeDisponivel(true)}
      {status === "inactive" && oportunidadeDisponivel(false)}
      {status === "active" && (
        <>
          <p className="font-black text-emerald-600">✓ Acesso de membro confirmado</p>
          <p className="mt-2 text-slate-500">Oferta exclusiva disponível para você.</p>
          <button
            type="button"
            onClick={comprarPassagem}
            disabled={bookingState === "loading"}
            className={`mt-4 ${botao}`}
          >
            {bookingState === "loading" ? "Abrindo oferta..." : "Comprar passagem"}
          </button>
          {bookingState === "error" && bookingMessage && <p className="mt-3 text-amber-700">{bookingMessage}</p>}
        </>
      )}
      {status === "error" && <><p>Não conseguimos verificar seu acesso agora.</p><button type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }} className={`mt-4 ${botao}`}>Tentar novamente</button></>}
    </section>
  );
}
