"use client";

import dynamic from "next/dynamic";
import type { PartnerTokenFlowProps } from "./PartnerTokenFlow";

// ssr:false keeps wagmi/viem out of the server bundle and off every other page.
const EvmProvider = dynamic(() => import("@/providers/EvmProvider"), {
  ssr: false,
});
const PartnerTokenFlow = dynamic(() => import("./PartnerTokenFlow"), {
  ssr: false,
  loading: () => (
    <div className="border border-white/15 bg-[#0a0a0a] p-6 font-['PerfectDOS'] text-sm text-white/50 normal-case">
      Loading wallet…
    </div>
  ),
});

export default function PartnerTokenSection({
  partner,
}: PartnerTokenFlowProps) {
  return (
    <EvmProvider>
      <PartnerTokenFlow partner={partner} />
    </EvmProvider>
  );
}
