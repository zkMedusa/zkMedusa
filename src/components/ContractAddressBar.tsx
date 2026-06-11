import React from "react";

export const PUMP_CA = "HYdWaJRTW4vVTFPjUaUV7J7JXHzxMnvogBr4ZFupump";

export default function ContractAddressBar({
  address = PUMP_CA,
}: {
  address?: string;
}) {
  return (
    <div className="bg-black w-full flex items-center justify-center py-3">
      <p className="px-4 text-center font-['PerfectDOS'] text-[10px] md:text-xs uppercase text-white/90 tracking-wide">
        <span className="text-white/60">CA:</span>{" "}
        <span className="text-white select-all">{address}</span>
      </p>
    </div>
  );
}
