import React from "react";

const Header = () => {
  return (
    <div
      className="h-12 w-full bg-cover bg-center flex items-center"
      style={{
        backgroundImage: `url('/bgnavbar.gif')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <h1 className="pl-10 absolute text-2xl font-bold text-black z-20 [text-shadow:_-2px_2px_0_#fff,_2px_2px_0_#fff,_2px_-2px_0_#fff,_-2px_-2px_0_#fff] font-['BlueScreen']">
          &#47;&#47; MEDUSA
      </h1>
    </div>
  );
};

export default Header;
