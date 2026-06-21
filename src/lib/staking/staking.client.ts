import type {
  StakingGlobalStats,
  StakingUserPosition,
} from "@/lib/staking/types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
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
