import { Barretenberg } from "@aztec/bb.js";
import type { CompiledCircuit } from "@noir-lang/types";
import { normalizeAcirBytecode } from "./acir";

const MIN_SRS_SIZE = 2 ** 16;

let barretenbergPromise: Promise<Barretenberg> | null = null;
let srsReadyForBytecode: string | null = null;

export async function ensureServerBarretenberg(
  circuit: CompiledCircuit,
): Promise<Barretenberg> {
  if (!barretenbergPromise) {
    barretenbergPromise = Barretenberg.new({
      threads: 1,
      skipSrsInit: true,
    });
  }

  const bb = await barretenbergPromise;

  if (srsReadyForBytecode === circuit.bytecode) {
    return bb;
  }

  const bytecode = normalizeAcirBytecode(circuit.bytecode);
  const [, dyadicSize] = await bb.acirGetCircuitSizes(bytecode, false, false);
  await bb.initSRSChonk(Math.max(dyadicSize, MIN_SRS_SIZE));
  srsReadyForBytecode = circuit.bytecode;
  return bb;
}
