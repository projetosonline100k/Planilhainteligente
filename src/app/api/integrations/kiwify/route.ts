import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

type KiwifyPayload = {
  order_id?: string;
  order_status?: string;
  webhook_event_type?: string;
  created_at?: string;
  approved_date?: string;
  Product?: { product_id?: string; product_name?: string };
  Customer?: { email?: string; full_name?: string };
  Commissions?: { charge_amount?: number; product_base_price_currency?: string };
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://planilhainteligente.vercel.app";
const PRODUCT_NAME = process.env.KIWIFY_PRODUCT_NAME || "Aplicativo Inteligente";

function sameSecret(received: string | null, expected: string): boolean {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function normalize(value?: string): string {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

function getPayload(body: unknown): KiwifyPayload {
  if (typeof body !== "object" || body === null) return {};
  const input = body as { body?: KiwifyPayload } & KiwifyPayload;
  return input.body?.order_id ? input.body : input;
}

async function findUserByEmail(email: string) {
  const admin = createAdminClient();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1_000 });
    if (error) throw error;
    const user = data.users.find((item) => normalize(item.email) === email);
    if (user || data.users.length < 1_000) return user ?? null;
  }
}

export async function POST(request: Request) {
  try {
    const secret = process.env.KIWIFY_INTEGRATION_SECRET;
    if (!secret) return Response.json({ error: "Integracao Kiwify nao configurada." }, { status: 503 });
    if (!sameSecret(request.headers.get("x-kiwify-integration-secret"), secret)) {
      return Response.json({ error: "Assinatura da integracao invalida." }, { status: 401 });
    }

    const payload = getPayload(await request.json());
    const orderId = payload.order_id?.trim();
    const eventType = payload.webhook_event_type?.trim().toLowerCase();
    const email = normalize(payload.Customer?.email);
    const productName = payload.Product?.product_name?.trim();
    if (!orderId || !eventType || !email || !productName) {
      return Response.json({ error: "Evento Kiwify incompleto." }, { status: 400 });
    }
    if (normalize(productName) !== normalize(PRODUCT_NAME)) {
      return Response.json({ received: true, ignored: "Produto nao elegivel." }, { status: 202 });
    }

    const isApproved = eventType === "order_approved" || payload.order_status === "paid";
    const isBlocked = ["order_refunded", "order_chargeback", "order_canceled", "order_cancelled"].includes(eventType);
    if (!isApproved && !isBlocked) return Response.json({ received: true, ignored: "Evento nao tratado." }, { status: 202 });

    const admin = createAdminClient();
    const { error: eventError } = await admin.from("kiwify_webhook_events").insert({ order_id: orderId, event_type: eventType });
    if (eventError?.code === "23505") return Response.json({ received: true, duplicate: true });
    if (eventError) throw eventError;

    let user = await findUserByEmail(email);
    if (isApproved) {
      if (user) {
        const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "none" });
        if (error) throw error;
      } else {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: new URL("/definir-senha", APP_URL).toString(),
          data: { full_name: payload.Customer?.full_name?.trim() || undefined },
        });
        if (error) throw error;
        user = data.user;
      }
    } else if (user) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
      if (error) throw error;
    }

    const { error: saleError } = await admin.from("kiwify_sales").upsert(
      {
        order_id: orderId,
        customer_email: email,
        customer_name: payload.Customer?.full_name?.trim() || null,
        product_id: payload.Product?.product_id?.trim() || null,
        product_name: productName,
        event_type: eventType,
        order_status: payload.order_status?.trim() || eventType,
        access_status: isApproved ? "active" : "blocked",
        amount_cents: payload.Commissions?.charge_amount ?? null,
        currency: payload.Commissions?.product_base_price_currency?.trim() || "BRL",
        auth_user_id: user?.id ?? null,
        purchased_at: payload.approved_date || payload.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id" }
    );
    if (saleError) throw saleError;

    return Response.json({ received: true, access: isApproved ? "active" : "blocked" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar evento Kiwify.";
    return Response.json({ error: message }, { status: 500 });
  }
}
