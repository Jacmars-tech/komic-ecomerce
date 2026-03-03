import Link from "next/link";

import { ProductCard } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
};

function parseNum(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function ProductsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const q = searchParams.q?.trim();
  const category = searchParams.category;
  const brand = searchParams.brand;
  const minPrice = parseNum(searchParams.minPrice);
  const maxPrice = parseNum(searchParams.maxPrice);
  const sort = searchParams.sort || "newest";

  const andConditions: object[] = [];
  if (q) {
    andConditions.push({
      OR: [{ name: { contains: q } }, { description: { contains: q } }, { brand: { contains: q } }]
    });
  }
  if (category) {
    andConditions.push({ category: { slug: category } });
  }
  if (brand) {
    andConditions.push({ brand: { equals: brand } });
  }
  if (minPrice !== null) {
    andConditions.push({ priceCents: { gte: Math.round(minPrice * 100) } });
  }
  if (maxPrice !== null) {
    andConditions.push({ priceCents: { lte: Math.round(maxPrice * 100) } });
  }
  const where = andConditions.length > 0 ? { AND: andConditions } : {};

  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        category: true
      }
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.groupBy({ by: ["brand"], orderBy: { brand: "asc" } })
  ]);

  const ratings = await prisma.review.groupBy({
    by: ["productId"],
    where: {
      approved: true,
      productId: {
        in: products.map((product) => product.id)
      }
    },
    _avg: { rating: true },
    _count: { rating: true }
  });

  const ratingByProduct = new Map(
    ratings.map((entry) => [entry.productId, { average: Number(entry._avg.rating || 0), total: entry._count.rating }])
  );

  const hydrated = products.map((product) => ({
    ...product,
    rating: ratingByProduct.get(product.id) || { average: 0, total: 0 }
  }));

  hydrated.sort((a, b) => {
    if (sort === "price_asc") return a.priceCents - b.priceCents;
    if (sort === "price_desc") return b.priceCents - a.priceCents;
    if (sort === "rating") return b.rating.average - a.rating.average;
    if (sort === "popularity") {
      return Number(b.bestSeller) + b.rating.total - (Number(a.bestSeller) + a.rating.total);
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <main>
      <section className="stack" style={{ marginBottom: "1rem" }}>
        <h1>Product Catalog</h1>
        <p style={{ color: "#617065" }}>
          Search, filter, and sort products. This page maps directly to scalable catalog and discovery APIs.
        </p>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "minmax(220px, 280px) 1fr", alignItems: "start" }}>
        <aside className="card" style={{ padding: "1rem" }}>
          <form method="GET" className="stack">
            <label className="stack" style={{ gap: "0.35rem" }}>
              Keyword
              <input name="q" defaultValue={q || ""} placeholder="shoes, headphones..." />
            </label>

            <label className="stack" style={{ gap: "0.35rem" }}>
              Category
              <select name="category" defaultValue={category || ""}>
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="stack" style={{ gap: "0.35rem" }}>
              Brand
              <select name="brand" defaultValue={brand || ""}>
                <option value="">All brands</option>
                {brands.map((item) => (
                  <option key={item.brand} value={item.brand}>
                    {item.brand}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid">
              <label className="stack" style={{ gap: "0.35rem" }}>
                Min price
                <input name="minPrice" defaultValue={searchParams.minPrice || ""} type="number" min={0} />
              </label>
              <label className="stack" style={{ gap: "0.35rem" }}>
                Max price
                <input name="maxPrice" defaultValue={searchParams.maxPrice || ""} type="number" min={0} />
              </label>
            </div>

            <label className="stack" style={{ gap: "0.35rem" }}>
              Sort by
              <select name="sort" defaultValue={sort}>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to high</option>
                <option value="price_desc">Price: High to low</option>
                <option value="rating">Rating</option>
                <option value="popularity">Popularity</option>
              </select>
            </label>

            <div className="row">
              <button type="submit" className="btn btn-primary">
                Apply filters
              </button>
              <Link href="/products" className="btn btn-ghost">
                Reset
              </Link>
            </div>
          </form>
        </aside>

        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{hydrated.length} products</strong>
            {q ? <span className="badge">Searching: {q}</span> : null}
          </div>

          {hydrated.length === 0 ? (
            <article className="card" style={{ padding: "1rem" }}>
              <h3>No products found</h3>
              <p style={{ color: "#617065" }}>Try changing your filters or search keywords.</p>
            </article>
          ) : (
            <div className="product-grid">
              {hydrated.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
