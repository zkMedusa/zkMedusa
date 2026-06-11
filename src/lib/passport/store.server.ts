import fs from "node:fs";
import path from "node:path";

function getDataDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "medusa-passport");
  }

  return path.join(process.cwd(), ".data");
}

const DATA_DIR = getDataDir();
const NULLIFIER_FILE = path.join(DATA_DIR, "passport-nullifiers.json");

function ensureStore(): Set<string> {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(NULLIFIER_FILE)) {
    fs.writeFileSync(NULLIFIER_FILE, JSON.stringify([]));
  }

  const nullifiers = JSON.parse(
    fs.readFileSync(NULLIFIER_FILE, "utf8"),
  ) as string[];

  return new Set(nullifiers);
}

function persistStore(nullifiers: Set<string>): void {
  fs.writeFileSync(
    NULLIFIER_FILE,
    JSON.stringify(Array.from(nullifiers), null, 2),
  );
}

export function hasNullifierBeenUsed(nullifier: string): boolean {
  return ensureStore().has(nullifier);
}

export function registerNullifier(nullifier: string): void {
  const nullifiers = ensureStore();
  nullifiers.add(nullifier);
  persistStore(nullifiers);
}
