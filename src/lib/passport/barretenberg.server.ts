import { Barretenberg } from "@aztec/bb.js";
import type { CompiledCircuit } from "@noir-lang/types";
import { normalizeAcirBytecode } from "./acir";
import { computeSrsSize } from "./barretenberg.shared";

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
  await bb.initSRSChonk(computeSrsSize(dyadicSize));
  srsReadyForBytecode = circuit.bytecode;
  return bb;
}
