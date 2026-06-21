/**
 * Local-only: Jupiter swap + Streamflow top-up from existing wallet SOL.
 * Skips Pump.fun dev-fee claim and passport USDC buyback.
 *
 * Usage:
 *   npm run buyback:swap-only          # dry-run quote + simulated tier split
 *   npm run buyback:swap-only:live     # live swap + distribute (forces interval bypass)
 *
 * Requires .env with MEDUSA_BUYBACK_AUTHORITY_SECRET_KEY and MEDUSA_BUYBACK_RPC_URL
 * (or NEXT_PUBLIC_SOLANA_RPC_URL / QuikNode — not OOBE).
 */
import fs from "node:fs";
import path from "node:path";
import { runBuyback } from "../src/lib/staking/buyback.server";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) {
      continue;
    }
    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnv();

async function main() {
  const dryRun = !process.argv.includes("--live");
  const force = !process.argv.includes("--no-force");

  console.log(
    dryRun
      ? "Dry run — swap + distribute preview (no Pump claim, no USDC path)."
      : "LIVE swap-only buyback — Pump claim and USDC buyback are skipped.",
  );

  const result = await runBuyback({
    dryRun,
    force,
    skipPumpClaim: true,
    skipPassportUsdc: true,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok && !result.skipped) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
