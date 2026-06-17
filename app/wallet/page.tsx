import { redirect } from "next/navigation";

export default function WalletPage() {
  // The claim wallet + soulbound badge flow now lives on the passport page.
  redirect("/passport");
}
