import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnv();

const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
const dryRun = !process.argv.includes("--live");
const force = process.argv.includes("--force");
const params = new URLSearchParams({
  dryRun: dryRun ? "1" : "0",
  ...(force ? { force: "1" } : {}),
});

const headers = {};
const secret = process.env.CRON_SECRET?.trim();
if (secret) {
  headers.Authorization = `Bearer ${secret}`;
}

const response = await fetch(`${baseUrl}/api/staking/cron/buyback?${params}`, {
  headers,
});

const body = await response.text();
console.log(`Status: ${response.status}`);
console.log(body);

if (!response.ok) {
  process.exitCode = 1;
}
