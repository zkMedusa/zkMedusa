import { NextResponse } from "next/server";
import { fetchStakingGlobalStats } from "@/lib/staking/streamflow.server";

export async function GET() {
  try {
    const stats = await fetchStakingGlobalStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("[staking/stats]", error);
    return NextResponse.json(
      { error: "Failed to load staking stats." },
      { status: 500 },
    );
  }
}
