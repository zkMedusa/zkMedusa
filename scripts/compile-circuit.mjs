import { compile, createFileManager } from "@noir-lang/noir_wasm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const circuitDir = path.resolve(projectRoot, "circuits", "passport");
const outputDir = path.join(projectRoot, "public", "circuits");
const outputPath = path.join(outputDir, "passport.json");

function toNoirProjectPath(dir) {
  const resolved = path.resolve(dir);
  if (process.platform === "win32") {
    return resolved.replace(/\\/g, "/");
  }
  return resolved;
}

async function main() {
  if (process.env.SKIP_CIRCUIT_COMPILE === "true") {
    if (!fs.existsSync(outputPath)) {
      throw new Error(
        "SKIP_CIRCUIT_COMPILE is set but public/circuits/passport.json is missing.",
      );
    }
    console.log(`Skipping compile; using existing ${outputPath}`);
    return;
  }

  console.log("Compiling Medusa passport circuit...");
  console.log(`Node ${process.version} on ${process.platform}`);
  const noirProjectPath = toNoirProjectPath(circuitDir);
  console.log(`Circuit source: ${noirProjectPath}`);

  const fm = createFileManager(noirProjectPath);
  const compiled = await compile(fm);
  const artifact = compiled.program ?? compiled;

  if (!artifact?.bytecode) {
    throw new Error("Compiler did not produce circuit bytecode.");
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
  console.log(`Circuit written to ${outputPath}`);
}

main().catch((error) => {
  console.error("Circuit compilation failed:");
  if (error instanceof Error) {
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(error);
  }
  process.exit(1);
});
