# Medusa

Privacy layer for Solana wallet reputation.

Medusa lets wallets prove they are real and active — without exposing address history, balances, or transaction graphs. Users mint a **Medusa Passport** backed by zero-knowledge proofs and pay via **x402 USDC**. Partners gate presales, whitelists, and app access through the **`@zkmedusa/passport-sdk`**.

| | |
| --- | --- |
| Website | [zkmedusa.com](https://www.zkmedusa.com) |
| Mint passport | [/passport](https://www.zkmedusa.com/passport) |
| Medusa wallet | [/wallet](https://www.zkmedusa.com/wallet) |
| SDK docs | [/docs](https://www.zkmedusa.com/docs) |
| npm package | [@zkmedusa/passport-sdk](https://www.npmjs.com/package/@zkmedusa/passport-sdk) |
| X | [@ZkMedusa](https://x.com/ZkMedusa) |
| Telegram | [t.me/zkmedusa](https://t.me/zkmedusa) |

---

## How it works

1. User connects a Solana wallet on `/passport`.
2. The browser scans public on-chain data locally (wallet age, tx count, 90-day volume).
3. A Noir circuit generates an UltraHonk ZK proof of eligibility — the wallet address is not included in the proof.
4. User pays **$0.50 USDC** via x402 to mint the passport.
5. The server verifies the proof, signs the passport, and returns a JSON credential valid for **90 days**.
6. Partners verify the passport with the SDK and optionally register a **claim wallet** for whitelist or presale access.
7. Optionally mint a **soulbound passport badge** (non-transferable MPL Core cNFT) to the claim wallet for on-chain composability.

---

## Medusa Wallet & soulbound badge

The claim wallet flow and soulbound badge minting now live on the same page as
minting, [`/passport`](https://www.zkmedusa.com/passport). `/wallet` redirects
there. Returning users can pick **"Manage claim wallets & soulbound badge"** to
load an existing passport without re-minting.

1. Mint a passport on `/passport` (or load an existing passport JSON via "Manage").
2. Generate a fresh **claim wallet** keypair in the browser.
3. **Export** a backup JSON and store it offline.
4. **Import** a backup JSON to restore a claim wallet on another device.
5. Register the claim wallet with your partner's **campaign ID**.
6. Submit the **claim wallet address** to the partner — not your proving wallet.
7. Optionally **mint a soulbound badge** to the claim wallet — a permanently
   frozen MPL Core asset whose on-chain attributes mirror your tier. Medusa
   mints it (paying rent/fees) so the badge is never linked to your proving
   wallet, and it can never be transferred.

Users register via public endpoints (`/api/passport/claim/register` and `/rotate`) for campaigns listed in `MEDUSA_CLAIM_CAMPAIGN_IDS`. Partners still use Bearer-authenticated `/api/partner/register` from their backend.

Backup JSON format:

```json
{
  "type": "medusa_claim_wallet_v1",
  "publicKey": "...",
  "secretKeyBase58": "...",
  "passportNullifier": "...",
  "label": "Claim 1",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Claim wallet secrets live in browser `localStorage` only — Medusa never stores them. Passport JSON does **not** contain claim keys.

Interactive docs: [zkmedusa.com/docs#claim-wallet](https://www.zkmedusa.com/docs#claim-wallet)

---

## Eligibility & tiers

All tiers require:

- Wallet age ≥ **90 days**
- Transaction count ≥ **20**

Volume is measured over a **90-day** window:

| Tier | Volume (90d) |
| --- | --- |
| BRONZE | ≥ 10 SOL |
| SILVER | ≥ 50 SOL |
| GOLD | ≥ 200 SOL |

Policy version: `medusa-passport-v1`

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Wallet | Solana wallet adapter (Phantom) |
| ZK | Noir, Barretenberg (UltraHonk), `@noir-lang/noir_js` |
| Payments | x402 USDC on Solana, Coinbase CDP facilitator (mainnet) |
| Signing | Ed25519 (tweetnacl) |
| SDK | TypeScript, published as `@zkmedusa/passport-sdk` |

---

## Project structure

```
app/
  api/passport/       Issue, verify, issuer, claim register/rotate, badge mint/metadata
  api/partner/        Register + whitelist endpoints
  passport/           Mint + claim wallet + soulbound badge UI
  wallet/             Redirects to /passport
  docs/               SDK documentation page
circuits/passport/    Noir circuit source
packages/
  medusa-passport-sdk/  Partner SDK (source + npm package)
public/               Static assets, compiled circuit, WASM
scripts/              Circuit compile, WASM copy, key generation
src/components/       Landing, passport, wallet UI
src/lib/passport/     ZK prover/verifier, x402, claim wallet client
src/lib/partner/      Partner auth + registration store
```

---

## Local development

### Prerequisites

- Node.js 22+
- npm

Circuit compilation requires Linux (or WSL). On Windows, use `PASSPORT_DEV_SKIP_ZK=true` for local UI work; full ZK verification runs on Vercel/Linux.

### Setup

```bash
git clone https://github.com/your-org/medusa.git
cd medusa
npm install
cp .env.example .env.local
npm run passport:keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run passport:keys` prints a fresh Ed25519 key pair. Add the output to `.env.local`:

```
PASSPORT_ISSUER_SECRET_KEY=...
PASSPORT_ISSUER_PUBLIC_KEY=...
```

### Environment variables

Copy `.env.example` to `.env.local`. Never commit real values.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (docs examples, circuit fetch) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Yes | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Custom RPC; defaults to public Solana RPC |
| `PASSPORT_TREASURY_WALLET` | Prod | Solana address that receives USDC mint payments |
| `NEXT_PUBLIC_PASSPORT_TREASURY_WALLET` | Prod | Same wallet, exposed to the client |
| `NEXT_PUBLIC_PASSPORT_ISSUE_PRICE_USDC` | No | Mint price (default `$0.50`) |
| `X402_FACILITATOR_URL` | No | Override x402 facilitator URL (default: `https://x402.dexter.cash`) |
| `PASSPORT_ISSUER_SECRET_KEY` | Yes | Ed25519 secret for signing passports |
| `PASSPORT_ISSUER_PUBLIC_KEY` | Yes | Ed25519 public key (also served via API) |
| `MEDUSA_PARTNER_API_KEYS` | Partners | `campaignId:apiKey` pairs, comma-separated |
| `MEDUSA_CLAIM_CAMPAIGN_IDS` | Yes | Comma-separated campaign IDs allowed on public claim register/rotate |
| `MEDUSA_BADGE_AUTHORITY_SECRET_KEY` | Badge | Base58/JSON secret of the wallet that mints + holds freeze authority for soulbound badges (keep funded) |
| `MEDUSA_BADGE_COLLECTION` | Badge | MPL Core collection address (create once with `npm run badge:collection`) |
| `NEXT_PUBLIC_MEDUSA_BADGE_COLLECTION` | Badge | Same collection, exposed to the client |
| `MEDUSA_BADGE_RPC_URL` | No | Dedicated RPC for minting badges (defaults to `NEXT_PUBLIC_SOLANA_RPC_URL`) |
| `NEXT_PUBLIC_MEDUSA_BADGE_ENABLED` | No | Toggle badge minting UI (defaults on when a public collection is set) |
| `PASSPORT_DEV_SKIP_PAYMENT` | Dev | Skip x402 payment during testing |
| `PASSPORT_DEV_SKIP_ZK` | Dev | Accept dev proofs without ZK verification |
| `NEXT_PUBLIC_PASSPORT_DEV_MODE` | Dev | Enable client-side dev proof mode |

**x402 facilitator**

- **Devnet/Mainnet** — leave `X402_FACILITATOR_URL` unset to use Dexter’s facilitator: `https://x402.dexter.cash`.
- If you set `X402_FACILITATOR_URL`, ensure it is compatible with x402 v2 payments and supports Solana exact-scheme payments.

**Treasury**

The treasury wallet must have a USDC token account on the target network before accepting payments. Send a small USDC amount once to create the ATA.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build SDK + production app |
| `npm run start` | Run production server |
| `npm run compile:circuit` | Compile Noir passport circuit |
| `npm run copy:noir-wasm` | Copy Noir WASM to `public/wasm/` |
| `npm run copy:bb-wasm` | Copy Barretenberg WASM for serverless |
| `npm run passport:keys` | Generate issuer Ed25519 key pair |
| `npm run badge:collection` | Create the soulbound badge MPL Core collection (prints a new authority key if unset) |
| `npm run build:sdk` | Build `@zkmedusa/passport-sdk` |
| `npm run publish:sdk` | Publish SDK to npm |

---

## Deployment

Production deploys target **Vercel**. The build compiles the circuit on Linux, copies WASM artifacts, builds the SDK, then runs `next build`.

```bash
npm run copy:noir-wasm && npm run copy:bb-wasm && npm run compile:circuit && npm run build:sdk && next build
```

Set all production env vars in the Vercel dashboard. The issue route has a 300s timeout for ZK verification.

Generated at build time (not committed):

- `public/circuits/passport.json`
- `src/lib/passport/generated/passport.circuit.json`
- `src/lib/passport/wasm/barretenberg-threads.wasm.gz`

---

## Partner SDK

Full interactive docs: **[zkmedusa.com/docs](https://www.zkmedusa.com/docs)**

The SDK lets third-party apps accept Medusa Passports without rebuilding signature checks, tier logic, or registration flows.

### Install

```bash
npm install @zkmedusa/passport-sdk
```

Source lives in `packages/medusa-passport-sdk/`. Build locally with `npm run build:sdk`.

### Integration flow

1. User obtains a passport on Medusa (`/passport`).
2. User presents the passport JSON to your app.
3. Your app verifies tier and signature.
4. User connects a **claim wallet** (presale / whitelist payout address).
5. Your app registers the wallet against your campaign.

### Verify locally

Fastest path — no network call. Fetch the issuer public key from `GET /api/passport/issuer` or your env.

```typescript
import {
  parsePassportJson,
  verifyPassport,
  PASSPORT_TIERS,
} from "@zkmedusa/passport-sdk";

const passport = parsePassportJson(passportJsonFromUser);

const result = verifyPassport(passport, {
  issuerPublicKey: process.env.MEDUSA_ISSUER_PUBLIC_KEY!,
  minTier: PASSPORT_TIERS.SILVER,
});

if (result.valid) {
  console.log(`Approved: ${result.tierLabel}`);
} else {
  console.log(result.errors);
}
```

### Verify via client

```typescript
import { MedusaPassportClient } from "@zkmedusa/passport-sdk";

const client = new MedusaPassportClient({
  baseUrl: "https://www.zkmedusa.com",
});

const result = await client.verify(passport, {
  minTier: PASSPORT_TIERS.BRONZE,
});
```

### Register for whitelist / presale

Requires a partner API key scoped to one `campaignId`.

```typescript
const client = new MedusaPassportClient({
  baseUrl: "https://www.zkmedusa.com",
  apiKey: process.env.MEDUSA_PARTNER_API_KEY,
});

const registration = await client.register({
  passport,
  claimWallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  campaignId: "my-presale-q3",
});

console.log(registration.claimWallet, registration.tierLabel);
```

### Register claim wallet (user flow)

Users can register without a partner API key on `/wallet` or via the SDK:

```typescript
await client.registerClaimWallet({
  passport,
  claimWallet: "FreshClaimWalletPublicKey...",
  campaignId: "my-presale-q3",
});
```

Rotate to a new claim address for the same campaign:

```typescript
await client.rotateClaimWallet({
  passport,
  claimWallet: "NewClaimWalletPublicKey...",
  campaignId: "my-presale-q3",
});
```

Public campaigns must be listed in `MEDUSA_CLAIM_CAMPAIGN_IDS`.

### Export whitelist

```typescript
const entries = await client.getWhitelist("my-presale-q3");
```

Each entry includes `claimWallet`, `tier`, `tierLabel`, `nullifier`, and `registeredAt`.

### Tier-based gating

```typescript
const ALLOCATION_BY_TIER = { 1: 0.1, 2: 0.5, 3: 2.0 };

const result = await client.verify(passport, {
  minTier: PASSPORT_TIERS.BRONZE,
});

if (!result.valid) throw new Error("Not eligible");

const maxSol = ALLOCATION_BY_TIER[result.tier!];
```

### Soulbound badge gating

Gate by the on-chain soulbound badge instead of (or alongside) the signed
passport. Requires a DAS-capable RPC (Helius/Triton/QuickNode):

```typescript
import { fetchPassportBadges, hasPassportBadge, PASSPORT_TIERS } from "@zkmedusa/passport-sdk";

const allowed = await hasPassportBadge(walletAddress, {
  dasRpcUrl: process.env.DAS_RPC_URL!,
  collection: process.env.MEDUSA_BADGE_COLLECTION,
  minTier: PASSPORT_TIERS.SILVER,
  requireFrozen: true, // soulbound only (default)
});

// Or read full badge details:
const badges = await fetchPassportBadges(walletAddress, {
  dasRpcUrl: process.env.DAS_RPC_URL!,
  collection: process.env.MEDUSA_BADGE_COLLECTION,
});
// badges[0] => { assetId, owner, frozen, tier, tierLabel, nullifier, expiresAt }
```

The `client.getBadges(owner, opts)` / `client.hasBadge(owner, opts)` methods
wrap the same helpers. The authoritative tier is always the signed passport;
on-chain attributes are a convenience mirror.

### Partner API keys

Operators configure keys server-side:

```env
MEDUSA_PARTNER_API_KEYS=my-presale-q3:sk_live_partner_key,dao-whitelist:sk_live_other_key
```

Each key maps to one `campaignId`. Pass it as `Authorization: Bearer sk_live_partner_key`.

### HTTP API

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/passport/issuer` | GET | — | Issuer public key + policy version |
| `/api/passport/verify` | GET | — | Policy metadata |
| `/api/passport/verify` | POST | — | Verify a passport |
| `/api/partner/register` | POST | Bearer | Register passport + claim wallet |
| `/api/passport/claim/register` | POST | — | User claim wallet register |
| `/api/passport/claim/rotate` | POST | — | User claim wallet rotate |
| `/api/passport/badge/mint` | POST | — | Mint soulbound badge to a claim wallet |
| `/api/passport/badge/metadata` | GET | — | Badge NFT metadata JSON |
| `/api/partner/whitelist` | GET | Bearer | Export campaign whitelist |

**Verify**

```bash
curl -X POST https://www.zkmedusa.com/api/passport/verify \
  -H "Content-Type: application/json" \
  -d @passport.json
```

**Register**

```bash
curl -X POST https://www.zkmedusa.com/api/partner/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_partner_key" \
  -d '{
    "passport": { ... },
    "claimWallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "campaignId": "my-presale-q3"
  }'
```

**Claim register (public)**

```bash
curl -X POST https://www.zkmedusa.com/api/passport/claim/register \
  -H "Content-Type: application/json" \
  -d '{
    "passport": { ... },
    "claimWallet": "FreshClaimWalletPublicKey...",
    "campaignId": "my-presale-q3"
  }'
```

**Issuer**

```bash
curl https://www.zkmedusa.com/api/passport/issuer
```

### SDK exports

```typescript
// Client
MedusaPassportClient

// Verification
parsePassportJson, verifyPassport, verifyPassportSignature

// Soulbound badge gating (DAS)
fetchPassportBadges, hasPassportBadge

// Constants
PASSPORT_POLICY_VERSION, PASSPORT_TIERS, TIER_LABELS

// Types
MedusaPassport, VerifyPassportResult, RegisterPassportResult, WhitelistEntry, ...

// Utils
hexToBytes, isValidSolanaAddress
```

Example Next.js route: `packages/medusa-passport-sdk/examples/nextjs-whitelist-route.ts`

### Privacy model

- Passports prove eligibility without exposing the proving wallet.
- Registration links a passport to a **claim wallet** for presale or whitelist payout.
- Claim wallet secret keys stay in the browser unless the user exports a backup JSON.
- Each nullifier can register **once per campaign** (anti-sybil).
- Partners see tier and validity — not raw wallet history.

Works in **Node.js**, **Next.js API routes**, and the **browser** (local verify only).

---

## License

[MIT](LICENSE)
