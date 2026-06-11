import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "public", "wasm");

const copies = [
  ["node_modules/@noir-lang/acvm_js/web/acvm_js_bg.wasm", "acvm_js_bg.wasm"],
  [
    "node_modules/@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm",
    "noirc_abi_wasm_bg.wasm",
  ],
];

fs.mkdirSync(dest, { recursive: true });

for (const [relativeSource, filename] of copies) {
  const source = path.join(root, relativeSource);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing Noir WASM file: ${relativeSource}`);
  }

  fs.copyFileSync(source, path.join(dest, filename));
  console.log(`Copied ${filename} to public/wasm/`);
}
