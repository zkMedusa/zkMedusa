import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stake $MEDUSA — Medusa",
  description:
    "Stake $MEDUSA to earn a share of protocol revenue buybacks. Lock longer for a bigger slice of each buyback drip.",
};

export default function StakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
