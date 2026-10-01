"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLoading from "@/components/AppLoading";
import { supabase } from "@/lib/supabase";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const NAV = [
  { href: "/site", label: "Início", icon: "⌂" },
  { href: "/site/radar", label: "Radar de ofertas", icon: "📡" },
  { href: "/site/configuracoes", label: "Minha conta", icon: "⚙" },
  { href: "/site/ajuda", label: "Ajuda", icon: "❓" },
];

type Usuario = { nome: string; email: string; avatar?: string };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [checando, setChecando] = useState(true);
  const [membro, setMembro] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const [rotaDoMenu, setRotaDoMenu] = useState(pathname);
  if (rotaDoMenu !== pathname) {
    setRotaDoMenu(pathname);
    setMenuAberto(false);
  }
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handler(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const { data } = await supabase.auth.getSession();
      if (cancelado) return;
      const session = data.session;

      if (!session) {
        setUsuario(null);
        setMembro(false);
        setNaoLidas(0);
        setChecando(false);
        return;
      }

      const meta = session.user.user_metadata || {};
      setUsuario({
        nome: meta.full_name?.split(" ")[0] || meta.name?.split(" ")[0] || session.user.email?.split("@")[0] || "Viajante",
        email: session.user.email || "",
        avatar: meta.avatar_url,
      });
      setChecando(false);

      const token = session.access_token;
      void fetch("/api/membership/status", { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => { if (!cancelado) setMembro(Boolean(body?.active)); });
      void fetch("/api/notificacoes", { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => { if (!cancelado) setNaoLidas(body?.naoLidas ?? 0); });
    }

    void carregar();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void carregar());

    return () => {
      cancelado = true;
      listener.subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    if (checando || usuario) return;
    router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
  }, [checando, usuario, pathname, router]);

  async function sair() {
    await supabase.auth.signOut();
    router.push("/site");
  }

  async function baixarApp() {
    if (installEvent) {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    }
    router.push("/minha-viagem");
  }

  function ativo(href: string) {
    return href === "/site" ? pathname === "/site" : pathname.startsWith(href);
  }

  if (checando) return <AppLoading label="Verificando acesso" />;
  if (!usuario) return <AppLoading label="Redirecionando para o login" />;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 lg:flex">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          aria-label="Abrir menu"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-700"
        >
          ☰
        </button>
        <span className="text-base font-black tracking-tight text-slate-900">✈ Vaiviajar</span>
        <SininhoNotificacoes naoLidas={naoLidas} />
      </div>

      {menuAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMenuAberto(false)}>
          <aside
            className="flex h-full w-72 max-w-[80vw] flex-col bg-white px-5 py-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <SidebarConteudo nav={NAV} ativo={ativo} usuario={usuario} membro={membro} sair={sair} baixarApp={baixarApp} />
          </aside>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col">
        <SidebarConteudo nav={NAV} ativo={ativo} usuario={usuario} membro={membro} sair={sair} baixarApp={baixarApp} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="hidden items-center justify-end gap-4 border-b border-slate-200 bg-white px-8 py-4 lg:flex">
          <SininhoNotificacoes naoLidas={naoLidas} />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">
              {usuario.nome.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm leading-tight">
              <p className="font-bold text-slate-900">Olá, {usuario.nome}</p>
              {membro && <p className="text-[11px] font-bold text-amber-600">★ Membro Premium</p>}
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}

function SininhoNotificacoes({ naoLidas }: { naoLidas: number }) {
  return (
    <Link
      href="/site/notificacoes"
      aria-label={`Notificações${naoLidas ? `, ${naoLidas} não lidas` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-700 transition-colors hover:border-blue-300 lg:h-10 lg:w-10"
    >
      🔔
      {naoLidas > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-black leading-[18px] text-white">
          {naoLidas > 9 ? "9+" : naoLidas}
        </span>
      )}
    </Link>
  );
}

function SidebarConteudo({
  nav,
  ativo,
  usuario,
  membro,
  sair,
  baixarApp,
}: {
  nav: typeof NAV;
  ativo: (href: string) => boolean;
  usuario: Usuario;
  membro: boolean;
  sair: () => void;
  baixarApp: () => void;
}) {
  return (
    <>
      <Link href="/site" className="text-lg font-black tracking-tight text-slate-900">
        ✈ Vaiviajar
      </Link>

      <nav className="mt-8 flex-1 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              ativo(item.href) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="w-5 text-center text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        onClick={baixarApp}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
      >
        📲 Baixar app
      </button>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <p className="truncate text-sm font-bold text-slate-900">{usuario.nome}</p>
        <p className="truncate text-xs text-slate-500">{usuario.email}</p>
        {membro && <p className="mt-1 text-xs font-bold text-amber-600">★ Membro Premium</p>}
        <button
          type="button"
          onClick={sair}
          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-rose-200 hover:text-rose-600"
        >
          Sair da conta
        </button>
        <p className="mt-4 text-[11px] text-slate-400">Viaje mais. Viva melhor.</p>
      </div>
    </>
  );
}
