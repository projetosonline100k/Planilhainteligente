import { supabase } from "@/lib/supabase";

export async function adminApi<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const response = await fetch(caminho, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível completar a ação.");
  return body;
}

export function formatarDataHora(data?: string | null): string {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
}

export function formatarTelefone(telefone: string): string {
  const numero = telefone.replace(/\D/g, "");
  if (numero.length === 13 && numero.startsWith("55")) {
    return `+55 (${numero.slice(2, 4)}) ${numero.slice(4, 9)}-${numero.slice(9)}`;
  }
  return telefone;
}

export function moeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
