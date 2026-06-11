import React from "react";

const SlashScreenInfo = () => {
  return (
    <div className="h-screen w-full bg-black bg-center flex items-center justify-center relative">
      <div className="absolute top-4 md:top-16 text-white text-xl md:text-4xl font-['BlueScreen'] text-center w-full md:w-auto">
        <p>&#47;&#47; HOW IT WORKS</p>
      </div>

      <div className="absolute">
        <img src="/dots.gif" alt="Loading dots" className="h-[32rem] w-[32rem] md:h-[48rem] md:w-[48rem] object-contain" />
      </div>

      <div className="absolute top-20 md:top-32 left-4 md:left-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row">
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Your wallet history stays yours. Medusa Passport lets you show you meet age, activity, and volume thresholds — while keeping the underlying transactions and identity private from apps and partners.
        </p>
        <div className="hidden md:block flex-grow border-r border-white h-[100px] translate-y-[80px] translate-x-[50px] rotate-[135deg] ml-4"></div>
      </div>

      <div className="absolute md:top-32 right-4 md:right-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row top-[18rem]">
        <div className="hidden md:block border-l border-white h-[100px] translate-y-[80px] translate-x-[-70px] rotate-[45deg] mr-4"></div>
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Zero-knowledge proofs run in your browser. You prove the statements are true — wallet age, tx count, tier — without sending raw chain data to our servers or to integrators.
        </p>
      </div>

      <div className="absolute bottom-[180px] md:bottom-32 left-4 md:left-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row bottom-[17rem]">
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Issuance uses x402 — an open payment protocol on Solana. Pay USDC to mint; the payment settles on-chain while your credential stays a separate, privacy-preserving artifact you control.
        </p>
        <div className="hidden md:block flex-grow border-r border-white h-[100px] translate-y-[-40px] translate-x-[40px] rotate-45 ml-4"></div>
      </div>

      <div className="absolute bottom-20 md:bottom-32 right-4 md:right-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row">
        <div className="hidden md:block border-l border-white h-[100px] rotate-[135deg] translate-y-[-60px] translate-x-[-50px] mr-4"></div>
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Partners verify passports with our SDK — locally or via API — for allowlists, presales, and gated access. They learn tier and validity, not your wallet graph.
        </p>
      </div>
    </div>
  );
};

export default SlashScreenInfo;
