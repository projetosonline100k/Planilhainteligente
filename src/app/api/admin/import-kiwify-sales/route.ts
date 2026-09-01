import { authorizeAdmin, createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KIWIFY_API_URL = "https://public-api.kiwify.com/v1";
const PRODUCT_NAME = process.env.KIWIFY_PRODUCT_NAME || "Aplicativo Inteligente";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://planilhainteligente.vercel.app";
const PAGE_SIZE = 100;
const IMPORT_START = new Date("2020-01-01T00:00:00.000Z");

type KiwifySale = {
  id?: string;
  status?: string;
  created_at?: string;
  approved_date?: string;
  updated_at?: string;
  product?: { id?: string; name?: string };
  customer?: { email?: string; name?: string };
  payment?: { charge_amount?: number; charge_currency?: string };
  net_amount?: number;
  currency?: string;
};

type KiwifySalesResponse = {
  data?: KiwifySale[];
};

type AccessStatus = "active" | "blocked" | "inactive";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variavel ${name} nao configurada.`);
  return value;
}

function normalize(value?: string | null): string {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function sameProduct(productName?: string): boolean {
  return normalize(productName) === normalize(PRODUCT_NAME);
}

function accessFromStatus(status?: string): AccessStatus {
  const value = normalize(status);
  if (value === "paid" || value === "approved") return "active";
  if (value === "refunded" || value === "chargedback") return "blocked";
  return "inactive";
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function getAccessToken(): Promise<string> {
  const response = await fetch(`${KIWIFY_API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getEnv("KIWIFY_CLIENT_ID"),
      client_secret: getEnv("KIWIFY_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Nao foi possivel autenticar na API da Kiwify.");
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("A Kiwify nao retornou um token de acesso.");
  return body.access_token;
}

async function listSales(token: string, startDate: Date, endDate: Date, page: number): Promise<KiwifySale[]> {
  const params = new URLSearchParams({
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    page_size: String(PAGE_SIZE),
    page_number: String(page),
  });
  const response = await fetch(`${KIWIFY_API_URL}/sales?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-kiwify-account-id": getEnv("KIWIFY_ACCOUNT_ID"),
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Nao foi possivel consultar as vendas na Kiwify.");
  const body = (await response.json()) as KiwifySalesResponse;
  return body.data ?? [];
}

async function getUsersByEmail() {
  const admin = createAdminClient();
  const users = new Map<string, { id: string }>();

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1_000 });
    if (error) throw error;
    for (const user of data.users) {
      const email = normalize(user.email);
      if (email) users.set(email, { id: user.id });
    }
    if (data.users.length < 1_000) return users;
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizeAdmin(request);
    if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

    const token = await getAccessToken();
    const admin = createAdminClient();
    const usersByEmail = await getUsersByEmail();
    const now = new Date();
    let periodStart = IMPORT_START;
    let imported = 0;
    let activated = 0;
    let blocked = 0;
    let ignored = 0;

    while (periodStart <= now) {
      const periodEnd = new Date(Math.min(addDays(periodStart, 90).getTime() - 1, now.getTime()));

      for (let page = 1; ; page += 1) {
        const sales = await listSales(token, periodStart, periodEnd, page);
        if (sales.length === 0) break;

        const records: Array<Record<string, unknown>> = [];
        for (const sale of sales) {
          const orderId = sale.id?.trim();
          const email = normalize(sale.customer?.email);
          const productName = sale.product?.name?.trim();
          if (!orderId || !email || !productName || !sameProduct(productName)) {
            ignored += 1;
            continue;
          }

          const accessStatus = accessFromStatus(sale.status);
          let user = usersByEmail.get(email);
          if (accessStatus === "active") {
            if (user) {
              const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "none" });
              if (error) throw error;
            } else {
              const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
                redirectTo: new URL("/definir-senha", APP_URL).toString(),
                data: { full_name: sale.customer?.name?.trim() || undefined },
              });
              if (error) throw error;
              if (data.user) {
                user = { id: data.user.id };
                usersByEmail.set(email, user);
              }
            }
            activated += 1;
          } else if (accessStatus === "blocked" && user) {
            const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
            if (error) throw error;
            blocked += 1;
          }

          records.push({
            order_id: orderId,
            customer_email: email,
            customer_name: sale.customer?.name?.trim() || null,
            product_id: sale.product?.id?.trim() || null,
            product_name: productName,
            event_type: "historical_import",
            order_status: sale.status?.trim() || "unknown",
            access_status: accessStatus,
            amount_cents: sale.payment?.charge_amount ?? sale.net_amount ?? null,
            currency: sale.payment?.charge_currency?.trim() || sale.currency?.trim() || "BRL",
            auth_user_id: user?.id ?? null,
            purchased_at: sale.approved_date || sale.created_at || sale.updated_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (records.length > 0) {
          const { error } = await admin.from("kiwify_sales").upsert(records, { onConflict: "order_id" });
          if (error) throw error;
          imported += records.length;
        }
        if (sales.length < PAGE_SIZE) break;
      }

      periodStart = addDays(periodStart, 90);
    }

    return Response.json({ imported, activated, blocked, ignored });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro inesperado ao importar as vendas." },
      { status: 500 }
    );
  }
}
