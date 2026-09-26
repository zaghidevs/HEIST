import Link from "next/link";

export default function NotFound() {
  return (
    <section style={{ textAlign: "center", paddingTop: 60 }}>
      <h1 className="page-title">Not found.</h1>
      <p className="muted">That coin or player isn't on this site.</p>
      <Link className="btn" href="/">Home</Link>
    </section>
  );
}
