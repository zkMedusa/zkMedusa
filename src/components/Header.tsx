import Link from "next/link";

const navLinks = [
  { label: "PASSPORT", href: "/passport" },
  { label: "SDK DOCS", href: "/docs" },
  {
    label: "PUMP.FUN",
    href: "https://pump.fun/",
    external: true,
  },
  { label: "ABOUT", href: "/#about" },
  { label: "TWITTER", href: "https://x.com/ZkMedusa", external: true },
] as const;

const linkClassName =
  "whitespace-nowrap text-xs md:text-sm font-bold text-black [text-shadow:_-1px_1px_0_#fff,_1px_1px_0_#fff,_1px_-1px_0_#fff,_-1px_-1px_0_#fff] font-['BlueScreen'] hover:opacity-70 transition-opacity";

const Header = () => {
  return (
    <div
      className="h-12 w-full bg-cover bg-center flex items-center px-4 md:px-8"
      style={{
        backgroundImage: `url('/bgnavbar.gif')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex w-full items-center justify-between gap-4 min-w-0">
        <Link
          href="/"
          className="shrink-0 text-lg md:text-2xl font-bold text-black [text-shadow:_-2px_2px_0_#fff,_2px_2px_0_#fff,_2px_-2px_0_#fff,_-2px_-2px_0_#fff] font-['BlueScreen']"
        >
          &#47;&#47; MEDUSA
        </Link>

        <nav className="flex items-center gap-3 md:gap-5 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {navLinks.map((item) =>
            "external" in item && item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClassName}
              >
                &#47;&#47; {item.label}
              </a>
            ) : (
              <Link key={item.label} href={item.href} className={linkClassName}>
                &#47;&#47; {item.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </div>
  );
};

export default Header;
