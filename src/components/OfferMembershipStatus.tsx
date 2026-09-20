"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildKiwifyCheckoutUrl, savePendingOffer } from "@/lib/kiwifyCheckout";

type Status = "loading" | "anonymous" | "inactive" | "active" | "error";
type BookingState = "idle" | "loading" | "error";
type RevalidateState = "loading" | "available" | "expired" | "error";
type RevalidateData = {
  currentPrice: number;
  typicalPrice: number | null;
  savingsAmount: number | null;
  savingsPercentage: number | null;
};

const BOOKING_ERROR_MESSAGES: Record<number, string> = {
  401: "Sua sessão expirou. Entre novamente para continuar.",
  403: "Seu acesso não está ativo.",
  410: "Esta oportunidade não está mais disponível.",
};
const BOOKING_GENERIC_ERROR = "Não conseguimos abrir esta oferta agora. Tente novamente.";
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const botao = "mt-3 inline-flex rounded-full bg-cyan-300 px-5 py-2 font-bold text-slate-950 disabled:opacity-60";

export default function OfferMembershipStatus({ offerId }: { offerId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [bookingState, setBookingState] = useState<BookingState>("idle");
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [revalidateState, setRevalidateState] = useState<RevalidateState>("loading");
  const [revalidateData, setRevalidateData] = useState<RevalidateData | null>(null);
  const [revalidateAttempt, setRevalidateAttempt] = useState(0);

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

  useEffect(() => {
    if (status !== "anonymous" && status !== "inactive") return;
    let disposed = false;

    async function revalidate() {
      setRevalidateState("loading");
      setRevalidateData(null);
      try {
        const response = await fetch(`/api/offers/${offerId}/revalidate`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
        const body = await response.json().catch(() => null);
        if (disposed) return;
        if (body?.status === "available" && typeof body.currentPrice === "number") {
          setRevalidateData({
            currentPrice: body.currentPrice,
            typicalPrice: typeof body.typicalPrice === "number" ? body.typicalPrice : null,
            savingsAmount: typeof body.savingsAmount === "number" ? body.savingsAmount : null,
            savingsPercentage: typeof body.savingsPercentage === "number" ? body.savingsPercentage : null,
          });
          setRevalidateState("available");
        } else if (body?.status === "expired") {
          setRevalidateState("expired");
        } else {
          throw new Error("Resposta inválida");
        }
      } catch {
        if (!disposed) setRevalidateState("error");
      }
    }

    void revalidate();
    return () => { disposed = true; };
  }, [status, offerId, revalidateAttempt]);

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

  function retryRevalidate() {
    setRevalidateState("loading");
    setRevalidateAttempt((value) => value + 1);
  }

  async function quererTerAcesso() {
    const checkoutBase = process.env.NEXT_PUBLIC_KIWIFY_CHECKOUT_URL;
    if (!checkoutBase) return;

    try {
      savePendingOffer(window.localStorage, offerId);
    } catch {
      // Armazenamento indisponível (modo privado, por exemplo): seguir para o checkout mesmo assim.
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email;
    window.location.assign(buildKiwifyCheckoutUrl(checkoutBase, offerId, email));
  }

  function oportunidadeDisponivel(comLogin: boolean) {
    return (
      <>
        <p>Essa oportunidade ainda está disponível.</p>
        {revalidateData && (
          <>
            <p className="mt-2 text-white/70">Hoje essa passagem está por {moeda.format(revalidateData.currentPrice)}.</p>
            {revalidateData.typicalPrice != null && <p className="mt-1 text-white/70">Preço normal: {moeda.format(revalidateData.typicalPrice)}</p>}
            {revalidateData.savingsAmount != null && <p className="mt-1 text-white/70">Você pode economizar {moeda.format(revalidateData.savingsAmount)} nessa viagem.</p>}
          </>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {comLogin && <Link href="/login" className={botao}>Entrar</Link>}
          <button type="button" onClick={() => void quererTerAcesso()} className={botao}>Quero ter acesso</button>
        </div>
      </>
    );
  }

  function oportunidadeExpirada() {
    return (
      <>
        <p>Essa oportunidade acabou.</p>
        <p className="mt-2 text-white/70">Mas podemos avisar você quando aparecer outra promoção para este destino.</p>
        <button type="button" className={botao}>Quero receber novas oportunidades</button>
      </>
    );
  }

  function erroRevalidacao() {
    return (
      <>
        <p>Não conseguimos confirmar esta oportunidade agora.</p>
        <button type="button" onClick={retryRevalidate} className={botao}>Tentar novamente</button>
      </>
    );
  }

  return (
    <section aria-live="polite" aria-busy={status === "loading"} className="mt-7 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-4 text-center text-sm font-semibold text-cyan-100">
      {status === "loading" && <p>Verificando seu acesso...</p>}
      {status === "anonymous" && (
        <>
          {revalidateState === "loading" && <p>Confirmando se esta oportunidade ainda está disponível...</p>}
          {revalidateState === "available" && oportunidadeDisponivel(true)}
          {revalidateState === "expired" && oportunidadeExpirada()}
          {revalidateState === "error" && erroRevalidacao()}
        </>
      )}
      {status === "inactive" && (
        <>
          {revalidateState === "loading" && <p>Confirmando se esta oportunidade ainda está disponível...</p>}
          {revalidateState === "available" && oportunidadeDisponivel(false)}
          {revalidateState === "expired" && oportunidadeExpirada()}
          {revalidateState === "error" && erroRevalidacao()}
        </>
      )}
      {status === "active" && (
        <>
          <p className="text-emerald-300">✓ Acesso de membro confirmado</p>
          <p className="mt-2 text-white/70">Oferta exclusiva disponível para você.</p>
          <button
            type="button"
            onClick={comprarPassagem}
            disabled={bookingState === "loading"}
            className={botao}
          >
            {bookingState === "loading" ? "Abrindo oferta..." : "Comprar passagem"}
          </button>
          {bookingState === "error" && bookingMessage && <p className="mt-3 text-amber-200">{bookingMessage}</p>}
        </>
      )}
      {status === "error" && <><p>Não conseguimos verificar seu acesso agora.</p><button type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }} className={botao}>Tentar novamente</button></>}
    </section>
  );
}
