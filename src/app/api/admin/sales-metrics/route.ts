import { authorizeAdmin, createAdminClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authorization = await authorizeAdmin(request);
    if ("error" in authorization) return Response.json({ error: authorization.error }, { status: authorization.status });

    const { data, error } = await createAdminClient()
      .from("kiwify_sales")
      .select("access_status, amount_cents, customer_email, purchased_at");
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const sales = data ?? [];
    const activeSales = sales.filter((sale) => sale.access_status === "active");
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1_000;
    const newCustomers = new Set(
      activeSales
        .filter((sale) => sale.purchased_at && new Date(sale.purchased_at).getTime() >= thirtyDaysAgo)
        .map((sale) => sale.customer_email)
    );

    return Response.json({
      approvedSales: activeSales.length,
      activeCustomers: new Set(activeSales.map((sale) => sale.customer_email)).size,
      revenueCents: activeSales.reduce((total, sale) => total + (sale.amount_cents ?? 0), 0),
      newCustomers30Days: newCustomers.size,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
