"use client";

import { VersionedTransaction } from "@solana/web3.js";
import type { SignerWalletAdapterProps } from "@solana/wallet-adapter-base";

interface V2Transaction {
  messageBytes: Uint8Array;
  signatures: Record<string, Uint8Array>;
}

type SignAllTransactions = SignerWalletAdapterProps["signAllTransactions"];

function isV2Transaction(tx: unknown): tx is V2Transaction {
  return (
    typeof tx === "object" &&
    tx !== null &&
    "messageBytes" in tx &&
    (tx as V2Transaction).messageBytes instanceof Uint8Array &&
    "signatures" in tx &&
    typeof (tx as V2Transaction).signatures === "object"
  );
}

function convertToVersionedTransaction(
  tx: VersionedTransaction | V2Transaction,
): VersionedTransaction {
  if (tx instanceof VersionedTransaction) {
    return tx;
  }

  if (isV2Transaction(tx)) {
    const numSignatures = Object.keys(tx.signatures).length;
    const signaturesLength = 1 + numSignatures * 64;
    const fullTx = new Uint8Array(signaturesLength + tx.messageBytes.length);
    fullTx[0] = numSignatures;
    fullTx.set(tx.messageBytes, signaturesLength);
    return VersionedTransaction.deserialize(fullTx);
  }

  throw new Error("Unsupported transaction format");
}

function extractSignature(
  signedTx: VersionedTransaction,
  walletAddress: string,
): Record<string, Uint8Array> {
  const signerIndex = signedTx.message.staticAccountKeys.findIndex(
    (key) => key.toBase58() === walletAddress,
  );

  if (signerIndex === -1) {
    throw new Error(`Wallet address ${walletAddress} not found in transaction signers`);
  }

  const signature = signedTx.signatures[signerIndex];
  if (!signature) {
    throw new Error(
      `Signature not found for wallet address ${walletAddress} at index ${signerIndex}`,
    );
  }

  return { [walletAddress]: signature };
}

export function createWalletAdapterSigner(
  walletAddress: string,
  signAllTransactions: SignAllTransactions,
) {
  if (!signAllTransactions) {
    throw new Error("Connected wallet does not support transaction signing.");
  }

  return {
    address: walletAddress,
    signTransactions: async (transactions: Array<VersionedTransaction | V2Transaction>) => {
      const txsToSign = transactions.map(convertToVersionedTransaction);
      const signedTxs = await signAllTransactions(txsToSign);
      return signedTxs.map((signedTx) => extractSignature(signedTx, walletAddress));
    },
  };
}
