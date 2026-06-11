"use client";

import {
  formatPassportDate,
  formatPassportId,
  getTierAccentColor,
} from "@/lib/passport/format";
import type { MedusaPassport } from "@/lib/passport/types";

interface PassportVisualCardProps {
  passport: MedusaPassport;
}

export default function PassportVisualCard({ passport }: PassportVisualCardProps) {
  const passportId = formatPassportId(passport.nullifier);
  const tierColor = getTierAccentColor(passport.statement.tierLabel);

  return (
    <div
      className="relative w-full max-w-[420px] mx-auto overflow-hidden border border-white/30 bg-black select-none"
      style={{ aspectRatio: "1.586 / 1" }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "url('/middlenav.gif')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="relative h-full flex flex-col justify-between p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-['BlueScreen'] text-lg md:text-xl text-white leading-none">
              &#47;&#47; MEDUSA
            </p>
            <p className="font-['PerfectDOS'] text-[10px] md:text-xs text-white/50 uppercase mt-1 tracking-wider">
              Privacy passport
            </p>
          </div>
          <div
            className="border px-2 py-1 font-['PerfectDOS'] text-[10px] uppercase shrink-0"
            style={{ borderColor: tierColor, color: tierColor }}
          >
            {passport.statement.tierLabel}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-['PerfectDOS'] text-[9px] text-white/40 uppercase tracking-widest">
              Passport ID
            </p>
            <p className="font-['PerfectDOS'] text-sm md:text-base text-white tracking-wide mt-0.5">
              {passportId}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-['PerfectDOS'] text-[9px] text-white/40 uppercase">
                Issued
              </p>
              <p className="font-['PerfectDOS'] text-xs text-white/80 mt-0.5">
                {formatPassportDate(passport.issuedAt)}
              </p>
            </div>
            <div>
              <p className="font-['PerfectDOS'] text-[9px] text-white/40 uppercase">
                Expires
              </p>
              <p className="font-['PerfectDOS'] text-xs text-white/80 mt-0.5">
                {formatPassportDate(passport.expiresAt)}
              </p>
            </div>
            <div>
              <p className="font-['PerfectDOS'] text-[9px] text-white/40 uppercase">
                Chain
              </p>
              <p className="font-['PerfectDOS'] text-xs text-white/80 mt-0.5 uppercase">
                {passport.chain}
              </p>
            </div>
            <div>
              <p className="font-['PerfectDOS'] text-[9px] text-white/40 uppercase">
                Status
              </p>
              <p className="font-['PerfectDOS'] text-xs text-green-400 mt-0.5 uppercase">
                Verified
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 border-t border-white/15 pt-3">
          <p className="font-['PerfectDOS'] text-[8px] text-white/30 uppercase leading-relaxed max-w-[70%]">
            Anonymous eligibility credential. No wallet address embedded.
          </p>
          <div
            className="h-10 w-10 border shrink-0 flex items-center justify-center font-['BlueScreen'] text-[8px] text-center leading-tight"
            style={{ borderColor: tierColor, color: tierColor }}
          >
            ZK
            <br />
            OK
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 left-0 w-full h-1"
        style={{ backgroundColor: tierColor }}
      />
    </div>
  );
}
