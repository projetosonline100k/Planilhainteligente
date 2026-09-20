export type CheckoutPhase = "anonymous" | "pending" | "active" | "unresolved";

const DEFAULT_RETRY_DELAYS_MS = [3000, 6000, 10000, 15000];

export async function checkMembershipStatus(token: string): Promise<boolean> {
  try {
    const response = await fetch("/api/membership/status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => null);
    return Boolean(body && body.authenticated === true && body.active === true);
  } catch {
    return false;
  }
}

export async function resolveCheckoutAccess({
  token,
  checkOnce,
  onUpdate,
  isCancelled = () => false,
  delays = DEFAULT_RETRY_DELAYS_MS,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  token: string | null | undefined;
  checkOnce: (token: string) => Promise<boolean>;
  onUpdate: (phase: CheckoutPhase) => void;
  isCancelled?: () => boolean;
  delays?: number[];
  wait?: (ms: number) => Promise<void>;
}): Promise<void> {
  if (!token) {
    onUpdate("anonymous");
    return;
  }

  onUpdate("pending");
  if (isCancelled()) return;
  if (await checkOnce(token)) {
    if (!isCancelled()) onUpdate("active");
    return;
  }

  for (let index = 0; index < delays.length; index++) {
    await wait(delays[index]);
    if (isCancelled()) return;
    if (await checkOnce(token)) {
      onUpdate("active");
      return;
    }
    if (index === delays.length - 1) onUpdate("unresolved");
  }
}
