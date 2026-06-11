import { Barretenberg, BackendType } from "@aztec/bb.js";
import type { CompiledCircuit } from "@noir-lang/types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeAcirBytecode } from "./acir";
import { computeSrsSize } from "./barretenberg.shared";

let barretenbergPromise: Promise<Barretenberg> | null = null;
let srsReadyForBytecode: string | null = null;

function resolveBarretenbergCrsPath(): string {
  if (process.env.CRS_PATH) {
    return process.env.CRS_PATH;
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "medusa-passport", "bb-crs");
  }

  return path.join(os.homedir(), ".bb-crs");
}

function resolveBarretenbergWasmPath(): string {
  const candidates = [
    process.env.BB_WASM_PATH,
    path.join(
      process.cwd(),
      "src",
      "lib",
      "passport",
      "wasm",
      "barretenberg-threads.wasm.gz",
    ),
    path.join(
      process.cwd(),
      "node_modules",
      "@aztec",
      "bb.js",
      "dest",
      "node",
      "barretenberg_wasm",
      "barretenberg-threads.wasm.gz",
    ),
    path.join(
      process.cwd(),
      "node_modules",
      "@aztec",
      "bb.js",
      "dest",
      "node-cjs",
      "barretenberg_wasm",
      "barretenberg-threads.wasm.gz",
    ),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Barretenberg WASM is missing. Run `npm run copy:bb-wasm` or redeploy so postinstall copies it.",
  );
}

export async function ensureServerBarretenberg(
  circuit: CompiledCircuit,
): Promise<Barretenberg> {
  if (!barretenbergPromise) {
    const crsPath = resolveBarretenbergCrsPath();
    fs.mkdirSync(crsPath, { recursive: true });

    barretenbergPromise = Barretenberg.new({
      backend: BackendType.Wasm,
      threads: 1,
      skipSrsInit: true,
      wasmPath: resolveBarretenbergWasmPath(),
      crsPath,
    });
  }

  const bb = await barretenbergPromise;

  if (srsReadyForBytecode === circuit.bytecode) {
    return bb;
  }

  const bytecode = normalizeAcirBytecode(circuit.bytecode);
  const [, dyadicSize] = await bb.acirGetCircuitSizes(bytecode, false, false);
  await bb.initSRSChonk(computeSrsSize(dyadicSize));
  srsReadyForBytecode = circuit.bytecode;
  return bb;
}
