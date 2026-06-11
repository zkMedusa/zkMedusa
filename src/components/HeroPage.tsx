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
        {/* Top Left */}
        <a href="https://pump.fun/J7QoLWaBuqGuD1RL89BNa7hBDYbQtEm8i91MhbN8pump" target="_blank" rel="noopener noreferrer">
          <div
              className="absolute top-[10%] left-[10%] md:top-8 md:left-8 text-xl md:text-2xl text-white md:translate-y-[110px] md:translate-x-[200px] z-20 font-['BlueScreen']">
            &#47;&#47; PUMPFUN
          </div>
        </a>

        <div
            className="absolute top-[25%] left-[15%] md:top-8 md:left-8 text-[8px] md:text-[10px] font-bold text-gray-300 md:translate-y-[350px] md:translate-x-[180px] z-20 flex flex-col font-['PerfectDOS']">
          {" "}
          <span>686564757361</span>
          <span>686564757361</span>
          <span>686564757361</span>
        </div>

        {/* Top Right */}
        <a href="#about" rel="noopener noreferrer">
          <div
              className="absolute top-[10%] right-[10%] md:top-8 md:right-8 text-xl md:text-2xl text-white md:translate-y-[70px] md:translate-x-[-200px] z-20 font-['BlueScreen']">
            &#47;&#47; ABOUT
          </div>
        </a>

        {/* Bottom Left */}
        <a href="https://x.com/m3dusadao" target="_blank" rel="noopener noreferrer">
          <div
              className="absolute bottom-[20%] left-[10%] md:bottom-8 md:left-8 text-xl md:text-2xl text-white md:translate-y-[-70px] md:translate-x-[300px] z-20 font-['BlueScreen']">
            &#47;&#47; TWITTER
          </div>
        </a>

        {/* Bottom Right */}
        <a href="https://t.me/MedusaDAOPortal" target="_blank" rel="noopener noreferrer">
          <div
              className="absolute bottom-[30%] right-[10%] md:bottom-8 md:right-8 text-xl md:text-2xl text-white md:translate-y-[-240px] md:translate-x-[-300px] z-20 font-['BlueScreen']">
            &#47;&#47; TELEGRAM
          </div>
        </a>
          <div
              className="absolute bottom-[15%] right-[15%] md:bottom-8 md:right-8 text-[8px] md:text-[10px] font-bold text-gray-300 md:translate-y-[-60px] md:translate-x-[-100px] z-20 flex flex-col font-['PerfectDOS']">
            <span>110110141001011100100111010111100111110001</span>
            <span>110110110010111001001110101111001111100001</span>
            <span>110110110010111001001110101111001111100001</span>
          </div>

          <h1 className="absolute text-4xl md:text-6xl text-black z-20 [text-shadow:_-2px_2px_0_#fff,_2px_2px_0_#fff,_2px_-2px_0_#fff,_-2px_-2px_0_#fff] font-['BlueScreen']">
            MEDUSA
          </h1>
          <img src="/head.webp" alt="head" className="h-[300px] md:h-[600px] w-[280px] md:w-[560px] z-10"/>
      </div>
);
};

export default HeroPage;
