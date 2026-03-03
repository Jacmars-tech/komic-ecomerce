import Link from "next/link";

import { AdminPanel } from "@/components/AdminPanel";
import { getSessionUser } from "@/lib/auth";

export default function AdminPage() {
  const session = getSessionUser();

  if (!session) {
    return (
      <main>
        <article className="card" style={{ padding: "1.2rem" }}>
          <h1>Admin Dashboard</h1>
          <p style={{ color: "#617065", marginTop: 8 }}>Login as admin to manage products, orders, and operations.</p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: 12 }}>
            Login
          </Link>
        </article>
      </main>
    );
  }

  if (session.role !== "ADMIN" && session.role !== "VENDOR") {
    return (
      <main>
        <article className="card" style={{ padding: "1.2rem" }}>
          <h1>Admin Dashboard</h1>
          <p style={{ color: "#617065", marginTop: 8 }}>
            Your account does not have admin permissions.
          </p>
        </article>
      </main>
    );
  }

  return (
    <main>
      <section className="stack" style={{ marginBottom: "1rem" }}>
        <h1>Admin Dashboard</h1>
        <p style={{ color: "#617065" }}>
          Manage catalog, monitor inventory, update order statuses, and view sales KPIs.
        </p>
      </section>

      <AdminPanel viewerRole={session.role as "ADMIN" | "VENDOR"} />
    </main>
  );
}
