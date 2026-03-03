export default function ProductsLoading() {
  return (
    <main>
      <section className="stack" style={{ marginBottom: "16px" }}>
        <div className="card" style={{ height: 56, background: "#f2f5fb" }} />
        <div className="card" style={{ height: 120, background: "#f2f5fb" }} />
      </section>
      <section className="product-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="card" style={{ height: 360, background: "#f2f5fb" }} />
        ))}
      </section>
    </main>
  );
}

