import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import { getBuybackSlippageBps } from "@/lib/staking/buyback.config.server";

const JUPITER_QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote";
const JUPITER_SWAP_URL = "https://lite-api.jup.ag/swap/v1/swap";
export const NATIVE_SOL_MINT =
  "So11111111111111111111111111111111111111112";

type JupiterQuoteResponse = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  [key: string]: unknown;
};

function jupiterHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };
  const apiKey = process.env.JUPITER_API_KEY?.trim();
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

export async function getJupiterQuote({
  inputMint,
  outputMint,
  amount,
  slippageBps = getBuybackSlippageBps(),
}: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps?: number;
}): Promise<JupiterQuoteResponse> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: String(slippageBps),
    swapMode: "ExactIn",
  });

  const response = await fetch(`${JUPITER_QUOTE_URL}?${params}`, {
    headers: jupiterHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jupiter quote failed (${response.status}): ${body}`);
  }

  return (await response.json()) as JupiterQuoteResponse;
}

export async function executeJupiterSwap({
  connection,
  payer,
  quote,
}: {
  connection: Connection;
  payer: Keypair;
  quote: JupiterQuoteResponse;
}): Promise<{ signature: string; outAmount: bigint }> {
  const response = await fetch(JUPITER_SWAP_URL, {
    method: "POST",
    headers: {
      ...jupiterHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: payer.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jupiter swap failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { swapTransaction: string };
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(payload.swapTransaction, "base64"),
  );
  transaction.sign([payer]);

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      maxRetries: 3,
    },
  );

  return {
    signature,
    outAmount: BigInt(quote.outAmount),
  };
}
