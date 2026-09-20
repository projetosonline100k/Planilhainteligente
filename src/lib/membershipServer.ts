import "server-only";
import { createAdminClient } from "@/lib/adminServer";

const PAGE_SIZE = 100;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export async function isActiveMember(userId: string): Promise<boolean> {
  if (!userId) return false;
  const product = normalize(process.env.KIWIFY_PRODUCT_NAME || "Aplicativo Inteligente");
  const client = createAdminClient();

  // A comparação local preserva trim/locale e não trata %, _ como curingas SQL.
  // Paginação evita ignorar uma venda elegível além do limite padrão do Supabase.
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from("kiwify_sales")
      .select("product_name")
      .eq("auth_user_id", userId)
      .eq("access_status", "active")
      .order("order_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
      .abortSignal(AbortSignal.timeout(10_000));
    if (error || !data) throw new Error("Verificação de acesso indisponível.");
    if (data.some((sale) => normalize(sale.product_name) === product)) return true;
    if (data.length < PAGE_SIZE) return false;
  }
}
