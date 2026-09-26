"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  home: <path d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z" />,
  launch: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></>,
  paid: <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="M3.5 10h17M8 14.5h3" /></>,
  receipts: <><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" /><path d="M9 8.5h6M9 12h6" /></>,
  docs: <><path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v14H6.5a2 2 0 0 0-2 2z" /><path d="M4.5 19.5a2 2 0 0 0 2 2H19v-4" /></>,
};

const ITEMS: [string, string, keyof typeof I][] = [
  ["/", "Home", "home"],
  ["/launch", "Launch", "launch"],
  ["/claim", "Get paid", "paid"],
  ["/payments", "Payouts", "receipts"],
  ["/docs", "Docs", "docs"],
];

export default function RailNav() {
  const path = usePathname();
  return (
    <nav>
      {ITEMS.map(([href, label, icon]) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden>{I[icon]}</svg>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
