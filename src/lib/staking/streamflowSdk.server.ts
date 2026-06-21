import type { SolanaStakingClient } from "@streamflow/staking";
import { getSolanaNetwork, getSolanaRpcUrl } from "@/lib/passport/config";

type StakingSdkModule = typeof import("@streamflow/staking");

let stakingSdkModule: StakingSdkModule | null = null;
let stakingClient: SolanaStakingClient | null = null;
let stakingClientPromise: Promise<SolanaStakingClient> | null = null;

function getStakingRpcUrl(): string {
  return (
    process.env.MEDUSA_STAKING_RPC_URL?.trim() ||
    process.env.MEDUSA_BADGE_RPC_URL?.trim() ||
    getSolanaRpcUrl()
  );
}

export async function loadStakingSdk(): Promise<StakingSdkModule> {
  if (!stakingSdkModule) {
    try {
      stakingSdkModule = await import("@streamflow/staking");
    } catch (error) {
      throw new Error(
        `Failed to load @streamflow/staking: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return stakingSdkModule;
}

export async function getStreamflowStakingClient(): Promise<SolanaStakingClient> {
  if (stakingClient) {
    return stakingClient;
  }

  if (!stakingClientPromise) {
    stakingClientPromise = (async () => {
      const staking = await loadStakingSdk();
      const { ICluster } = await import("@streamflow/common");
      const cluster =
        getSolanaNetwork() === "mainnet-beta"
          ? ICluster.Mainnet
          : ICluster.Devnet;

      stakingClient = new staking.SolanaStakingClient({
        clusterUrl: getStakingRpcUrl(),
        cluster,
      });
      return stakingClient;
    })();
  }

  return stakingClientPromise;
}
