"use client";

import { useCallback, useState } from "react";
import { mainnet } from "wagmi/chains";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import {
  buildOwnershipMessage,
  type MedusaTokenPassport,
} from "@/lib/partner/tokenPassport";

export interface PartnerTokenFlowProps {
  partner: {
    id: string;
    name: string;
    tokenAddress: string;
    threshold: string;
    validityHours: number;
    accent: string;
    tagline: string;
    collectTelegram: boolean;
  };
}

type Result =
  | { kind: "eligible"; passport: MedusaTokenPassport }
  | { kind: "ineligible"; threshold: string }
  | { kind: "error"; message: string };

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function PartnerTokenFlow({ partner }: PartnerTokenFlowProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: switchPending } = useSwitchChain();

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [telegramUsername, setTelegramUsername] = useState("");

  const accent = partner.accent;
  const onMainnet = chainId === mainnet.id;
  const telegramReady =
    !partner.collectTelegram || telegramUsername.trim().length > 0;

  const verify = useCallback(async () => {
    if (!address || !onMainnet) {
      return;
    }
    setBusy(true);
    setResult(null);

    try {
      const nonceResponse = await fetch(
        `/api/partner/${partner.id}/token/nonce`,
      );
      if (!nonceResponse.ok) {
        throw new Error("Could not start verification. Try again.");
      }
      const { nonce, issuedAt } = (await nonceResponse.json()) as {
        nonce: string;
        issuedAt: string;
      };

      const signature = await signMessageAsync({
        message: buildOwnershipMessage(partner.name, nonce, issuedAt),
      });

      const verifyResponse = await fetch(
        `/api/partner/${partner.id}/token/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            signature,
            nonce,
            issuedAt,
            ...(partner.collectTelegram
              ? { telegramUsername: telegramUsername.trim() }
              : {}),
          }),
        },
      );

      const data = (await verifyResponse.json()) as {
        eligible: boolean;
        passport?: MedusaTokenPassport;
        threshold?: string;
        error?: string;
      };

      if (!verifyResponse.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      if (data.eligible && data.passport) {
        setResult({ kind: "eligible", passport: data.passport });
      } else {
        setResult({
          kind: "ineligible",
          threshold: data.threshold || partner.threshold,
        });
      }
    } catch (error) {
      setResult({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Verification failed.",
      });
    } finally {
      setBusy(false);
    }
  }, [
    address,
    onMainnet,
    partner.collectTelegram,
    partner.id,
    partner.name,
    partner.threshold,
    signMessageAsync,
    telegramUsername,
  ]);

  const downloadPassport = useCallback((passport: MedusaTokenPassport) => {
    const blob = new Blob([JSON.stringify(passport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${passport.partnerId}-token-passport.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="border border-white/15 bg-[#0a0a0a] p-6 md:p-8 space-y-6">
      {!isConnected ? (
        <div className="space-y-4">
          <p className="font-['PerfectDOS'] text-sm text-white/70 normal-case">
            Connect an Ethereum wallet on <span className="text-white">Ethereum
            mainnet</span> to prove your {partner.name} holding.
          </p>
          <div className="flex flex-wrap gap-3">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                onClick={() => connect({ connector, chainId: mainnet.id })}
                disabled={connectPending}
                className="border border-white/30 px-4 py-2 font-['PerfectDOS'] text-sm text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {connector.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="font-['PerfectDOS'] text-xs normal-case">
              <span className="text-white/40 uppercase text-[10px] block">
                Connected
              </span>
              <span className="text-white">
                {address ? shortAddress(address) : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                disconnect();
                setResult(null);
              }}
              className="font-['PerfectDOS'] text-[11px] text-white/50 hover:text-white normal-case underline"
            >
              Disconnect
            </button>
          </div>

          {!onMainnet && (
            <div className="border border-yellow-500/40 bg-yellow-500/5 p-4 space-y-3 font-['PerfectDOS'] text-xs text-yellow-100/90 normal-case">
              <p>
                Your wallet is not on Ethereum mainnet. The {partner.name} token
                lives on Ethereum — switch networks to continue.
              </p>
              <button
                type="button"
                onClick={() => switchChain({ chainId: mainnet.id })}
                disabled={switchPending}
                className="border border-yellow-500/50 px-3 py-2 text-yellow-100 hover:bg-yellow-500/10 disabled:opacity-50 transition-colors"
              >
                {switchPending ? "Switching…" : "Switch to Ethereum mainnet"}
              </button>
            </div>
          )}

          {partner.collectTelegram && (
            <div className="space-y-2 font-['PerfectDOS'] text-xs normal-case">
              <label
                htmlFor="telegram-username"
                className="text-white/40 uppercase text-[10px] block"
              >
                Telegram username
              </label>
              <input
                id="telegram-username"
                type="text"
                value={telegramUsername}
                onChange={(event) => setTelegramUsername(event.target.value)}
                placeholder="@yourusername"
                autoComplete="off"
                className="w-full bg-[#0d0d0d] border border-white/15 px-3 py-2 text-white placeholder:text-white/30"
              />
              <p className="text-white/50 text-[11px] leading-relaxed">
                Linked to your passport so {partner.name} can grant access without
                seeing your wallet or balance.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={verify}
            disabled={busy || !onMainnet || !telegramReady}
            className="w-full border px-4 py-3 font-['PerfectDOS'] text-sm uppercase tracking-wide disabled:opacity-50 transition-colors"
            style={{ borderColor: accent, color: accent }}
          >
            {busy ? "Verifying…" : "Verify holding & mint passport"}
          </button>

          {result?.kind === "eligible" && (
            <div className="border border-white/10 p-4 space-y-3 font-['PerfectDOS'] text-xs normal-case">
              <p
                className="uppercase text-[11px] tracking-wide"
                style={{ color: accent }}
              >
                Eligible — passport issued
              </p>
              <p className="text-white/70">
                Holds ≥ {result.passport.threshold} {partner.name}. Valid for{" "}
                {partner.validityHours}h (until{" "}
                {new Date(result.passport.expiresAt).toLocaleString()}).
                {result.passport.telegramUsername && (
                  <>
                    {" "}
                    Linked Telegram: @{result.passport.telegramUsername}
                  </>
                )}{" "}
                Medusa auto-refreshes it daily while you keep holding.
              </p>
              <button
                type="button"
                onClick={() => downloadPassport(result.passport)}
                className="border border-white/30 px-3 py-2 text-white hover:bg-white/10 transition-colors"
              >
                Download passport JSON
              </button>
            </div>
          )}

          {result?.kind === "ineligible" && (
            <div className="border border-red-500/40 p-4 font-['PerfectDOS'] text-xs text-red-300 normal-case">
              This wallet holds fewer than {result.threshold} {partner.name}{" "}
              tokens, so no passport was issued.
            </div>
          )}

          {result?.kind === "error" && (
            <div className="border border-red-500/40 p-4 font-['PerfectDOS'] text-xs text-red-300 normal-case">
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
