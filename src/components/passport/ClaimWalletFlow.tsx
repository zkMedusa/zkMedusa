"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadPassportFromSession } from "@/lib/passport/claimWallet.client";
import ClaimWalletPanel from "./ClaimWalletPanel";
import StickyPillarLayout from "@/components/StickyPillarLayout";
import type { MedusaPassport } from "@/lib/passport/types";

export default function ClaimWalletFlow() {
  const [passport, setPassport] = useState<MedusaPassport | null>(null);

  useEffect(() => {
    try {
      const raw = loadPassportFromSession();
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as MedusaPassport;
      if (parsed.type === "medusa_passport_v1") {
        setPassport(parsed);
      }
    } catch {
      window.sessionStorage.removeItem("medusa-passport-active");
    }
  }, []);

  return (
    <StickyPillarLayout>
        <div className="max-w-2xl mx-auto space-y-8">
          <header className="space-y-3 text-center md:text-left">
            <p className="font-['BlueScreen'] text-2xl md:text-4xl">
              &#47;&#47; MEDUSA WALLET
            </p>
            <p className="font-['PerfectDOS'] text-sm text-white/60 normal-case leading-relaxed">
              Generate a fresh claim wallet for presales and allowlists. Your
              proving wallet stays private — the passport links reputation to a
              clean address with no history.
            </p>
          </header>

          <ClaimWalletPanel passport={passport} onPassportLoad={setPassport} />

          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <Link
              href="/passport"
              className="inline-flex items-center px-6 py-3 border border-white/40 font-['PerfectDOS'] uppercase text-sm hover:bg-white hover:text-black transition-colors"
            >
              Mint passport →
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center px-6 py-3 border border-white/40 font-['PerfectDOS'] uppercase text-sm hover:bg-white hover:text-black transition-colors"
            >
              SDK docs →
            </Link>
          </div>
        </div>
    </StickyPillarLayout>
  );
}
