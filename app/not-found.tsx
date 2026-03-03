import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main>
      <article className="card" style={{ padding: "1.2rem" }}>
        <h1>Page not found</h1>
        <p style={{ color: "#617065", marginTop: 8 }}>The page you requested does not exist.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>
          Back home
        </Link>
      </article>
    </main>
  );
}
