"use client";

import dynamic from "next/dynamic";

const SolanaProvider = dynamic(() => import("@/providers/SolanaProvider"), {
  ssr: false,
});

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SolanaProvider>{children}</SolanaProvider>;
}
