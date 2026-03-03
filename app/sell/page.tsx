import Link from "next/link";

import { SellForm } from "@/components/SellForm";
import { getSessionUser } from "@/lib/auth";

export default function SellPage() {
  const session = getSessionUser();

  if (!session) {
    return (
      <main>
        <article className="card" style={{ padding: "1.2rem" }}>
          <h1>Start Selling</h1>
          <p style={{ color: "#617065", marginTop: 8 }}>
            Sign in first to create and manage product listings.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: 12 }}>
            Login
          </Link>
        </article>
      </main>
    );
  }

  return (
    <main>
      <section className="stack" style={{ marginBottom: "1rem" }}>
        <h1>Seller Center</h1>
        <p style={{ color: "#617065" }}>
          Create listings, sell to customers, and track order outcomes from your dashboard.
        </p>
      </section>
      <SellForm />
    </main>
  );
}

