"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { readPendingOfferPath } from "@/lib/kiwifyCheckout";
import { checkMembershipStatus, resolveCheckoutAccess, type CheckoutPhase } from "@/lib/checkoutMembership";
import { isValidReturnTo } from "@/lib/returnTo";

type Phase = "loading" | CheckoutPhase;

const botao = "mt-4 inline-flex rounded-full bg-cyan-300 px-5 py-2 font-bold text-slate-950";
const botaoSecundario = "mt-3 inline-flex rounded-full border border-white/20 px-5 py-2 font-bold text-white";

export default function CheckoutSucessoPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [attempt, setAttempt] = useState(0);
  const [pendingOfferPath] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readPendingOfferPath(window.localStorage)
  );
  const loginHref = isValidReturnTo(pendingOfferPath)
    ? `/login?returnTo=${encodeURIComponent(pendingOfferPath)}`
    : "/login";

  useEffect(() => {
    let disposed = false;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (disposed) return;
      const token = error ? undefined : data.session?.access_token;
      await resolveCheckoutAccess({
        token,
        checkOnce: checkMembershipStatus,
        onUpdate: (next) => { if (!disposed) setPhase(next); },
        isCancelled: () => disposed,
      });
    })();

    return () => { disposed = true; };
  }, [attempt]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[linear-gradient(160deg,#061b31,#020617_60%,#05192b)] px-6 pb-32 pt-[calc(env(safe-area-inset-top)+5rem)] text-white">
      <section aria-live="polite" className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.05] p-7 text-center shadow-xl shadow-black/20">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Vaiviajar</p>

        {phase === "loading" && <p className="mt-4 text-sm font-semibold">Estamos confirmando seu acesso...</p>}

        {phase === "anonymous" && (
          <>
            <p className="mt-4 text-lg font-bold">Compra concluída?</p>
            <p className="mt-2 text-sm text-white/70">Para acessar sua oferta, entre na sua conta usando o mesmo e-mail utilizado na compra.</p>
            <Link href={loginHref} className={botao}>Entrar para acessar</Link>
          </>
        )}

        {phase === "pending" && (
          <>
            <p className="mt-4 text-sm font-semibold">Estamos aguardando a confirmação do seu acesso...</p>
            <p className="mt-2 text-sm text-white/70">Assim que a Kiwify confirmar sua compra, seu acesso será liberado automaticamente.</p>
          </>
        )}

        {phase === "active" && (
          <>
            <p className="mt-4 text-lg font-bold text-emerald-300">✓ Seu acesso está liberado.</p>
            {pendingOfferPath && <Link href={pendingOfferPath} className={botao}>Ver minha oferta</Link>}
          </>
        )}

        {phase === "unresolved" && (
          <>
            <p className="mt-4 text-sm font-semibold">A confirmação ainda pode estar sendo processada.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className={botao}>Tentar novamente</button>
            {pendingOfferPath && <Link href={pendingOfferPath} className={botaoSecundario}>Voltar para a oferta</Link>}
          </>
        )}
      </section>
    </main>
  );
}
