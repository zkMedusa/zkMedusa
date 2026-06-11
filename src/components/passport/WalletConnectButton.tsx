"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

function shortenAddress(address: string): string {
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

export default function WalletConnectButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const baseClassName =
    "w-full md:w-auto px-6 py-3 border border-white font-['PerfectDOS'] uppercase text-sm transition-colors";

  if (connecting) {
    return (
      <button
        type="button"
        disabled
        className={`${baseClassName} opacity-50 cursor-wait`}
      >
        Connecting...
      </button>
    );
  }

  if (publicKey) {
    return (
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <div
          className={`${baseClassName} bg-white/5 text-white normal-case flex items-center justify-center gap-2 cursor-default`}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
          {shortenAddress(publicKey.toBase58())}
        </div>
        <button
          type="button"
          onClick={() => disconnect()}
          className={`${baseClassName} text-white/60 border-white/30 hover:bg-white hover:text-black hover:border-white`}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className={`${baseClassName} text-white hover:bg-white hover:text-black`}
    >
      Connect wallet
    </button>
  );
}
