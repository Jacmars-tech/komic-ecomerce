"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim(), password })
    });

    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setStatus(payload.error || "Login failed");
      return;
    }

    router.push("/account");
    router.refresh();
  };

  return (
    <main>
      <section className="auth-container">
        <article className="card auth-card">
          <h1>Welcome back</h1>
          <p className="auth-subtext">Log in to continue shopping.</p>

          <form className="stack" onSubmit={onLogin}>
            <label className="stack auth-field">
              <span>Email or Phone</span>
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="you@example.com or +2547..."
                autoComplete="username"
                required
              />
            </label>

            <label className="stack auth-field">
              <span>Password</span>
              <div className="password-row">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button className="btn btn-primary checkout-cta" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Log in"}
            </button>
          </form>

          <p className="auth-footer">
            No account yet? <Link href="/register">Create one</Link>
          </p>

          <details className="auth-help">
            <summary>Demo login details</summary>
            <p>Admin: admin@shoplocal.dev / Admin123!</p>
            <p>Buyer: buyer@shoplocal.dev / Buyer123!</p>
          </details>

          {status ? <p className="auth-status">{status}</p> : null}
        </article>
      </section>
    </main>
  );
}
