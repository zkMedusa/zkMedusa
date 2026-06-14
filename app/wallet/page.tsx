"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClaimWalletFlow from "@/components/passport/ClaimWalletFlow";

export default function WalletPage() {
  return (
    <>
      <Header />
      <ClaimWalletFlow />
      <Footer />
    </>
  );
}
