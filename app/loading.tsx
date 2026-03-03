export default function GlobalLoading() {
  return (
    <main>
      <section className="stack" style={{ gap: "16px" }}>
        <div className="card" style={{ height: 220, background: "#f2f5fb" }} />
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="card" style={{ height: 360, background: "#f2f5fb" }} />
          ))}
        </div>
      </section>
    </main>
  );
}

