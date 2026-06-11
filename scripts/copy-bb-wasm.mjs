import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "src", "lib", "passport", "wasm");
const filename = "barretenberg-threads.wasm.gz";

const sources = [
  path.join(
    root,
    "node_modules",
    "@aztec",
    "bb.js",
    "dest",
    "node",
    "barretenberg_wasm",
    filename,
  ),
  path.join(
    root,
    "node_modules",
    "@aztec",
    "bb.js",
    "dest",
    "node-cjs",
    "barretenberg_wasm",
    filename,
  ),
];

const source = sources.find((candidate) => fs.existsSync(candidate));

if (!source) {
  throw new Error(
    `Missing Barretenberg WASM in @aztec/bb.js. Run npm install and ensure @aztec/bb.js is installed.`,
  );
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(source, path.join(destDir, filename));
console.log(`Copied ${filename} to src/lib/passport/wasm/`);
