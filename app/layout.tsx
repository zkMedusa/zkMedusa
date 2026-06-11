import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Medusa",
  description:
    "Medusa is a decentralized memecoin incubator that allows anyone to turn an idea into a fully realized web3 project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
