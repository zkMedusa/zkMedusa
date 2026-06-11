import type { CompiledCircuit } from "@noir-lang/types";

type CircuitJson =
  | CompiledCircuit
  | {
      program?: CompiledCircuit;
      bytecode?: string;
    };

export function normalizeCompiledCircuit(raw: CircuitJson): CompiledCircuit {
  if (
    "program" in raw &&
    raw.program &&
    typeof raw.program.bytecode === "string"
  ) {
    return raw.program;
  }

  if (
    typeof raw.bytecode === "string" &&
    "abi" in raw &&
    raw.abi
  ) {
    return raw as CompiledCircuit;
  }

  throw new Error(
    "Invalid compiled circuit format. Re-run `npm run compile:circuit`.",
  );
}
