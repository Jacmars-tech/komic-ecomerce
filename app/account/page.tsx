import Link from "next/link";

import { AccountPanel } from "@/components/AccountPanel";
import { getSessionUser } from "@/lib/auth";

export default function AccountPage() {
  const session = getSessionUser();

  if (!session) {
    return (
      <main>
        <article className="card" style={{ padding: "1.2rem" }}>
          <h1>Account</h1>
          <p style={{ color: "#617065", marginTop: 8 }}>You need to sign in to access account, orders, and profile settings.</p>
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
        <h1>My Account</h1>
        <p style={{ color: "#617065" }}>
          Manage profile, saved addresses, 2FA flag, and order history.
        </p>
      </section>

      <AccountPanel />
    </main>
  );
}
