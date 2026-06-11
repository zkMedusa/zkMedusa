import React from "react";

const HeroPage = () => {
  return (
    <div
      className="h-screen w-full bg-center flex items-center justify-center relative"
      style={{
        backgroundImage: `url('/mainbg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute top-[25%] left-[15%] md:top-8 md:left-8 text-[8px] md:text-[10px] font-bold text-gray-300 md:translate-y-[350px] md:translate-x-[180px] z-20 flex flex-col font-['PerfectDOS']">
        <span>686564757361</span>
        <span>686564757361</span>
        <span>686564757361</span>
      </div>

      <div className="absolute bottom-[15%] right-[15%] md:bottom-8 md:right-8 text-[8px] md:text-[10px] font-bold text-gray-300 md:translate-y-[-60px] md:translate-x-[-100px] z-20 flex flex-col font-['PerfectDOS']">
        <span>110110141001011100100111010111100111110001</span>
        <span>110110110010111001001110101111001111100001</span>
        <span>110110110010111001001110101111001111100001</span>
      </div>

      <h1 className="absolute text-4xl md:text-6xl text-black z-20 [text-shadow:_-2px_2px_0_#fff,_2px_2px_0_#fff,_2px_-2px_0_#fff,_-2px_-2px_0_#fff] font-['BlueScreen']">
        MEDUSA
      </h1>
      <p className="absolute top-[58%] md:top-[62%] text-[10px] md:text-sm text-black z-20 [text-shadow:_-1px_1px_0_#fff,_1px_1px_0_#fff,_1px_-1px_0_#fff,_-1px_-1px_0_#fff] font-['PerfectDOS'] uppercase tracking-wider text-center px-4">
        Prove your wallet. Reveal nothing. ZK · x402 · Solana
      </p>
      <img
        src="/head.webp"
        alt="head"
        className="h-[300px] md:h-[600px] w-[280px] md:w-[560px] z-10"
      />
    </div>
  );
};

export default HeroPage;
