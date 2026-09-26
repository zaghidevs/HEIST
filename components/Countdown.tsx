"use client";
import { useEffect, useState } from "react";

// GTA 6 release: November 19, 2026 (midnight Eastern).
const TARGET = Date.parse("2026-11-19T00:00:00-05:00");

function parts(ms: number) {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return { d: String(d), h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
}

export default function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = now == null ? { d: "--", h: "--", m: "--", s: "--" } : parts(TARGET - now);
  const out = now != null && now >= TARGET;
  return (
    <div className="countdown glass" role="timer" aria-label="Time until GTA 6 releases">
      <div className="cd-label">{out ? "GTA 6 is out" : "GTA 6 drops in"}</div>
      <div className="cd-units">
        <div className="cd-u"><b>{p.d}</b><span>days</span></div><i>:</i>
        <div className="cd-u"><b>{p.h}</b><span>hours</span></div><i>:</i>
        <div className="cd-u"><b>{p.m}</b><span>min</span></div><i>:</i>
        <div className="cd-u"><b>{p.s}</b><span>sec</span></div>
      </div>
    </div>
  );
}
