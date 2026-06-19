import { createHmac } from "node:crypto";
import nacl from "tweetnacl";
import {
  createPublicClient,
  fallback,
  http,
  parseUnits,
  recoverMessageAddress,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { bytesToHex, hexToBytes } from "@/lib/passport/eligibility";
import {
  buildOwnershipMessage,
  type MedusaTokenPassport,
} from "./tokenPassport";
import {
  getPartnerThreshold,
  type TokenPassportPartner,
} from "./partners";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Public mainnet RPCs used as a resilient fallback chain when no dedicated
// ETH_RPC_URL is set (or when it fails). viem's `fallback` transport retries the
// next endpoint on error, so a single provider outage doesn't break minting.
const PUBLIC_ETH_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://cloudflare-eth.com",
  "https://1rpc.io/eth",
  "https://eth.llamarpc.com",
];

function getEthTransport() {
  const configured = process.env.ETH_RPC_URL?.trim();
  // A dedicated Alchemy/Infura URL (when set) is tried first, then publics.
  const urls = configured
    ? [configured, ...PUBLIC_ETH_RPCS]
    : PUBLIC_ETH_RPCS;
  return fallback(
    urls.map((url) => http(url, { timeout: 10_000 })),
    { rank: false },
  );
}

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function getEthClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: mainnet,
      transport: getEthTransport(),
    });
  }
  return cachedClient;
}

/** Server pepper for the opaque holder hash. Required for hashed storage. */
function getPartnerPepper(): string {
  const pepper = process.env.MEDUSA_PARTNER_PEPPER?.trim();
  if (!pepper) {
    throw new Error("MEDUSA_PARTNER_PEPPER is not configured.");
  }
  return pepper;
}

/** Opaque, non-reversible holder id. Never store the raw address. */
export function computeHolderId(partnerId: string, address: string): string {
  return createHmac("sha256", getPartnerPepper())
    .update(`${partnerId}:${address.toLowerCase()}`)
    .digest("hex");
}

/**
 * Recovers the signer from an ownership signature and confirms it matches the
 * claimed address. Returns the checksum-normalised lowercase address on success.
 */
export async function recoverOwnership(params: {
  partnerName: string;
  address: string;
  signature: `0x${string}`;
  nonce: string;
  issuedAt: string;
}): Promise<string | null> {
  const message = buildOwnershipMessage(
    params.partnerName,
    params.nonce,
    params.issuedAt,
  );

  let recovered: Address;
  try {
    recovered = await recoverMessageAddress({
      message,
      signature: params.signature,
    });
  } catch {
    return null;
  }

  return recovered.toLowerCase() === params.address.toLowerCase()
    ? recovered.toLowerCase()
    : null;
}

/** Live on-chain balance check against the partner's threshold. */
export async function checkTokenHolding(
  partner: TokenPassportPartner,
  address: string,
): Promise<{ eligible: boolean; threshold: string }> {
  const threshold = getPartnerThreshold(partner);
  const required = parseUnits(threshold, partner.decimals);

  const balance = (await getEthClient().readContract({
    address: partner.tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address as Address],
  })) as bigint;

  return { eligible: balance >= required, threshold };
}

function getIssuerSecretKey(): Uint8Array {
  const secret = process.env.PASSPORT_ISSUER_SECRET_KEY;
  if (!secret) {
    throw new Error("PASSPORT_ISSUER_SECRET_KEY is not configured.");
  }
  return hexToBytes(secret);
}

function getIssuerPublicKey(): Uint8Array {
  const publicKey = process.env.PASSPORT_ISSUER_PUBLIC_KEY;
  if (publicKey) {
    return hexToBytes(publicKey);
  }
  return nacl.sign.keyPair.fromSecretKey(getIssuerSecretKey()).publicKey;
}

export function signTokenPassport(
  payload: Omit<MedusaTokenPassport, "signature">,
): MedusaTokenPassport {
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const signature = nacl.sign.detached(message, getIssuerSecretKey());
  return { ...payload, signature: bytesToHex(signature) };
}

export function verifyTokenPassport(passport: MedusaTokenPassport): boolean {
  const { signature, ...payload } = passport;
  const message = new TextEncoder().encode(JSON.stringify(payload));
  return nacl.sign.detached.verify(
    message,
    hexToBytes(signature),
    getIssuerPublicKey(),
  );
}

/** Builds and signs a fresh token passport for a verified holder. */
export function buildTokenPassport(params: {
  partner: TokenPassportPartner;
  holderId: string;
  eligible: boolean;
  threshold: string;
  telegramUsername?: string;
}): MedusaTokenPassport {
  const issuedAt = new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + params.partner.validityHours * 60 * 60 * 1000,
  );

  return signTokenPassport({
    type: "medusa_token_passport_v1",
    chain: "ethereum",
    partnerId: params.partner.id,
    partnerName: params.partner.name,
    token: params.partner.tokenAddress,
    eligible: params.eligible,
    holderId: params.holderId,
    threshold: params.threshold,
    ...(params.telegramUsername
      ? { telegramUsername: params.telegramUsername }
      : {}),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    issuer: "medusa",
  });
}
