"use client";

import dynamic from "next/dynamic";
import { ToastProvider } from "@/components/ui/Toast";

const SolanaProvider = dynamic(() => import("@/providers/SolanaProvider"), {
  ssr: false,
});

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <SolanaProvider>{children}</SolanaProvider>
    </ToastProvider>
  );
}
