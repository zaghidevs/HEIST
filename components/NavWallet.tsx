"use client";
import dynamic from "next/dynamic";

// Rendered only in the browser: the Phantom extension doesn't exist during server rendering.
const PhantomButton = dynamic(() => import("./PhantomButton"), {
  ssr: false,
  loading: () => <button className="btn phantom" disabled>Connect Phantom</button>,
});

export function WalletButton({ full = false }: { full?: boolean }) {
  return <PhantomButton full={full} />;
}

export default function NavWallet() {
  return (
    <div className="nav-wallet">
      <WalletButton />
    </div>
  );
}
