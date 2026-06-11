import React from "react";

const ShowBodiesPage = () => {
  return (
    <div className="min-h-screen w-full bg-black bg-center flex flex-col md:flex-row items-center justify-between relative">
      <div className="w-full md:w-[calc(40%-1rem)] px-4 md:ml-10">
        <div className="flex flex-col md:flex-row border-b md:border-r h-auto md:h-1/2 border-white mt-4 md:mt-10 mx-2 md:ml-10">
          <img
            src="/david.gif"
            alt="David ASCII"
            className="w-full max-w-[300px] h-auto mx-auto md:mx-0 py-2"
          />
          <div className="text-white font-['PerfectDOS'] p-4">
            <p className="mb-4 flex flex-col text-sm md:text-base uppercase">
              Join Medusa, a decentralized memecoin incubator that empowers individuals to collaborate, create, and drive the future of Web3. Whether you’re a developer, designer, influencer, or investor, Medusa’s DAO-driven ecosystem provides the perfect environment to bring ideas to life. Be part of our growing community and help shape the next wave of decentralized innovation.
            </p>
          </div>
        </div>
        <div
            className="flex flex-col md:flex-col justify-center md:justify-start items-center md:items-start px-4 md:pl-10 mt-4 space-y-4 md:space-y-4">
          <a href="https://t.me/MedusaDAOPortal" target="_blank" rel="noopener noreferrer">
            <img
                src="/telegram.png"
                alt="Show Bodies"
                className="w-full md:w-auto py-2"
            />
          </a>
          <a href="https://x.com/m3dusadao" target="_blank" rel="noopener noreferrer">
            <img
                src="/twitter.png"
                alt="Show Bodies"
                className="w-full md:w-auto py-2"
            />
          </a>
          {/*
          <a href="/" target="_blank" rel="noopener noreferrer">
            <img
                src="dex.png"
                alt="Show Bodies"
                className="w-full md:w-auto py-2"
            />
          </a>
          */}
        </div>
      </div>
      <div className="w-full md:w-[calc(30%-1rem)] flex flex-col justify-center items-center p-4">
        <img
          src="/Perseus.gif"
          alt="Show Bodies"
          className="h-auto max-h-[70vh] md:h-full py-2"
        />
      </div>
      <div className="hidden md:flex h-full w-full md:w-[calc(10%-1rem)] justify-center items-end overflow-hidden">
        <div className="text-white text-xl font-['PerfectDOS'] transform -rotate-90 h-screen flex items-center justify-end">
          1101110011100111001111101110011100111001110111001110011001
          1101110011100111001111101110011100111001110111001110011001
          1101110011100111001111101110011100111001110111001110011001
        </div>
      </div>
    </div>
  );
};

export default ShowBodiesPage;