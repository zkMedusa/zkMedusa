"use client";

import { useState } from "react";
import { http, createConfig, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Scoped to the partner page only. This module is dynamically imported with
// `ssr: false`, so wagmi/viem never load on the core Solana passport pages.
function buildConfig() {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
  const rpc = process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim();

  const connectors = [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "Medusa" }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ];

  return createConfig({
    chains: [mainnet],
    // Only Ethereum mainnet — DeepBot token is an ERC-20 on ETH.
    multiInjectedProviderDiscovery: false,
    connectors,
    transports: {
      [mainnet.id]: http(rpc || undefined),
    },
  });
}

export default function EvmProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [config] = useState(buildConfig);
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
