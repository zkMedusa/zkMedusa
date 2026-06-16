# @zkmedusa/passport-sdk

Use Medusa Passports in your app, presale, or whitelist without rebuilding verification logic.

**Full documentation:** [zkmedusa.com/docs](https://www.zkmedusa.com/docs)

## Install

```bash
npm install @zkmedusa/passport-sdk
```

## Quick start — verify locally

```typescript
import {
  parsePassportJson,
  verifyPassport,
} from "@zkmedusa/passport-sdk";

const passport = parsePassportJson(passportJsonFromUser);

const result = verifyPassport(passport, {
  issuerPublicKey: process.env.MEDUSA_ISSUER_PUBLIC_KEY!,
  minTier: 2,
});

if (result.valid) {
  console.log(`Approved: ${result.tierLabel}`);
} else {
  console.log(result.errors);
}
```

Fetch the issuer public key dynamically:

```typescript
import { MedusaPassportClient } from "@zkmedusa/passport-sdk";

const client = new MedusaPassportClient({
  baseUrl: "https://www.zkmedusa.com",
});

const result = await client.verify(passport);
```

## Register for whitelist / presale (partner backend)

Partners register claim wallets from their backend with a Bearer API key scoped to one `campaignId`.

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

Pull the whitelist for your campaign:

```typescript
const entries = await client.getWhitelist("my-presale-q3");
```

## Claim wallet (user flow)

Since **v0.2.0**, users can register a **claim wallet** without a partner API key — for apps that let users submit their own claim address after minting a passport.

No `apiKey` is required. The campaign must be enabled on the Medusa server (`MEDUSA_CLAIM_CAMPAIGN_IDS`).

```typescript
const client = new MedusaPassportClient({
  baseUrl: "https://www.zkmedusa.com",
});

await client.registerClaimWallet({
  passport,
  claimWallet: "FreshClaimWalletPublicKey...",
  campaignId: "my-presale-q3",
});
```

Rotate to a new claim address for the same campaign (after generating a fresh wallet):

```typescript
await client.rotateClaimWallet({
  passport,
  claimWallet: "NewClaimWalletPublicKey...",
  campaignId: "my-presale-q3",
});
```

Users can also manage claim wallets in the browser at [zkmedusa.com/wallet](https://www.zkmedusa.com/wallet).

**Partner vs user registration**

| Method | Auth | Endpoint |
| --- | --- | --- |
| `client.register()` | Bearer API key | `/api/partner/register` |
| `client.registerClaimWallet()` | None | `/api/passport/claim/register` |
| `client.rotateClaimWallet()` | None | `/api/passport/claim/rotate` |

## Partner API keys

Medusa operators create keys in `.env`:

```env
MEDUSA_PARTNER_API_KEYS=my-presale-q3:sk_live_partner_key
MEDUSA_CLAIM_CAMPAIGN_IDS=my-presale-q3,medusa-claim
```

Each partner key is scoped to one `campaignId`. Public claim routes only accept campaign IDs listed in `MEDUSA_CLAIM_CAMPAIGN_IDS`.

## Endpoints used by the SDK

| Endpoint | Purpose |
| --- | --- |
| `GET /api/passport/issuer` | Issuer public key |
| `GET /api/passport/verify` | Policy metadata |
| `POST /api/passport/verify` | Remote passport verification |
| `POST /api/partner/register` | Partner register (Bearer) |
| `POST /api/passport/claim/register` | User claim wallet register |
| `POST /api/passport/claim/rotate` | User claim wallet rotate |
| `GET /api/partner/whitelist?campaignId=` | Export campaign whitelist |

## Tier gating example

```typescript
const PRESALE_MIN_TIER = 1;
const ALLOCATION_BY_TIER = { 1: 0.1, 2: 0.5, 3: 2 };

const result = await client.verify(passport, { minTier: PRESALE_MIN_TIER });
if (!result.valid) throw new Error("Not eligible");

const maxSol = ALLOCATION_BY_TIER[result.tier!];
```

## Privacy model

- The passport proves eligibility **without** revealing the proving wallet.
- Registration links the passport to a **claim wallet** for whitelist/presale payout.
- Claim wallet secret keys stay in the user's browser unless they export a backup JSON.
- One passport nullifier can register once per campaign (anti-sybil).

## Browser + Node

The SDK works in Node.js, Next.js API routes, and the browser (local verify only).

## Publishing this package (maintainers)

From the monorepo root:

```bash
# 1. Log in to npm (once per machine)
npm login

# 2. Build the SDK (runs automatically before publish via prepublishOnly)
npm run build:sdk

# 3. Publish to npm
npm run publish:sdk
```

Or from `packages/medusa-passport-sdk/`:

```bash
npm run build
npm publish --access public
```

Bump `version` in `packages/medusa-passport-sdk/package.json` before each publish (semver). After publishing, integrators update with:

```bash
npm install @zkmedusa/passport-sdk@latest
```
