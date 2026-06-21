"use client";

import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyPillarLayout from "@/components/StickyPillarLayout";

const StakingFlow = dynamic(
  () => import("@/components/staking/StakingFlow"),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto w-full max-w-4xl py-20 text-center font-['PerfectDOS'] text-sm text-white/60 normal-case">
        Loading staking…
      </div>
    ),
  },
);

export default function StakePage() {
  return (
    <>
      <Header />
      <StickyPillarLayout>
        <StakingFlow />
      </StickyPillarLayout>
      <Footer />
    </>
  );
}
