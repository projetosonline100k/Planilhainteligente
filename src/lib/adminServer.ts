import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
}

export function createAdminClient() {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function authorizeAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return { error: "Sessao nao encontrada.", status: 401 } as const;

  const authClient = createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !isAdminEmail(data.user?.email)) {
    return { error: "Acesso negado.", status: 403 } as const;
  }

  return { user: data.user } as const;
}
