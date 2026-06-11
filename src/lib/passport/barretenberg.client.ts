"use client";

import { Barretenberg, BackendType } from "@aztec/bb.js";
import type { CompiledCircuit } from "@noir-lang/types";

/** Keep in sync with package.json @aztec/bb.js version. */
const BB_JS_VERSION = "5.0.0-nightly.20260522";

const MIN_SRS_SIZE = 2 ** 16;

let barretenbergPromise: Promise<Barretenberg> | null = null;
let srsReadyForBytecode: string | null = null;

async function clearStaleBarretenbergCrsCache(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const { del, get, set } = await import("idb-keyval");
  const versionKey = "medusa_bb_crs_cache_version";

  if ((await get(versionKey)) === BB_JS_VERSION) {
    return;
  }

  await Promise.all([
    del("g1Data"),
    del("g2Data"),
    del("grumpkinG1Data"),
  ]);
  await set(versionKey, BB_JS_VERSION);
}

async function clearBarretenbergCrsData(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const { del } = await import("idb-keyval");
  await Promise.all([
    del("g1Data"),
    del("g2Data"),
    del("grumpkinG1Data"),
  ]);
}

function decodeAcirBytecode(bytecode: string): Uint8Array {
  const binary = atob(bytecode);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function createBarretenbergInstance(): Promise<Barretenberg> {
  await clearStaleBarretenbergCrsCache();

  return Barretenberg.new({
    threads: 1,
    backend: BackendType.Wasm,
    memory: { initial: 2048, maximum: 65536 },
    skipSrsInit: true,
  });
}

async function initSrsForCircuit(
  bb: Barretenberg,
  circuit: CompiledCircuit,
): Promise<void> {
  const bytecode = decodeAcirBytecode(circuit.bytecode);
  const [, dyadicSize] = await bb.acirGetCircuitSizes(bytecode, false, false);
  const srsSize = Math.max(dyadicSize, MIN_SRS_SIZE);

  try {
    await bb.initSRSChonk(srsSize);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!message.includes("invalid points_buf size")) {
      throw error;
    }

    await clearBarretenbergCrsData();
    await bb.initSRSChonk(srsSize);
  }
}

export async function ensureBarretenbergForCircuit(
  circuit: CompiledCircuit,
): Promise<Barretenberg> {
  if (!barretenbergPromise) {
    barretenbergPromise = createBarretenbergInstance();
  }

  const bb = await barretenbergPromise;

  if (srsReadyForBytecode === circuit.bytecode) {
    return bb;
  }

  await initSrsForCircuit(bb, circuit);
  srsReadyForBytecode = circuit.bytecode;
  return bb;
}

export function preloadBarretenbergForCircuit(
  circuit: CompiledCircuit,
): void {
  void ensureBarretenbergForCircuit(circuit).catch(() => undefined);
}
