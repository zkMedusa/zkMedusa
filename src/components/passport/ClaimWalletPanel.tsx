"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { readJsonResponse } from "@/lib/passport/http.client";
import { formatPassportId } from "@/lib/passport/format";
import {
  downloadClaimWalletBackup,
  generateClaimWalletKeypair,
  importClaimWalletBackup,
  listClaimWallets,
  markClaimWalletRegistered,
  parseClaimWalletBackup,
  saveClaimWallet,
  type ClaimWalletRecord,
} from "@/lib/passport/claimWallet.client";
import type { MedusaPassport } from "@/lib/passport/types";

interface ClaimWalletPanelProps {
  passport: MedusaPassport | null;
  onPassportLoad?: (passport: MedusaPassport) => void;
}

const CAMPAIGN_ID_HELP =
  "Partners running a presale or allowlist with Medusa give you a campaign ID (for example my-presale-q3). Paste the ID they share with you — it links your claim wallet to their whitelist. Do not guess an ID unless you are testing on Medusa's default campaign.";

function CampaignIdField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2">
        <label
          htmlFor="campaign-id"
          className="font-['PerfectDOS'] text-[10px] uppercase text-white/40"
        >
          Campaign ID
        </label>
        <span className="relative">
          <button
            type="button"
            onClick={() => setShowHelp((current) => !current)}
            className="h-4 w-4 border border-white/30 font-['PerfectDOS'] text-[10px] leading-none text-white/60 hover:border-white hover:text-white"
            aria-label="What is a campaign ID?"
            aria-expanded={showHelp}
          >
            ?
          </button>
          {showHelp && (
            <p
              role="tooltip"
              className="absolute left-0 top-full z-20 mt-2 w-72 border border-white/20 bg-black p-3 font-['PerfectDOS'] text-[11px] normal-case leading-relaxed text-white/80 shadow-lg"
            >
              {CAMPAIGN_ID_HELP}
            </p>
          )}
        </span>
      </div>
      <input
        id="campaign-id"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-black border border-white/20 px-3 py-2 font-mono text-xs text-white"
      />
    </div>
  );
}

function PanelButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const base =
    "px-4 py-2 border font-['PerfectDOS'] uppercase text-xs transition-colors disabled:opacity-40";
  const styles =
    variant === "primary"
      ? `${base} border-white hover:bg-white hover:text-black disabled:hover:bg-transparent disabled:hover:text-white`
      : `${base} border-white/30 text-white/80 hover:border-white hover:text-white`;

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}

function parsePassportInput(raw: string): MedusaPassport {
  const parsed = JSON.parse(raw) as MedusaPassport;

  if (parsed.type !== "medusa_passport_v1" || !parsed.nullifier) {
    throw new Error("Invalid Medusa passport JSON.");
  }

  return parsed;
}

