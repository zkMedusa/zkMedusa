import Link from "next/link";
import CodeBlock from "./CodeBlock";
import { PASSPORT_REQUIREMENTS, PASSPORT_TIERS } from "@/lib/passport/config";

interface SdkDocsProps {
  baseUrl: string;
  issuerPublicKey: string;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="font-['BlueScreen'] text-xl md:text-2xl text-white">
        &#47;&#47; {title}
      </h2>
      <div className="space-y-4 font-['PerfectDOS'] text-sm md:text-base text-white/80 leading-relaxed [&>p]:uppercase">
        {children}
      </div>
    </section>
  );
}

export default function SdkDocs({ baseUrl, issuerPublicKey }: SdkDocsProps) {
  const npmPackageUrl =
    "https://www.npmjs.com/package/@zkmedusa/passport-sdk";
  const installCode = `npm install @zkmedusa/passport-sdk`;

  const verifyLocalCode = `import {
  parsePassportJson,
  verifyPassport,
  PASSPORT_TIERS,
} from "@zkmedusa/passport-sdk";

const passport = parsePassportJson(passportJsonFromUser);

const result = verifyPassport(passport, {
  issuerPublicKey: "${issuerPublicKey}",
  minTier: PASSPORT_TIERS.SILVER,
});

if (result.valid) {
  console.log(\`Approved: \${result.tierLabel}\`);
} else {
  console.log(result.errors);
}`;

  const clientVerifyCode = `import { MedusaPassportClient } from "@zkmedusa/passport-sdk";

const client = new MedusaPassportClient({
  baseUrl: "${baseUrl}",
});

const result = await client.verify(passport);

if (!result.valid) {
  throw new Error(result.errors.join(", "));
}`;

  const registerCode = `import { MedusaPassportClient } from "@zkmedusa/passport-sdk";

const client = new MedusaPassportClient({
  baseUrl: "${baseUrl}",
  apiKey: process.env.MEDUSA_PARTNER_API_KEY,
});

const registration = await client.register({
  passport,
  claimWallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  campaignId: "my-presale-q3",
});

console.log(registration.claimWallet, registration.tierLabel);`;

  const whitelistCode = `const entries = await client.getWhitelist("my-presale-q3");

for (const entry of entries) {
  console.log(entry.claimWallet, entry.tierLabel);
}`;

  const nextRouteCode = `import {
  MedusaPassportClient,
  PASSPORT_TIERS,
  type MedusaPassport,
} from "@zkmedusa/passport-sdk";

const client = new MedusaPassportClient({
  baseUrl: process.env.MEDUSA_PASSPORT_BASE_URL!,
  apiKey: process.env.MEDUSA_PARTNER_API_KEY!,
});

export async function POST(request: Request) {
  const { passport, claimWallet } = (await request.json()) as {
    passport: MedusaPassport;
    claimWallet: string;
  };

  const verification = await client.verify(passport, {
    minTier: PASSPORT_TIERS.BRONZE,
  });

  if (!verification.valid) {
    return Response.json({ error: verification.errors.join(" ") }, { status: 400 });
  }

  const registration = await client.register({
    passport,
    claimWallet,
    campaignId: process.env.MEDUSA_PARTNER_CAMPAIGN_ID!,
  });

  return Response.json({
    whitelisted: true,
    tier: registration.tierLabel,
    wallet: registration.claimWallet,
  });
}`;

  const tierGateCode = `const ALLOCATION_BY_TIER = {
  1: 0.1, // BRONZE
  2: 0.5, // SILVER
  3: 2.0, // GOLD
};

const result = await client.verify(passport, {
  minTier: PASSPORT_TIERS.BRONZE,
});

const maxSol = ALLOCATION_BY_TIER[result.tier!];`;

  const partnerEnvCode = `# One API key per campaign
MEDUSA_PARTNER_API_KEYS=my-presale-q3:sk_live_partner_key,dao-whitelist:sk_live_other_key`;

  const curlVerifyCode = `curl -X POST ${baseUrl}/api/passport/verify \\
  -H "Content-Type: application/json" \\
  -d @passport.json`;

  const curlRegisterCode = `curl -X POST ${baseUrl}/api/partner/register \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk_live_partner_key" \\
  -d '{
    "passport": { ... },
    "claimWallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "campaignId": "my-presale-q3"
  }'`;

  const nav = [
    { id: "overview", label: "Overview" },
    { id: "install", label: "Install" },
    { id: "verify", label: "Verify" },
    { id: "register", label: "Register" },
    { id: "whitelist", label: "Whitelist" },
    { id: "tiers", label: "Tiers" },
    { id: "api", label: "API" },
    { id: "privacy", label: "Privacy" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-8 lg:self-start space-y-4">
            <p className="font-['BlueScreen'] text-2xl md:text-3xl">
              &#47;&#47; SDK DOCS
            </p>
            <nav className="flex lg:flex-col flex-wrap gap-2 font-['PerfectDOS'] text-xs uppercase">
              {nav.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="border border-white/20 px-3 py-2 hover:bg-white hover:text-black transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="hidden lg:block space-y-2 font-['PerfectDOS'] text-xs uppercase text-white/60">
              <a
                href={npmPackageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-white"
              >
                → npm package
              </a>
              <Link href="/passport" className="block hover:text-white">
                → Get a passport
              </Link>
            </div>
          </aside>

          <main className="space-y-12">
            <header className="space-y-4 border-b border-white/20 pb-8">
              <p className="font-['BlueScreen'] text-3xl md:text-5xl">
                @zkmedusa/passport-sdk
              </p>
              <p className="font-['PerfectDOS'] text-sm md:text-base uppercase text-white/80 leading-relaxed max-w-3xl">
                Integrate Medusa Passports into your app, presale, or whitelist.
                Verify eligibility locally or via API, then register claim wallets
                for gated access.
              </p>
              <div className="flex flex-wrap gap-3 font-['PerfectDOS'] text-xs uppercase">
                <a
                  href={npmPackageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-white/30 px-3 py-1 hover:bg-white hover:text-black transition-colors"
                >
                  npm package
                </a>
                <span className="border border-white/30 px-3 py-1">node + browser</span>
                <span className="border border-white/30 px-3 py-1">solana</span>
              </div>
            </header>

            <Section id="overview" title="Overview">
              <p>
                The SDK lets third-party apps accept Medusa Passports without
                rebuilding signature checks, tier logic, or registration flows.
              </p>
              <ol className="list-decimal list-inside space-y-2 normal-case">
                <li>User obtains a passport on Medusa</li>
                <li>User presents passport JSON to your app</li>
                <li>Your app verifies tier + signature</li>
                <li>User connects a claim wallet for whitelist / presale</li>
                <li>Your app registers or stores the wallet</li>
              </ol>
            </Section>

            <Section id="install" title="Install">
              <p>
                Published on npm:{" "}
                <a
                  href={npmPackageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-4 hover:text-white/80 normal-case"
                >
                  @zkmedusa/passport-sdk
                </a>
              </p>
              <CodeBlock title="Terminal" code={installCode} language="bash" />
            </Section>

            <Section id="verify" title="Verify">
              <p>
                Verify locally with the issuer public key (fastest, no network call):
              </p>
              <CodeBlock title="Local verification" code={verifyLocalCode} />
              <p>Or use the client to fetch the issuer key and verify remotely:</p>
              <CodeBlock title="Client verification" code={clientVerifyCode} />
              <p>Current issuer public key:</p>
              <CodeBlock
                title="Issuer public key"
                code={issuerPublicKey}
                language="hex"
              />
              <p>Live issuer endpoint:</p>
              <CodeBlock
                title="GET /api/passport/issuer"
                code={`${baseUrl}/api/passport/issuer`}
                language="url"
              />
            </Section>

            <Section id="register" title="Register">
              <p>
                After verification, register a claim wallet for your campaign.
                Requires a partner API key scoped to one campaignId.
              </p>
              <CodeBlock title="Partner registration" code={registerCode} />
              <CodeBlock title="Partner env" code={partnerEnvCode} language="env" />
              <p>
                Request a partner key from the Medusa team, or configure your own
                server with MEDUSA_PARTNER_API_KEYS.
              </p>
            </Section>

            <Section id="whitelist" title="Whitelist">
              <p>Export all registered wallets for a campaign:</p>
              <CodeBlock title="Fetch whitelist" code={whitelistCode} />
              <p>Example Next.js API route for a partner app:</p>
              <CodeBlock title="app/api/whitelist/route.ts" code={nextRouteCode} />
            </Section>

            <Section id="tiers" title="Tiers">
              <div className="grid gap-3 md:grid-cols-3 normal-case">
                <div className="border border-white/20 p-4">
                  <p className="text-white font-['BlueScreen'] text-lg mb-2">BRONZE</p>
                  <p>Tier {PASSPORT_TIERS.BRONZE}</p>
                  <p>≥ 10 SOL volume (90d)</p>
                </div>
                <div className="border border-white/20 p-4">
                  <p className="text-white font-['BlueScreen'] text-lg mb-2">SILVER</p>
                  <p>Tier {PASSPORT_TIERS.SILVER}</p>
                  <p>≥ 50 SOL volume (90d)</p>
                </div>
                <div className="border border-white/20 p-4">
                  <p className="text-white font-['BlueScreen'] text-lg mb-2">GOLD</p>
                  <p>Tier {PASSPORT_TIERS.GOLD}</p>
                  <p>≥ 200 SOL volume (90d)</p>
                </div>
              </div>
              <p className="normal-case">
                Gates: wallet age ≥ {PASSPORT_REQUIREMENTS.minWalletAgeDays} days,
                transactions ≥ {PASSPORT_REQUIREMENTS.minTransactionCount}.
              </p>
              <CodeBlock title="Tier-based allocation" code={tierGateCode} />
            </Section>

            <Section id="api" title="API">
              <div className="overflow-x-auto normal-case">
                <table className="w-full text-left text-xs md:text-sm border border-white/20">
                  <thead className="bg-white/5 font-['PerfectDOS'] uppercase">
                    <tr>
                      <th className="p-3 border-b border-white/20">Endpoint</th>
                      <th className="p-3 border-b border-white/20">Method</th>
                      <th className="p-3 border-b border-white/20">Auth</th>
                      <th className="p-3 border-b border-white/20">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-white/80">
                    <tr className="border-b border-white/10">
                      <td className="p-3">/api/passport/issuer</td>
                      <td className="p-3">GET</td>
                      <td className="p-3">—</td>
                      <td className="p-3 font-['PerfectDOS']">Issuer public key</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="p-3">/api/passport/verify</td>
                      <td className="p-3">GET</td>
                      <td className="p-3">—</td>
                      <td className="p-3 font-['PerfectDOS']">Policy metadata</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="p-3">/api/passport/verify</td>
                      <td className="p-3">POST</td>
                      <td className="p-3">—</td>
                      <td className="p-3 font-['PerfectDOS']">Verify passport</td>
                    </tr>
                    <tr className="border-b border-white/10">
                      <td className="p-3">/api/partner/register</td>
                      <td className="p-3">POST</td>
                      <td className="p-3">Bearer</td>
                      <td className="p-3 font-['PerfectDOS']">Register claim wallet</td>
                    </tr>
                    <tr>
                      <td className="p-3">/api/partner/whitelist</td>
                      <td className="p-3">GET</td>
                      <td className="p-3">Bearer</td>
                      <td className="p-3 font-['PerfectDOS']">Export whitelist</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <CodeBlock title="curl — verify" code={curlVerifyCode} language="bash" />
              <CodeBlock title="curl — register" code={curlRegisterCode} language="bash" />
            </Section>

            <Section id="privacy" title="Privacy">
              <ul className="list-disc list-inside space-y-2 normal-case">
                <li>
                  Passports prove eligibility without exposing the proving wallet.
                </li>
                <li>
                  Registration links a passport to a claim wallet for presale /
                  whitelist payout.
                </li>
                <li>
                  Each nullifier can register once per campaign (anti-sybil).
                </li>
                <li>
                  Partners never see raw wallet history — only tier + validity.
                </li>
              </ul>
              <div className="flex flex-wrap gap-3 pt-4">
                <Link
                  href="/passport"
                  className="px-4 py-3 border border-white font-['PerfectDOS'] uppercase text-sm hover:bg-white hover:text-black transition-colors"
                >
                  Get passport
                </Link>
              </div>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
}
