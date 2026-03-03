"use client";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorProps) {
  return (
    <main>
      <article className="card stack" style={{ padding: "1.2rem" }}>
        <h1>Something went wrong</h1>
        <p style={{ color: "#617065" }}>
          {error?.message || "Unexpected application error."}
        </p>
        <div className="row" style={{ marginTop: "0.6rem" }}>
          <button className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </article>
    </main>
  );
}
