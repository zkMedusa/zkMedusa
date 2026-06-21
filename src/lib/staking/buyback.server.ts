import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getSolanaNetwork } from "@/lib/passport/config";
import {
  getAssociatedTokenAddress,
  getUsdcMintAddress,
} from "@/lib/passport/usdc.shared";
import {
  DRIP_INTERVAL_MINUTES,
  getMedusaMintAddress,
  PASSPORT_USDC_BUYBACK_PERCENT,
  PASSPORT_USDC_TO_SOL_PERCENT,
  PUMPFUN_DEV_FEE_BUYBACK_PERCENT,
  PUMPFUN_TREASURY_PERCENT,
} from "@/lib/staking/config";
import {
  getBuybackAuthorityKeypair,
  getBuybackMinUsdc,
  getBuybackMinSol,
  createBuybackConnection,
  getDevWalletAddress,
  getOpsTreasuryAddress,
  getPassportTreasuryAddress,
  getPumpClaimMinLamports,
  getSolReserveLamports,
  getTreasuryKeypair,
  isBuybackConfigured,
  isBuybackEnabled,
  isMainnetBuybackNetwork,
} from "@/lib/staking/buyback.config.server";
import { saveBuybackRun, getLastSuccessfulBuybackRun } from "@/lib/staking/buybackStore.server";
import {
  executeJupiterSwap,
  getJupiterQuote,
  NATIVE_SOL_MINT,
} from "@/lib/staking/jupiter.server";
import { rawToMedusaAmount } from "@/lib/staking/amounts";
import { getMintDecimals } from "@/lib/staking/streamflow.server";
import { getStreamflowTierPools } from "@/lib/staking/streamflowPools";
import { claimPumpCreatorFees } from "@/lib/staking/pumpfun.server";
import type { BuybackRunRecord, BuybackTierTransfer } from "@/lib/staking/types";

function percentOf(value: bigint, percent: number): bigint {
  return (value * BigInt(Math.round(percent * 100))) / BigInt(10_000);
}

