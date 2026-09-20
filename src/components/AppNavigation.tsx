"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const menu = [["✈️", "Passagens", "/passagens"], ["▶", "Cabine", "/cabine"], ["◔", "Orçamento", "/minha-viagem"], ["🔔", "Alertas", "/alertas"], ["⚙", "Configurações", "/configuracoes"], ["👤", "Perfil", "/perfil"]];
const inferior = [["⌂", "Home", "/home"], ["🧭", "Roteiro", "/roteiro"], ["●", "Destinos", "/destinos"]];

export default function AppNavigation() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [usuario, setUsuario] = useState<{ nome: string; avatar?: string } | null>(null);
  const inicio = useRef(0);
  const esconder = ["/", "/login", "/cadastro", "/definir-senha"].includes(pathname) || pathname.startsWith("/admin");

  useEffect(() => { void supabase.auth.getSession().then(({ data }) => { const user = data.session?.user; if (!user) return; const meta = user.user_metadata || {}; setUsuario({ nome: meta.full_name || meta.name || user.email?.split("@")[0] || "Viajante", avatar: meta.avatar_url }); }); }, []);
  useEffect(() => { if (esconder) return; const down = (event: PointerEvent) => { inicio.current = event.clientX < 28 ? event.clientX : 0; }; const up = (event: PointerEvent) => { if (inicio.current && event.clientX - inicio.current > 65) setAberto(true); inicio.current = 0; }; window.addEventListener("pointerdown", down); window.addEventListener("pointerup", up); return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); }; }, [esconder]);
  useEffect(() => { document.body.style.overflow = aberto ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [aberto]);
  if (esconder || !usuario) return null;

  return <>
    <button type="button" onClick={() => setAberto((valor) => !valor)} aria-label="Abrir menu" aria-expanded={aberto} className="fixed left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[62] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-slate-950/90 text-xl text-white shadow-xl backdrop-blur">☰</button>
    {aberto && <div className="fixed inset-0 z-[60] bg-black/65" onPointerDown={(event) => { inicio.current = event.clientX; }} onPointerUp={(event) => { if (inicio.current - event.clientX > 55) setAberto(false); }} onClick={(event) => { if (event.target === event.currentTarget) setAberto(false); }}>
      <aside className="flex h-full w-[78%] max-w-xs flex-col border-r border-cyan-300/15 bg-[linear-gradient(180deg,#06233b,#020617)] px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+5rem)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          {usuario.avatar ? <div role="img" aria-label="Avatar do usuário" className="h-12 w-12 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${usuario.avatar})` }} /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-300/15 text-2xl">✈️</div>}
          <div className="min-w-0"><p className="truncate font-black text-white">{usuario.nome}</p><p className="text-xs text-white/50">Viajando e colecionando histórias</p></div>
        </div>
        <nav className="mt-5 space-y-1">{menu.map(([icone, label, href]) => <Link key={href} href={href} onClick={() => setAberto(false)} className={`flex items-center gap-4 rounded-xl px-3 py-3.5 text-sm font-semibold transition ${pathname === href ? "bg-cyan-300/12 text-cyan-300" : "text-white/75 hover:bg-white/[0.06]"}`}><span className="w-6 text-center text-xl">{icone}</span>{label}</Link>)}</nav>
        <div className="mt-auto border-t border-white/10 pt-5"><p className="font-black text-white">Vaiviajar</p><p className="mt-1 text-xs text-cyan-200/60">Viaje mais. Viva melhor.</p></div>
      </aside>
    </div>}
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full border-t border-white/10 bg-[#020617]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-16px_40px_rgba(0,0,0,.3)] backdrop-blur sm:max-w-sm"><div className="grid grid-cols-3 gap-2">{inferior.map(([icone, label, href]) => { const ativo = pathname === href || (href === "/destinos" && pathname === "/diagnostico"); return <Link key={href} href={href} className={`flex flex-col items-center gap-1 text-xs font-bold ${ativo ? "text-cyan-300" : "text-white/45"}`}><span className="text-2xl leading-none">{icone}</span>{label}</Link>; })}</div></nav>
  </>;
}
