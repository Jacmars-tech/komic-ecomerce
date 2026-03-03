"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
          <article
            style={{
              maxWidth: 680,
              margin: "0 auto",
              border: "1px solid #d6ded8",
              borderRadius: 14,
              padding: "1.2rem",
              background: "#ffffff"
            }}
          >
            <h1 style={{ marginTop: 0 }}>Critical error</h1>
            <p style={{ color: "#617065" }}>
              {error?.message || "The app encountered a critical error."}
            </p>
            <button
              onClick={() => reset()}
              style={{
                marginTop: "0.7rem",
                border: "none",
                borderRadius: 10,
                padding: "0.6rem 1rem",
                background: "#1d4ed8",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              Reload app
            </button>
          </article>
        </main>
      </body>
    </html>
  );
}
