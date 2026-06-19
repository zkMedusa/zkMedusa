import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyPillarLayout from "@/components/StickyPillarLayout";
import PartnerTokenSection from "@/components/partner/PartnerTokenSection";
import { getPartnerBySlug, getPartnerThreshold } from "@/lib/partner/partners";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Hidden, link-only page: keep it out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PartnerPage({ params }: PageProps) {
  const { slug } = await params;
  const partner = getPartnerBySlug(slug);

  if (!partner) {
    notFound();
  }

  const threshold = getPartnerThreshold(partner);

  return (
    <>
      <Header />
      <StickyPillarLayout>
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <header className="space-y-3">
            <p
              className="font-['BlueScreen'] text-xs uppercase tracking-widest"
              style={{ color: partner.branding.accent }}
            >
              // {partner.name} x Medusa
            </p>
            <h1 className="font-['PerfectDOS'] text-2xl md:text-3xl text-white uppercase">
              {partner.name} Token Passport
            </h1>
            <p className="font-['PerfectDOS'] text-sm text-white/70 normal-case leading-relaxed">
              {partner.branding.tagline} Prove you hold at least{" "}
              <span className="text-white">{threshold}</span> tokens. Medusa
              checks your balance on-chain and issues a private{" "}
              {partner.validityHours}h passport. Your address is encrypted at
              rest and only used to keep your status current.
            </p>
          </header>

        <PartnerTokenSection
          partner={{
            id: partner.id,
            name: partner.name,
            tokenAddress: partner.tokenAddress,
            threshold,
            validityHours: partner.validityHours,
            accent: partner.branding.accent,
            tagline: partner.branding.tagline,
            collectTelegram: partner.collectTelegram,
          }}
        />

          <p className="font-['PerfectDOS'] text-[11px] text-white/40 normal-case leading-relaxed">
            Medusa re-checks holdings automatically every {partner.validityHours}h,
            so your passport stays current and access is revoked if you stop
            holding — no need to re-verify manually. Your address is stored
            encrypted, never in plain text. {partner.name} only sees your
            Telegram username and eligibility — not your wallet or balance.
          </p>
        </div>
      </StickyPillarLayout>
      <Footer />
    </>
  );
}
