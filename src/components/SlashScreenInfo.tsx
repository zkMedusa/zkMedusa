import React from "react";

const SlashScreenInfo = () => {
  return (
    <div className="h-screen w-full bg-black bg-center flex items-center justify-center relative">
      <div className="absolute top-4 md:top-16 text-white text-xl md:text-4xl font-['BlueScreen'] text-center w-full md:w-auto">
        <p>&#47;&#47; THE PROCESS</p>
      </div>

      <div className="absolute">
        <img src="/dots.gif" alt="Loading dots" className="h-[32rem] w-[32rem] md:h-[48rem] md:w-[48rem] object-contain" />
      </div>

      <div className="absolute top-20 md:top-32 left-4 md:left-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row">
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Medusa seamlessly connects you with skilled professional AI developers, Web3 developers, graphic designers, and influencer to bring your ideas to life. By tapping into a global network of talent, you can ensure every aspect of your project is handled by the right expert, from concept to launch. This collaborative environment accelerates innovation and helps you build a successful Web3 venture.
        </p>
        <div className="hidden md:block flex-grow border-r border-white h-[100px] translate-y-[80px] translate-x-[50px] rotate-[135deg] ml-4"></div>
      </div>

      <div className="absolute md:top-32 right-4 md:right-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row top-[18rem]">
        <div className="hidden md:block border-l border-white h-[100px] translate-y-[80px] translate-x-[-70px] rotate-[45deg] mr-4"></div>
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Have Web3 skills you want to showcase? Apply to join our DAO and contribute to community-proposed projects. Your application will be reviewed, and a vote by current DAO members will determine your integratio ensuring a truly decentralized process.
        </p>
      </div>

      <div className="absolute bottom-[180px] md:bottom-32 left-4 md:left-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row bottom-[17rem]">
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Medusa also provides you with visibility for upcoming DAO-driven projects, developed collaboratively by its members ensuring every idea benefits from the collective expertise and resources of the community.
        </p>
        <div className="hidden md:block flex-grow border-r border-white h-[100px] translate-y-[-40px] translate-x-[40px] rotate-45 ml-4"></div>
      </div>

      <div className="absolute bottom-20 md:bottom-32 right-4 md:right-32 w-[80%] md:w-96 text-white flex flex-col md:flex-row">
        <div className="hidden md:block border-l border-white h-[100px] rotate-[135deg] translate-y-[-60px] translate-x-[-50px] mr-4"></div>
        <p className="font-['PerfectDOS'] text-xs md:text-base uppercase">
            Each project proposal within the DAO is fueled by a token donation proportional to the number of DAO members involved. Half of these tokens are burned, while the remaining half is distributed among the contributors who help bring the projects to life
        </p>
      </div>
    </div>
  );
};

export default SlashScreenInfo;