async function confirmSignatureHttp(
  connection: Connection,
  signature: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out confirming transaction ${signature}.`);
}

async function sendAndConfirm(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
): Promise<string> {
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    signers,
    {
      commitment: "confirmed",
      skipPreflight: false,
    },
  );
  await confirmSignatureHttp(connection, signature);
  return signature;
}

async function getSolBalanceLamports(
  connection: Connection,
  owner: PublicKey,
): Promise<bigint> {
  const balance = await connection.getBalance(owner, "confirmed");
  return BigInt(balance);
}

async function getSplTokenAmount(
  connection: Connection,
  tokenAccount: PublicKey,
): Promise<bigint> {
  try {
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    return BigInt(balance.value.amount);
  } catch {
    return BigInt(0);
  }
}

function getMedusaAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
}

async function transferSol({
  connection,
  from,
  to,
  lamports,
}: {
  connection: Connection;
  from: Keypair;
  to: PublicKey;
  lamports: bigint;
}): Promise<string> {
  if (lamports <= BigInt(0)) {
    throw new Error("SOL transfer amount must be positive.");
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: Number(lamports),
    }),
  );

  return sendAndConfirm(connection, transaction, [from]);
}

async function distributeMedusaToTopUps({
  connection,
  authority,
  mint,
  decimals,
  totalRaw,
  dryRun,
}: {
  connection: Connection;
  authority: Keypair;
  mint: PublicKey;
  decimals: number;
  totalRaw: bigint;
  dryRun: boolean;
}): Promise<BuybackTierTransfer[]> {
  const tiers = getStreamflowTierPools();
  const sourceAta = getMedusaAta(authority.publicKey, mint);
  const transfers: BuybackTierTransfer[] = [];
  let allocated = BigInt(0);

  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    const isLast = index === tiers.length - 1;
    const shareRaw = isLast
      ? totalRaw - allocated
      : percentOf(totalRaw, tier.buybackSharePercent);
    allocated += shareRaw;

    if (shareRaw <= BigInt(0)) {
      continue;
    }

    if (dryRun) {
      transfers.push({
        tierDays: tier.days,
        topUpAddress: tier.topUpAddress,
        amountMedusa: rawToMedusaAmount(shareRaw, decimals),
      });
      continue;
    }

    const destination = new PublicKey(tier.topUpAddress);
    const transaction = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        authority.publicKey,
        sourceAta,
        authority.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
      ),
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        destination,
        authority.publicKey,
        Number(shareRaw),
        decimals,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    const signature = await sendAndConfirm(connection, transaction, [authority]);
    transfers.push({
      tierDays: tier.days,
      topUpAddress: tier.topUpAddress,
      amountMedusa: rawToMedusaAmount(shareRaw, decimals),
      signature,
    });
  }

  return transfers;
}

export interface RunBuybackOptions {
  dryRun?: boolean;
  force?: boolean;
  /** Skip Pump.fun dev-fee claim; swap + distribute from existing wallet SOL. */
  skipPumpClaim?: boolean;
  /** Skip passport USDC buyback slice (local recovery runs). */
  skipPassportUsdc?: boolean;
}

export async function runBuyback(
  options: RunBuybackOptions = {},
): Promise<BuybackRunRecord> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const skipPumpClaim = options.skipPumpClaim ?? false;
  const skipPassportUsdc = options.skipPassportUsdc ?? false;
  const ranAt = new Date().toISOString();
  const signatures: string[] = [];
  const errors: string[] = [];

  const baseRecord = (
    partial: Partial<BuybackRunRecord>,
  ): BuybackRunRecord => ({
    ranAt,
    ok: false,
    dryRun,
    authority: partial.authority ?? "",
    devWallet: partial.devWallet ?? "",
    treasuryWallet: partial.treasuryWallet ?? null,
    pumpClaimableLamports: "0",
    pumpClaimedLamports: "0",
    pumpSolBuybackLamports: "0",
    pumpSolTreasuryLamports: "0",
    passportUsdcBuybackMicro: "0",
    passportUsdcToSolMicro: "0",
    solForMedusaLamports: "0",
    medusaBuybackRaw: "0",
    medusaDistributedRaw: "0",
    tierTransfers: [],
    signatures,
    errors,
    ...partial,
  });

  if (!isBuybackConfigured()) {
    const record = baseRecord({
      skipped: "MEDUSA_BUYBACK_AUTHORITY_SECRET_KEY is not configured.",
    });
    await saveBuybackRun(record);
    return record;
  }

  if (!dryRun && !isBuybackEnabled()) {
    const record = baseRecord({
      skipped: "Buyback bot is disabled (MEDUSA_BUYBACK_ENABLED=false).",
    });
    await saveBuybackRun(record);
    return record;
  }

  if (!isMainnetBuybackNetwork() && !dryRun) {
    const record = baseRecord({
      skipped: "Live buybacks are restricted to mainnet-beta.",
    });
    await saveBuybackRun(record);
    return record;
  }

  if (!force && !dryRun) {
    const lastSuccess = await getLastSuccessfulBuybackRun();
    if (lastSuccess?.ranAt) {
      const elapsedMs = Date.now() - new Date(lastSuccess.ranAt).getTime();
      const minIntervalMs = DRIP_INTERVAL_MINUTES * 60 * 1000;
      if (elapsedMs < minIntervalMs) {
        const record = baseRecord({
          skipped: `Last successful buyback was ${Math.round(elapsedMs / 60000)} min ago; interval is ${DRIP_INTERVAL_MINUTES} min.`,
          authority: lastSuccess.authority,
          devWallet: lastSuccess.devWallet,
          treasuryWallet: lastSuccess.treasuryWallet,
        });
        await saveBuybackRun(record);
        return record;
      }
    }
  }

  const authority = getBuybackAuthorityKeypair();
  if (!authority) {
    const record = baseRecord({
      skipped: "Buyback authority keypair could not be loaded.",
    });
    await saveBuybackRun(record);
    return record;
  }

  const connection = createBuybackConnection();
  const devWallet = getDevWalletAddress(authority.publicKey);
  const treasuryWallet = getPassportTreasuryAddress();
  const opsTreasury = getOpsTreasuryAddress();
  const medusaMint = new PublicKey(getMedusaMintAddress());
  const usdcMint = getUsdcMintAddress(getSolanaNetwork());
  const usdcDecimals = 6;
  const medusaDecimals = await getMintDecimals();
  const reserveLamports = getSolReserveLamports();
  const minUsdcMicro = BigInt(Math.floor(getBuybackMinUsdc() * 1_000_000));

  if (!devWallet.equals(authority.publicKey)) {
    errors.push(
      "MEDUSA_DEV_WALLET differs from buyback authority; only authority SOL balance is used.",
    );
  }

  const pumpClaim = skipPumpClaim
    ? {
        claimableLamports: BigInt(0),
        claimedLamports: BigInt(0),
        usesSharingConfig: false,
        skipped: "Pump claim skipped (swap-only run).",
      }
    : await claimPumpCreatorFees({
        connection,
        authority,
        mint: medusaMint,
        dryRun,
      });
  if (pumpClaim.signature) {
    signatures.push(pumpClaim.signature);
  }
  if (pumpClaim.error) {
    errors.push(`Pump fee claim: ${pumpClaim.error}`);
  }

  const solOwner = devWallet;
  let availableSol =
    (await getSolBalanceLamports(connection, solOwner)) - reserveLamports;
  if (dryRun && pumpClaim.claimableLamports >= getPumpClaimMinLamports()) {
    availableSol += pumpClaim.claimableLamports;
  } else if (pumpClaim.claimedLamports > BigInt(0)) {
    // Re-read after an on-chain claim so the swap slice uses fresh balance.
    availableSol =
      (await getSolBalanceLamports(connection, solOwner)) - reserveLamports;
  }

  const pumpClaimFields = {
    pumpClaimableLamports: pumpClaim.claimableLamports.toString(),
    pumpClaimedLamports: pumpClaim.claimedLamports.toString(),
    pumpClaimSignature: pumpClaim.signature,
    pumpUsesSharingConfig: pumpClaim.usesSharingConfig,
  };

  let pumpSolBuybackLamports = BigInt(0);
  let pumpSolTreasuryLamports = BigInt(0);
  if (availableSol > BigInt(0)) {
    pumpSolBuybackLamports = percentOf(
      availableSol,
      PUMPFUN_DEV_FEE_BUYBACK_PERCENT,
    );
    pumpSolTreasuryLamports = percentOf(availableSol, PUMPFUN_TREASURY_PERCENT);
  }

  let passportUsdcBuybackMicro = BigInt(0);
  let passportUsdcToSolMicro = BigInt(0);
  let authorityUsdcAta: PublicKey | null = null;

  if (treasuryWallet && !skipPassportUsdc) {
    const treasuryUsdcAta = getAssociatedTokenAddress(
      treasuryWallet,
      usdcMint,
    );
    authorityUsdcAta = getAssociatedTokenAddress(
      authority.publicKey,
      usdcMint,
    );
    const treasuryUsdcBalance = await getSplTokenAmount(
      connection,
      treasuryUsdcAta,
    );
    passportUsdcBuybackMicro = percentOf(
      treasuryUsdcBalance,
      PASSPORT_USDC_BUYBACK_PERCENT,
    );
    passportUsdcToSolMicro = percentOf(
      passportUsdcBuybackMicro,
      PASSPORT_USDC_TO_SOL_PERCENT,
    );

    if (
      passportUsdcBuybackMicro >= minUsdcMicro &&
      !treasuryWallet.equals(authority.publicKey)
    ) {
      const treasurySigner = getTreasuryKeypair();
      if (!treasurySigner) {
        errors.push(
          "Passport treasury differs from buyback authority; set MEDUSA_TREASURY_SECRET_KEY or use the same wallet.",
        );
        passportUsdcBuybackMicro = BigInt(0);
        passportUsdcToSolMicro = BigInt(0);
      }
    }
  }

  const minSolLamports = BigInt(Math.floor(getBuybackMinSol() * 1_000_000_000));
  const hasPumpBuyback = pumpSolBuybackLamports >= minSolLamports;
  const hasPassportBuyback = passportUsdcBuybackMicro >= minUsdcMicro;

  if (!hasPumpBuyback && !hasPassportBuyback) {
    const minSol = getBuybackMinSol();
    const minClaimSol = Number(getPumpClaimMinLamports()) / 1e9;
    const record = baseRecord({
      skipped: [
        "No buyback balances above configured minimums.",
        `SOL buyback slice ${(Number(pumpSolBuybackLamports) / 1e9).toFixed(4)} (min ${minSol}).`,
        `Pump claimable ${(Number(pumpClaim.claimableLamports) / 1e9).toFixed(4)} SOL (claim min ${minClaimSol}).`,
        `Wallet ${solOwner.toBase58()} balance after reserve ${(Number(availableSol) / 1e9).toFixed(4)} SOL.`,
        pumpClaim.skipped ? `Pump: ${pumpClaim.skipped}` : null,
      ]
        .filter(Boolean)
        .join(" "),
      authority: authority.publicKey.toBase58(),
      devWallet: devWallet.toBase58(),
      treasuryWallet: treasuryWallet?.toBase58() ?? null,
      ...pumpClaimFields,
      pumpSolBuybackLamports: pumpSolBuybackLamports.toString(),
      pumpSolTreasuryLamports: pumpSolTreasuryLamports.toString(),
      passportUsdcBuybackMicro: passportUsdcBuybackMicro.toString(),
      passportUsdcToSolMicro: passportUsdcToSolMicro.toString(),
    });
    await saveBuybackRun(record);
    return record;
  }

  if (dryRun) {
    let estimatedMedusaRaw = BigInt(0);

    try {
      if (pumpSolBuybackLamports >= minSolLamports) {
        const quote = await getJupiterQuote({
          inputMint: NATIVE_SOL_MINT,
          outputMint: medusaMint.toBase58(),
          amount: pumpSolBuybackLamports,
        });
        estimatedMedusaRaw += BigInt(quote.outAmount);
      }

      const passportUsdcToMedusaMicro =
        passportUsdcBuybackMicro - passportUsdcToSolMicro;

      if (passportUsdcToSolMicro > BigInt(0)) {
        const solQuote = await getJupiterQuote({
          inputMint: usdcMint.toBase58(),
          outputMint: NATIVE_SOL_MINT,
          amount: passportUsdcToSolMicro,
        });
        const medQuote = await getJupiterQuote({
          inputMint: NATIVE_SOL_MINT,
          outputMint: medusaMint.toBase58(),
          amount: BigInt(solQuote.outAmount),
        });
        estimatedMedusaRaw += BigInt(medQuote.outAmount);
      }

      if (passportUsdcToMedusaMicro > BigInt(0)) {
        const quote = await getJupiterQuote({
          inputMint: usdcMint.toBase58(),
          outputMint: medusaMint.toBase58(),
          amount: passportUsdcToMedusaMicro,
        });
        estimatedMedusaRaw += BigInt(quote.outAmount);
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `Dry-run quote failed: ${error.message}`
          : "Dry-run quote failed.",
      );
    }

    const tierTransfers = await distributeMedusaToTopUps({
      connection,
      authority,
      mint: medusaMint,
      decimals: medusaDecimals,
      totalRaw: estimatedMedusaRaw,
      dryRun: true,
    });

    const record = baseRecord({
      ok: errors.length === 0,
      authority: authority.publicKey.toBase58(),
      devWallet: devWallet.toBase58(),
      treasuryWallet: treasuryWallet?.toBase58() ?? null,
      ...pumpClaimFields,
      pumpSolBuybackLamports: pumpSolBuybackLamports.toString(),
      pumpSolTreasuryLamports: pumpSolTreasuryLamports.toString(),
      passportUsdcBuybackMicro: passportUsdcBuybackMicro.toString(),
      passportUsdcToSolMicro: passportUsdcToSolMicro.toString(),
      solForMedusaLamports: pumpSolBuybackLamports.toString(),
      medusaBuybackRaw: estimatedMedusaRaw.toString(),
      medusaDistributedRaw: estimatedMedusaRaw.toString(),
      tierTransfers,
      errors,
    });
    await saveBuybackRun(record);
    return record;
  }

  let solForMedusaLamports = pumpSolBuybackLamports;
  let medusaAcquiredRaw = BigInt(0);

  try {
    if (pumpSolTreasuryLamports > BigInt(0) && opsTreasury) {
      const sig = await transferSol({
        connection,
        from: authority,
        to: opsTreasury,
        lamports: pumpSolTreasuryLamports,
      });
      signatures.push(sig);
    }

    if (
      passportUsdcBuybackMicro >= minUsdcMicro &&
      treasuryWallet &&
      authorityUsdcAta
    ) {
      const treasuryUsdcAta = getAssociatedTokenAddress(
        treasuryWallet,
        usdcMint,
      );
      const treasurySigner = treasuryWallet.equals(authority.publicKey)
        ? authority
        : getTreasuryKeypair()!;

      if (!treasuryWallet.equals(authority.publicKey)) {
        const setupTx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(
            authority.publicKey,
            authorityUsdcAta,
            authority.publicKey,
            usdcMint,
          ),
          createTransferCheckedInstruction(
            treasuryUsdcAta,
            usdcMint,
            authorityUsdcAta,
            treasurySigner.publicKey,
            Number(passportUsdcBuybackMicro),
            usdcDecimals,
            [],
            TOKEN_PROGRAM_ID,
          ),
        );
        const signers = treasuryWallet.equals(authority.publicKey)
          ? [authority]
          : [authority, treasurySigner];
        const sig = await sendAndConfirm(connection, setupTx, signers);
        signatures.push(sig);
      }

      if (passportUsdcToSolMicro > BigInt(0)) {
        const quote = await getJupiterQuote({
          inputMint: usdcMint.toBase58(),
          outputMint: NATIVE_SOL_MINT,
          amount: passportUsdcToSolMicro,
        });
        const swap = await executeJupiterSwap({
          connection,
          payer: authority,
          quote,
        });
        signatures.push(swap.signature);
        await confirmSignatureHttp(connection, swap.signature);
        solForMedusaLamports += BigInt(quote.outAmount);
      }

      const passportUsdcToMedusaMicro =
        passportUsdcBuybackMicro - passportUsdcToSolMicro;
      if (passportUsdcToMedusaMicro > BigInt(0)) {
        const quote = await getJupiterQuote({
          inputMint: usdcMint.toBase58(),
          outputMint: medusaMint.toBase58(),
          amount: passportUsdcToMedusaMicro,
        });
        const swap = await executeJupiterSwap({
          connection,
          payer: authority,
          quote,
        });
        signatures.push(swap.signature);
        await confirmSignatureHttp(connection, swap.signature);
        medusaAcquiredRaw += BigInt(quote.outAmount);
      }
    }

    if (solForMedusaLamports >= minSolLamports) {
      const quote = await getJupiterQuote({
        inputMint: NATIVE_SOL_MINT,
        outputMint: medusaMint.toBase58(),
        amount: solForMedusaLamports,
      });
      const swap = await executeJupiterSwap({
        connection,
        payer: authority,
        quote,
      });
      signatures.push(swap.signature);
      await confirmSignatureHttp(connection, swap.signature);
      medusaAcquiredRaw += BigInt(quote.outAmount);
    }

    if (medusaAcquiredRaw <= BigInt(0)) {
      throw new Error("Buyback swaps produced zero $MEDUSA.");
    }

    const tierTransfers = await distributeMedusaToTopUps({
      connection,
      authority,
      mint: medusaMint,
      decimals: medusaDecimals,
      totalRaw: medusaAcquiredRaw,
      dryRun: false,
    });
    signatures.push(
      ...tierTransfers
        .map((entry) => entry.signature)
        .filter((entry): entry is string => Boolean(entry)),
    );

    const record = baseRecord({
      ok: errors.length === 0,
      authority: authority.publicKey.toBase58(),
      devWallet: devWallet.toBase58(),
      treasuryWallet: treasuryWallet?.toBase58() ?? null,
      ...pumpClaimFields,
      pumpSolBuybackLamports: pumpSolBuybackLamports.toString(),
      pumpSolTreasuryLamports: pumpSolTreasuryLamports.toString(),
      passportUsdcBuybackMicro: passportUsdcBuybackMicro.toString(),
      passportUsdcToSolMicro: passportUsdcToSolMicro.toString(),
      solForMedusaLamports: solForMedusaLamports.toString(),
      medusaBuybackRaw: medusaAcquiredRaw.toString(),
      medusaDistributedRaw: medusaAcquiredRaw.toString(),
      tierTransfers,
      errors,
    });
    await saveBuybackRun(record);
    return record;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    const record = baseRecord({
      authority: authority.publicKey.toBase58(),
      devWallet: devWallet.toBase58(),
      treasuryWallet: treasuryWallet?.toBase58() ?? null,
      ...pumpClaimFields,
      pumpSolBuybackLamports: pumpSolBuybackLamports.toString(),
      pumpSolTreasuryLamports: pumpSolTreasuryLamports.toString(),
      passportUsdcBuybackMicro: passportUsdcBuybackMicro.toString(),
      passportUsdcToSolMicro: passportUsdcToSolMicro.toString(),
      solForMedusaLamports: solForMedusaLamports.toString(),
      errors,
    });
    await saveBuybackRun(record);
    return record;
  }
}

export { isBuybackConfigured, isBuybackEnabled } from "@/lib/staking/buyback.config.server";
