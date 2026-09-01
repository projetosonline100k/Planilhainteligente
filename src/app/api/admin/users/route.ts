import { authorizeAdmin, createAdminClient } from "@/lib/adminServer";

const USERS_PER_PAGE = 1_000;

export async function GET(request: Request) {
  try {
    const authorization = await authorizeAdmin(request);
    if ("error" in authorization) {
      return Response.json({ error: authorization.error }, { status: authorization.status });
    }

    const adminClient = createAdminClient();
    const users = [] as Awaited<ReturnType<typeof adminClient.auth.admin.listUsers>> extends {
      data: { users: infer T };
    }
      ? T
      : never;

    for (let page = 1; ; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
      if (error) return Response.json({ error: error.message }, { status: 400 });

      users.push(...data.users);
      if (data.users.length < USERS_PER_PAGE) break;
    }

    return Response.json({
      total: users.length,
      users: users
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
        )
        .map((user) => ({
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at,
        })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizeAdmin(request);
    if ("error" in authorization) {
      return Response.json({ error: authorization.error }, { status: authorization.status });
    }

    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || password.length < 6) {
      return Response.json(
        { error: "Informe email e senha com pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return Response.json({ error: message }, { status: 500 });
  }
}
