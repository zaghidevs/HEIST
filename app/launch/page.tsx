import LaunchForm from "@/components/LaunchForm";
import { enabledPlatforms } from "@/lib/enabled";

export const metadata = { title: "Launch a coin" };

export default function LaunchPage() {
  const platformBps = Number(process.env.PLATFORM_FEE_BPS || "0");
  return (
    <section className="launch-home" style={{ marginTop: 20 }}>
      <div className="launch-head">
        <h1 className="page-title" style={{ marginTop: 20 }}>Plan the HEIST.</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          Pick a GTA player or RP streamer, name the coin, sign twice. Its pump.fun creator fees go to their cut, locked forever.
        </p>
      </div>
      <LaunchForm platformBps={platformBps} enabled={enabledPlatforms()} />
    </section>
  );
}
