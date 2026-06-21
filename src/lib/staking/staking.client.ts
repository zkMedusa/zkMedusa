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
