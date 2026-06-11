import React from "react";

const PillarPage = () => {
  return (
    <div id="about" className="min-h-screen w-full bg-black bg-center flex items-center justify-between relative overflow-x-hidden">
      {/* Left pillar */}
      <img
        src="/pillar.gif"
        alt="Left Pillar"
        className="h-screen object-cover w-[15%] ml-0 md:ml-10 lg:ml-20 py-4 md:py-8 lg:py-10"
      />

      {/* Center content */}
      <div className="flex flex-col items-center absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 px-2 md:px-8">
        <h1 className="text-white text-2xl md:text-6xl lg:text-8xl mb-2 md:mb-4 tracking-wider font-['BlueScreen'] text-center">
            &#47;&#47; MEDUSA
        </h1>
        <p className="text-white text-center xl:pb-20 text-xs md:text-base max-w-[240px] md:max-w-xl lg:max-w-2xl mb-4 md:mb-8 uppercase leading-relaxed font-['PerfectDOS'] mt-3 md:mt-8 lg:mt-10">
            Medusa is a privacy project on Solana. Apps often need proof that a wallet is real and active — but asking you to connect and expose your full history is surveillance. We issue a passport backed by zero-knowledge proofs so you can prove eligibility without revealing your address or balances.
        </p>
      </div>

      {/* 3D Model/Image */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-xl">
        <img
          src="/bust.png"
          alt="Wireframe Head"
          className="w-64 md:w-96 h-auto mx-auto"
        />
      </div>

      {/* Right pillar */}
      <img
        src="/pillar.gif"
        alt="Right Pillar"
        className="h-screen object-cover w-[15%] mr-0 md:mr-10 lg:mr-20 py-4 md:py-8 lg:py-10"
      />
    </div>
  );
};

export default PillarPage;
