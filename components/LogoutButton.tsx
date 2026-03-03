"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", {
      method: "POST"
    });
    setLoading(false);
    router.push("/");
    router.refresh();
  };

  return (
    <button type="button" className="btn btn-ghost" onClick={onLogout} disabled={loading}>
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