export default function ClaimWalletPanel({
  passport,
  onPassportLoad,
}: ClaimWalletPanelProps) {
  const [activePassport, setActivePassport] = useState<MedusaPassport | null>(
    passport,
  );
  const [importJson, setImportJson] = useState("");
  const [backupImportJson, setBackupImportJson] = useState("");
  const [campaignId, setCampaignId] = useState("medusa-claim");
  const [claimWallets, setClaimWallets] = useState<ClaimWalletRecord[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [campaignAlreadyRegistered, setCampaignAlreadyRegistered] = useState(false);

  const selectedWallet = useMemo(
    () => claimWallets.find((wallet) => wallet.id === selectedWalletId) ?? null,
    [claimWallets, selectedWalletId],
  );

  const refreshWallets = useCallback((nullifier: string) => {
    const wallets = listClaimWallets(nullifier);
    setClaimWallets(wallets);
    setSelectedWalletId((current) => current ?? wallets[0]?.id ?? null);
  }, []);

  useEffect(() => {
    setActivePassport(passport);
  }, [passport]);

  useEffect(() => {
    if (!activePassport) {
      return;
    }

    refreshWallets(activePassport.nullifier);
  }, [activePassport, refreshWallets]);

  useEffect(() => {
    setCampaignAlreadyRegistered(false);
  }, [campaignId]);

  useEffect(() => {
    void fetch("/api/passport/claim/register")
      .then((response) => response.json())
      .then((payload: { defaultCampaignId?: string }) => {
        if (payload.defaultCampaignId) {
          setCampaignId(payload.defaultCampaignId);
        }
      })
      .catch(() => undefined);
  }, []);

  const copyValue = useCallback(async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const loadPassport = useCallback(() => {
    setError(null);
    setStatus(null);

    try {
      const parsed = parsePassportInput(importJson);
      setActivePassport(parsed);
      onPassportLoad?.(parsed);
      setImportJson("");
      setStatus("Passport loaded.");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load passport JSON.",
      );
    }
  }, [importJson, onPassportLoad]);

  const importBackup = useCallback(() => {
    if (!activePassport) {
      return;
    }

    setError(null);
    setStatus(null);

    try {
      const backup = parseClaimWalletBackup(backupImportJson);
      const record = importClaimWalletBackup(
        backup,
        activePassport.nullifier,
      );
      refreshWallets(activePassport.nullifier);
      setSelectedWalletId(record.id);
      setBackupImportJson("");
      setStatus(`Imported claim wallet ${record.publicKey.slice(0, 8)}...`);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import claim wallet backup.",
      );
    }
  }, [activePassport, backupImportJson, refreshWallets]);

  const importBackupFromFile = useCallback(
    (file: File) => {
      if (!activePassport) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          return;
        }

        setBackupImportJson(reader.result);
        setError(null);
        setStatus(null);

        try {
          const backup = parseClaimWalletBackup(reader.result);
          const record = importClaimWalletBackup(
            backup,
            activePassport.nullifier,
          );
          refreshWallets(activePassport.nullifier);
          setSelectedWalletId(record.id);
          setBackupImportJson("");
          setStatus(`Imported claim wallet ${record.publicKey.slice(0, 8)}...`);
        } catch (importError) {
          setError(
            importError instanceof Error
              ? importError.message
              : "Unable to import claim wallet backup.",
          );
        }
      };
      reader.readAsText(file);
    },
    [activePassport, refreshWallets],
  );

  const createClaimWallet = useCallback(() => {
    if (!activePassport) {
      return;
    }

    setError(null);
    setStatus(null);

    const generated = generateClaimWalletKeypair();
    const record = saveClaimWallet(activePassport.nullifier, generated);
    refreshWallets(activePassport.nullifier);
    setSelectedWalletId(record.id);
    setStatus("Fresh claim wallet generated. Back up the secret key before registering.");
  }, [activePassport, refreshWallets]);

  const registerClaimWallet = useCallback(async () => {
    if (!activePassport || !selectedWallet) {
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/passport/claim/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport: activePassport,
          claimWallet: selectedWallet.publicKey,
          campaignId,
        }),
      });

      const payload = await readJsonResponse<{
        registered?: boolean;
        claimWallet?: string;
        error?: string;
      }>(response);

      if (!response.ok || !payload.registered) {
        if (response.status === 409) {
          setCampaignAlreadyRegistered(true);
        }
        throw new Error(payload.error ?? "Claim wallet registration failed.");
      }

      setCampaignAlreadyRegistered(true);

      markClaimWalletRegistered(selectedWallet.id, campaignId);
      refreshWallets(activePassport.nullifier);
      setStatus(
        `Registered ${payload.claimWallet} for campaign "${campaignId}". Use this address for presales — not your proving wallet.`,
      );
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Unable to register claim wallet.",
      );
    } finally {
      setBusy(false);
    }
  }, [activePassport, campaignId, refreshWallets, selectedWallet]);

  const rotateClaimWallet = useCallback(async () => {
    if (!activePassport || !selectedWallet) {
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/passport/claim/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport: activePassport,
          claimWallet: selectedWallet.publicKey,
          campaignId,
        }),
      });

      const payload = await readJsonResponse<{
        rotated?: boolean;
        claimWallet?: string;
        previousClaimWallet?: string;
        error?: string;
      }>(response);

      if (!response.ok || !payload.rotated) {
        throw new Error(payload.error ?? "Claim wallet rotation failed.");
      }

      markClaimWalletRegistered(selectedWallet.id, campaignId);
      refreshWallets(activePassport.nullifier);
      setStatus(
        `Rotated campaign "${campaignId}" to ${payload.claimWallet}. Previous claim wallet: ${payload.previousClaimWallet}.`,
      );
    } catch (rotateError) {
      setError(
        rotateError instanceof Error
          ? rotateError.message
          : "Unable to rotate claim wallet.",
      );
    } finally {
      setBusy(false);
    }
  }, [activePassport, campaignId, refreshWallets, selectedWallet]);

  const hasLocalCampaignRegistration = useMemo(() => {
    return claimWallets.some((wallet) =>
      wallet.registrations.some((entry) => entry.campaignId === campaignId),
    );
  }, [campaignId, claimWallets]);

  const useRotateFlow =
    campaignAlreadyRegistered || hasLocalCampaignRegistration;

  return (
    <section id="wallet" className="border border-white/20 p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl text-white">
          <span className="font-['BlueScreen']">&#47;&#47;</span>
          <span className="font-['PerfectDOS'] uppercase"> Manage claim wallet</span>
        </h2>
        <p className="font-['PerfectDOS'] text-sm text-white/70 leading-relaxed normal-case">
          Prove reputation with your main wallet, then interact with presales
          through a fresh claim wallet that has no on-chain history linked to
          your proving wallet.
        </p>
      </div>

      {!activePassport ? (
        <div className="space-y-4">
          <p className="font-['PerfectDOS'] text-xs text-white/60 normal-case">
            Paste an existing passport JSON to manage claim wallets.
          </p>
          <textarea
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
            placeholder='{"type":"medusa_passport_v1", ...}'
            className="w-full h-32 bg-[#0d0d0d] border border-white/15 p-3 font-mono text-[11px] text-white/80 normal-case"
          />
          <PanelButton onClick={loadPassport} disabled={!importJson.trim()}>
            Load passport
          </PanelButton>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border border-white/10 p-4 space-y-2 font-['PerfectDOS'] text-xs normal-case">
            <p className="text-white/40 uppercase text-[10px]">Passport</p>
            <p className="text-white">{formatPassportId(activePassport.nullifier)}</p>
            <p className="text-white/60">
              Tier {activePassport.statement.tierLabel} · expires{" "}
              {new Date(activePassport.expiresAt).toLocaleDateString()}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
            <CampaignIdField
              value={campaignId}
              onChange={setCampaignId}
            />
            <PanelButton onClick={createClaimWallet}>Generate claim wallet</PanelButton>
          </div>

          <div className="space-y-3 border border-white/10 p-4">
            <p className="font-['PerfectDOS'] text-[10px] uppercase text-white/40">
              Import backup
            </p>
            <textarea
              value={backupImportJson}
              onChange={(event) => setBackupImportJson(event.target.value)}
              placeholder='{"type":"medusa_claim_wallet_v1", ...}'
              className="w-full h-24 bg-[#0d0d0d] border border-white/15 p-3 font-mono text-[11px] text-white/80 normal-case"
            />
            <div className="flex flex-wrap gap-2">
              <PanelButton
                onClick={importBackup}
                disabled={!backupImportJson.trim()}
              >
                Import backup
              </PanelButton>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      importBackupFromFile(file);
                    }
                    event.target.value = "";
                  }}
                />
                <span className="px-4 py-2 border border-white/30 font-['PerfectDOS'] uppercase text-xs text-white/80 hover:border-white hover:text-white transition-colors cursor-pointer">
                  Choose file
                </span>
              </label>
            </div>
          </div>

          {claimWallets.length > 0 && (
            <div className="space-y-3">
              <p className="font-['PerfectDOS'] text-[10px] uppercase text-white/40">
                Your claim wallets
              </p>
              <div className="space-y-2">
                {claimWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => setSelectedWalletId(wallet.id)}
                    className={`w-full text-left border px-4 py-3 transition-colors ${
                      wallet.id === selectedWalletId
                        ? "border-white bg-white/5"
                        : "border-white/15 hover:border-white/40"
                    }`}
                  >
                    <p className="font-['PerfectDOS'] text-xs text-white normal-case">
                      {wallet.label}
                    </p>
                    <p className="font-mono text-[11px] text-white/70 break-all">
                      {wallet.publicKey}
                    </p>
                    {wallet.registrations.length > 0 && (
                      <p className="font-['PerfectDOS'] text-[10px] text-white/40 mt-1 normal-case">
                        Registered:{" "}
                        {wallet.registrations.map((entry) => entry.campaignId).join(", ")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedWallet && (
            <div className="border border-white/10 p-4 space-y-4">
              <div className="space-y-2">
                <p className="font-['PerfectDOS'] text-[10px] uppercase text-white/40">
                  Public address
                </p>
                <p className="font-mono text-xs text-white break-all normal-case">
                  {selectedWallet.publicKey}
                </p>
                <div className="flex flex-wrap gap-2">
                  <PanelButton
                    variant="ghost"
                    onClick={() => copyValue(selectedWallet.publicKey, "address")}
                  >
                    {copiedField === "address" ? "Copied" : "Copy address"}
                  </PanelButton>
                  <PanelButton
                    variant="ghost"
                    onClick={() => downloadClaimWalletBackup(selectedWallet)}
                  >
                    Export backup
                  </PanelButton>
                </div>
              </div>

              <div className="border border-yellow-500/20 bg-yellow-500/5 p-3 font-['PerfectDOS'] text-[11px] text-yellow-100/90 normal-case leading-relaxed">
                Store your claim wallet backup offline. Medusa never sees your
                secret key — it stays in your browser until you export it.
              </div>

              <div className="flex flex-wrap gap-2">
                {!useRotateFlow ? (
                  <PanelButton onClick={registerClaimWallet} disabled={busy}>
                    {busy ? "Registering..." : "Register for campaign"}
                  </PanelButton>
                ) : (
                  <PanelButton onClick={rotateClaimWallet} disabled={busy}>
                    {busy ? "Rotating..." : "Rotate to this claim wallet"}
                  </PanelButton>
                )}
              </div>
              {useRotateFlow && (
                <p className="font-['PerfectDOS'] text-[11px] text-white/50 normal-case">
                  Generate a fresh claim wallet above, select it, then rotate so
                  the campaign points to your new address.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {status && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-['PerfectDOS'] text-xs text-emerald-200 normal-case">
          {status}
        </div>
      )}

      {error && (
        <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 font-['PerfectDOS'] text-xs text-red-300 normal-case">
          {error}
        </div>
      )}
    </section>
  );
}
