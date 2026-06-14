import React from "react";

const asideClassName =
  "hidden md:block w-[12%] lg:w-[15%] shrink-0 py-4 md:py-8";

const pillarClassName =
  "sticky top-12 h-[calc(100vh-3rem)] w-full object-cover object-center";

export default function StickyPillarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-black text-white">
      <div className="flex items-stretch">
        <aside aria-hidden className={`${asideClassName} ml-0 lg:ml-10`}>
          <img src="/pillar.gif" alt="" className={pillarClassName} />
        </aside>

        <div className="flex-1 min-w-0 px-4 py-10 md:py-14">{children}</div>

        <aside aria-hidden className={`${asideClassName} mr-0 lg:mr-10`}>
          <img src="/pillar.gif" alt="" className={pillarClassName} />
        </aside>
      </div>
    </div>
  );
}
