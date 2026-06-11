import { compile, createFileManager } from "@noir-lang/noir_wasm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const circuitDir = path.resolve(projectRoot, "circuits", "passport");
const outputDir = path.join(projectRoot, "public", "circuits");

function toNoirProjectPath(dir) {
  const resolved = path.resolve(dir);
  if (process.platform === "win32") {
    return resolved.replace(/\\/g, "/");
  }
  return resolved;
}

async function main() {
  console.log("Compiling Medusa passport circuit...");
  const noirProjectPath = toNoirProjectPath(circuitDir);
  console.log(`Circuit source: ${noirProjectPath}`);

  const fm = createFileManager(noirProjectPath);
  const compiled = await compile(fm);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "passport.json");
  fs.writeFileSync(outputPath, JSON.stringify(compiled, null, 2));
  console.log(`Circuit written to ${outputPath}`);
}

main().catch((error) => {
  console.error("Circuit compilation failed:", error);
  process.exit(1);
});
