"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Address = {
  label: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

type UserData = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  addresses: Address[];
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  createdAt: string;
};

type TabKey = "profile" | "orders" | "analytics";

function money(cents: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: process.env.NEXT_PUBLIC_CURRENCY || "KES"
  }).format(cents / 100);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function AccountPanel() {
  const [user, setUser] = useState<UserData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  const loadProfile = async () => {
    const [meRes, ordersRes] = await Promise.all([fetch("/api/me"), fetch("/api/orders")]);
    const mePayload = await meRes.json().catch(() => ({}));
    const ordersPayload = await ordersRes.json().catch(() => ({}));

    if (meRes.ok && mePayload.user) {
      setUser({
        ...mePayload.user,
        addresses: Array.isArray(mePayload.user.addresses) ? mePayload.user.addresses : []
      });
    } else {
      setUser(null);
      setStatus(mePayload.error || "Unable to load account data.");
    }

    if (ordersRes.ok) {
      setOrders(ordersPayload.orders || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
    const interval = setInterval(() => {
      fetch("/api/orders")
        .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
        .then(({ ok, payload }) => {
          if (ok) setOrders(payload.orders || []);
        })
        .catch(() => null);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setStatus(null);

    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: user.name,
        phone: user.phone,
        twoFactorEnabled: user.twoFactorEnabled,
        addresses: user.addresses
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error || "Failed to update profile");
      return;
    }

    setStatus("Profile updated");
  };

  const analytics = useMemo(() => {
    const now = new Date();
    const last30 = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const totalSpent = orders.reduce((sum, order) => sum + Number(order.totalCents || 0), 0);
    const paidOrders = orders.filter((order) => order.paymentStatus === "VERIFIED").length;
    const activeOrders = orders.filter((order) => ["PENDING", "PROCESSING", "SHIPPED"].includes(order.status)).length;
    const last30Spend = orders
      .filter((order) => new Date(order.createdAt).getTime() >= last30)
      .reduce((sum, order) => sum + Number(order.totalCents || 0), 0);
    const averageOrderValue = paidOrders > 0 ? Math.round(totalSpent / paidOrders) : 0;

    const daily = Array.from({ length: 7 }).map((_, index) => {
      const day = startOfDay(new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000));
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const total = orders
        .filter((order) => {
          const created = new Date(order.createdAt);
          return created >= day && created < next;
        })
        .reduce((sum, order) => sum + Number(order.totalCents || 0), 0);
      return {
        label: day.toLocaleDateString(undefined, { weekday: "short" }),
        total
      };
    });

    const maxDaily = Math.max(...daily.map((entry) => entry.total), 1);
    return {
      totalSpent,
      paidOrders,
      activeOrders,
      averageOrderValue,
      last30Spend,
      daily,
      maxDaily
    };
  }, [orders]);

  if (loading) {
    return <p>Loading account...</p>;
  }

  if (!user) {
    return <p>Unable to load account data.</p>;
  }

  const address = user.addresses[0] || {
    label: "Home",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Kenya",
    isDefault: true
  };

  return (
    <section className="stack">
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        {[
          { key: "profile", label: "Profile" },
          { key: "orders", label: "Orders" },
          { key: "analytics", label: "Live analytics" }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "btn btn-primary" : "btn btn-outline"}
            onClick={() => setActiveTab(tab.key as TabKey)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "profile" ? (
        <form className="card stack" style={{ padding: "1rem" }} onSubmit={onSave}>
          <h2>Profile settings</h2>
          <div className="form-grid">
            <label className="stack" style={{ gap: "0.35rem" }}>
              Name
              <input
                value={user.name}
                onChange={(event) => setUser((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
              />
            </label>
            <label className="stack" style={{ gap: "0.35rem" }}>
              Phone
              <input
                value={user.phone || ""}
                onChange={(event) => setUser((prev) => (prev ? { ...prev, phone: event.target.value } : prev))}
              />
            </label>
            <label className="stack full" style={{ gap: "0.35rem" }}>
              Email
              <input value={user.email} disabled />
            </label>
            <label className="stack full" style={{ gap: "0.35rem" }}>
              Address line 1
              <input
                value={address.line1}
                onChange={(event) =>
                  setUser((prev) =>
                    prev
                      ? {
                          ...prev,
                          addresses: [{ ...address, line1: event.target.value }]
                        }
                      : prev
                  )
                }
              />
            </label>
            <label className="stack" style={{ gap: "0.35rem" }}>
              City
              <input
                value={address.city}
                onChange={(event) =>
                  setUser((prev) =>
                    prev
                      ? {
                          ...prev,
                          addresses: [{ ...address, city: event.target.value }]
                        }
                      : prev
                  )
                }
              />
            </label>
            <label className="stack" style={{ gap: "0.35rem" }}>
              State
              <input
                value={address.state}
                onChange={(event) =>
                  setUser((prev) =>
                    prev
                      ? {
                          ...prev,
                          addresses: [{ ...address, state: event.target.value }]
                        }
                      : prev
                  )
                }
              />
            </label>
          </div>

          <label className="row" style={{ gap: "0.45rem" }}>
            <input
              type="checkbox"
              checked={Boolean(user.twoFactorEnabled)}
              onChange={(event) =>
                setUser((prev) => (prev ? { ...prev, twoFactorEnabled: event.target.checked } : prev))
              }
            />
            Enable two-factor authentication (profile flag)
          </label>

          <div className="row">
            <button type="submit" className="btn btn-primary">
              Save profile
            </button>
            {!user.isVerified ? (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={async () => {
                  const response = await fetch("/api/auth/request-verification", { method: "POST" });
                  const payload = await response.json().catch(() => ({}));
                  setStatus(
                    payload.devVerificationToken
                      ? `Dev verification token: ${payload.devVerificationToken}`
                      : payload.message
                  );
                }}
              >
                Verify email
              </button>
            ) : (
              <span className="badge">Email verified</span>
            )}
          </div>
        </form>
      ) : null}

      {activeTab === "orders" ? (
        <article className="card stack" style={{ padding: "1rem" }}>
          <h2>Order history</h2>
          {orders.length === 0 ? (
            <p style={{ color: "#617065" }}>No orders yet.</p>
          ) : (
            <div className="stack">
              {orders.map((order) => (
                <div key={order.id} className="card" style={{ padding: "0.75rem", background: "#fcfdf9" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>{order.id.slice(0, 12)}...</strong>
                    <span className="badge">{order.status}</span>
                  </div>
                  <p style={{ color: "#617065" }}>
                    {new Date(order.createdAt).toLocaleString()} | Payment: {order.paymentStatus}
                  </p>
                  <strong>{money(order.totalCents)}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      ) : null}

      {activeTab === "analytics" ? (
        <section className="stack">
          <article className="card" style={{ padding: "1rem" }}>
            <h2>Live analytics</h2>
            <p className="text-muted">Auto-refreshing every 6 seconds.</p>
            <div className="kpi-grid" style={{ marginTop: "0.8rem" }}>
              <div className="kpi">
                <strong>{money(analytics.totalSpent)}</strong>
                <p style={{ color: "#617065" }}>Total spend</p>
              </div>
              <div className="kpi">
                <strong>{analytics.paidOrders}</strong>
                <p style={{ color: "#617065" }}>Paid orders</p>
              </div>
              <div className="kpi">
                <strong>{analytics.activeOrders}</strong>
                <p style={{ color: "#617065" }}>Active orders</p>
              </div>
              <div className="kpi">
                <strong>{money(analytics.averageOrderValue)}</strong>
                <p style={{ color: "#617065" }}>Average order value</p>
              </div>
            </div>
          </article>

          <article className="card stack" style={{ padding: "1rem" }}>
            <h3>Last 30 days</h3>
            <strong>{money(analytics.last30Spend)}</strong>
            <div className="row" style={{ alignItems: "flex-end", gap: "0.4rem", minHeight: "120px" }}>
              {analytics.daily.map((entry) => (
                <div key={entry.label} className="stack" style={{ alignItems: "center", gap: "0.3rem", flex: 1 }}>
                  <div
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      background: "rgba(249, 115, 22, 0.22)",
                      height: `${Math.max(6, Math.round((entry.total / analytics.maxDaily) * 90))}px`
                    }}
                  />
                  <small style={{ color: "#617065" }}>{entry.label}</small>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {status ? <p style={{ color: "#425f55" }}>{status}</p> : null}
    </section>
  );
}

