# @medusa/passport-sdk

Use Medusa Passports in your app, presale, or whitelist without rebuilding verification logic.

## Install

```bash
npm install @medusa/passport-sdk
```

## Quick start — verify locally

```typescript
import {
  parsePassportJson,
  verifyPassport,
} from "@medusa/passport-sdk";

const passport = parsePassportJson(passportJsonFromUser);

const result = verifyPassport(passport, {
  issuerPublicKey: "749d6135f3d883950ff82f82bc2119e8b6e469ebfc4163dd10e1cc079b723565",
  minTier: 2, // require SILVER+
});

if (result.valid) {
  console.log(`Approved: ${result.tierLabel}`);
} else {
  console.log(result.errors);
}
```

Fetch the issuer public key dynamically:

```typescript
import { MedusaPassportClient } from "@medusa/passport-sdk";

const client = new MedusaPassportClient({
  baseUrl: "https://your-medusa-app.com",
});

const result = await client.verify(passport);
```

## Register for whitelist / presale

Users present a passport, then link a **claim wallet** (the address that receives presale access).

```typescript
const client = new MedusaPassportClient({
  baseUrl: "https://your-medusa-app.com",
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
// [{ claimWallet, tier, tierLabel, nullifier, registeredAt }, ...]
```

## Partner API keys

Medusa operators create keys in `.env`:

```env
MEDUSA_PARTNER_API_KEYS=my-presale-q3:sk_live_partner_key
```

Each key is scoped to one `campaignId`.

## Endpoints used by the SDK

| Endpoint | Purpose |
|----------|---------|
| `GET /api/passport/issuer` | Issuer public key |
| `GET /api/passport/verify` | Policy metadata |
| `POST /api/passport/verify` | Remote passport verification |
| `POST /api/partner/register` | Register passport + claim wallet |
| `GET /api/partner/whitelist?campaignId=` | Export campaign whitelist |

## Tier gating example

```typescript
const PRESALE_MIN_TIER = 1; // bronze
const ALLOCATION_BY_TIER = { 1: 0.1, 2: 0.5, 3: 2 };

const result = await client.verify(passport, { minTier: PRESALE_MIN_TIER });
if (!result.valid) throw new Error("Not eligible");

const maxSol = ALLOCATION_BY_TIER[result.tier!];
```

## Privacy model

- The passport proves eligibility **without** revealing the proving wallet.
- Registration links the passport to a **claim wallet** for whitelist/presale payout.
- One passport nullifier can register once per campaign (anti-sybil).

## Browser + Node

The SDK works in Node.js, Next.js API routes, and the browser (local verify only).
