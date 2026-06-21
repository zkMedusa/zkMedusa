import { NextResponse } from "next/server";
import { fetchStakingUserPosition } from "@/lib/staking/streamflow.server";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet query parameter." },
      { status: 400 },
    );
  }

  try {
    const position = await fetchStakingUserPosition(wallet);
    if (!position) {
      return NextResponse.json(
        { error: "Staking is not configured." },
        { status: 503 },
      );
    }
    return NextResponse.json(position);
  } catch (error) {
    console.error("[staking/position]", error);
    return NextResponse.json(
      { error: "Failed to load staking position." },
      { status: 500 },
    );
  }
}
