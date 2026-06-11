import type { Metadata } from "next";
import "./globals.css";
import AppProviders from "@/providers/AppProviders";

export const metadata: Metadata = {
  title: "Medusa — Private Wallet Credentials on Solana",
  description:
    "Prove wallet reputation without revealing your address. Medusa Passport uses zero-knowledge proofs and x402 USDC payments on Solana, with a partner SDK for privacy-preserving verification.",
  icons: {
    icon: "/head.webp",
    apple: "/head.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
