"use client";

import { Barretenberg, BackendType } from "@aztec/bb.js";
import type { CompiledCircuit } from "@noir-lang/types";
import { normalizeAcirBytecode } from "./acir";
import { computeSrsSize, isCrsBufferError } from "./barretenberg.shared";

/** Bump when CRS sizing logic changes to invalidate IndexedDB cache. */
const BB_JS_VERSION = "5.0.0-nightly.20260522-crs17";

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
  const bytecode = normalizeAcirBytecode(circuit.bytecode);
  const [, dyadicSize] = await bb.acirGetCircuitSizes(bytecode, false, false);
  const srsSize = computeSrsSize(dyadicSize);

  try {
    await bb.initSRSChonk(srsSize);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!isCrsBufferError(message)) {
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
