import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SdkDocs from "@/components/docs/SdkDocs";
import { getIssuerPublicKeyHex } from "@/lib/passport/signing.server";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export default function DocsPage() {
  let issuerPublicKey = process.env.PASSPORT_ISSUER_PUBLIC_KEY ?? "";

  try {
    issuerPublicKey = getIssuerPublicKeyHex();
  } catch {
    issuerPublicKey =
      issuerPublicKey || "Configure PASSPORT_ISSUER_PUBLIC_KEY on the server.";
  }

  return (
    <>
      <Header />
      <SdkDocs baseUrl={getBaseUrl()} issuerPublicKey={issuerPublicKey} />
      <Footer />
    </>
  );
}
