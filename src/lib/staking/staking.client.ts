import type {
  StakingGlobalStats,
  StakingUserPosition,
} from "@/lib/staking/types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & {
    error?: string;
    detail?: string;
  };
  if (!response.ok) {
    const message = payload.detail
      ? `${payload.error ?? "Request failed."} (${payload.detail})`
      : payload.error ?? "Request failed.";
    throw new Error(message);
  }
  return payload;
}

export async function fetchStakingStats(): Promise<StakingGlobalStats> {
  const response = await fetch("/api/staking/stats", {
    cache: "no-store",
  });
  return readJson<StakingGlobalStats>(response);
}

export async function fetchStakingPosition(
  wallet: string,
): Promise<StakingUserPosition> {
  const response = await fetch(
    `/api/staking/position?wallet=${encodeURIComponent(wallet)}`,
    { cache: "no-store" },
  );
  return readJson<StakingUserPosition>(response);
}

/** Fire-and-forget Telegram alert after a confirmed stake (server verifies on-chain). */
export async function notifyStakeSuccess(params: {
  signature: string;
  wallet: string;
  tierDays: number;
  amount: string;
}): Promise<void> {
  try {
    const response = await fetch("/api/staking/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      console.error("[staking/notify]", payload?.error ?? response.status);
    }
  } catch (error) {
    console.error("[staking/notify]", error);
  }
}
