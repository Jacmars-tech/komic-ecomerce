import Image from "next/image";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/ProductCard";
import { ProductPurchasePanel } from "@/components/ProductPurchasePanel";
import { ReviewForm } from "@/components/ReviewForm";
import { getSessionUser } from "@/lib/auth";
import { optimizeImageUrl } from "@/lib/image";
import { prisma } from "@/lib/prisma";

function parseSpecifications(value: string | null): Record<string, string> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return parsed;
  } catch {
    return {};
  }
}

export default async function ProductDetailPage({
  params
}: {
  params: { slug: string };
}) {
  const [product, session] = await Promise.all([
    prisma.product.findUnique({
      where: { slug: params.slug },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
        variants: true,
        reviews: {
          where: { approved: true },
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    Promise.resolve(getSessionUser())
  ]);

  if (!product) {
    notFound();
  }

  const relatedOr: Array<{ brand?: string; categoryId?: string }> = [{ brand: product.brand }];
  if (product.categoryId) {
    relatedOr.push({ categoryId: product.categoryId });
  }

  const related = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      OR: relatedOr
    },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 }
    },
    take: 4
  });

  const averageRating =
    product.reviews.length > 0
      ? product.reviews.reduce((total, review) => total + review.rating, 0) / product.reviews.length
      : 0;
  const fullStars = Math.floor(averageRating);
  const hasHalf = averageRating - fullStars >= 0.5;
  const stars = `${"★".repeat(fullStars)}${hasHalf ? "☆" : ""}${"☆".repeat(Math.max(0, 5 - fullStars - (hasHalf ? 1 : 0)))}`;

  const specifications = parseSpecifications(product.specifications);

  return (
    <main>
      <section className="product-detail-grid">
        <article className="card" style={{ padding: "1rem" }}>
          <Image
            src={optimizeImageUrl(product.images[0]?.url || "https://images.unsplash.com/photo-1512436991641-6745cdb1723f", 1100)}
            alt={product.images[0]?.altText || product.name}
            width={900}
            height={900}
            style={{ width: "100%", height: "auto", borderRadius: "0.8rem" }}
            unoptimized
          />

          {product.images.length > 1 ? (
            <div className="product-thumbs" style={{ marginTop: "0.7rem" }}>
              {product.images.slice(1).map((image) => (
                <Image
                  key={image.id}
                  src={optimizeImageUrl(image.url, 240)}
                  alt={image.altText || product.name}
                  width={160}
                  height={160}
                  className="product-thumb"
                  unoptimized
                />
              ))}
            </div>
          ) : null}
        </article>

        <article className="card stack" style={{ padding: "1rem" }}>
          <div className="row">
            <span className="badge">{product.category?.name || "General"}</span>
            <span className="badge">{product.brand}</span>
            {product.stockQuantity < 6 ? <span className="badge badge-accent">Low stock</span> : null}
          </div>

          <h1>{product.name}</h1>
          <div className="rating-row">
            <span className="stars">{stars}</span>
            <span className="reviews-count">
              ({averageRating.toFixed(1)}) · {product.reviews.length} reviews
            </span>
          </div>
          <p style={{ color: "#536486" }}>{product.description}</p>

          {product.variants.length > 0 ? (
            <div className="row">
              {product.variants.map((variant) => (
                <span key={variant.id} className="variant-chip">
                  {variant.name}: {variant.value}
                </span>
              ))}
            </div>
          ) : null}

          <ProductPurchasePanel
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              priceCents: product.priceCents,
              discountPriceCents: product.discountPriceCents,
              stockQuantity: product.stockQuantity,
              imageUrl: optimizeImageUrl(product.images[0]?.url || "", 700)
            }}
            variants={product.variants}
          />
        </article>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "1rem" }}>
        <details className="card mobile-collapse" open>
          <summary>Description</summary>
          <div className="stack" style={{ padding: "0 1rem 1rem" }}>
            <p style={{ color: "#566587" }}>{product.description}</p>
          </div>
        </details>

        <details className="card mobile-collapse" open>
          <summary>Specifications</summary>
          <div className="spec-list" style={{ padding: "0 1rem 1rem" }}>
            {Object.keys(specifications).length === 0 ? (
              <p style={{ color: "#566587" }}>No specifications provided.</p>
            ) : (
              Object.entries(specifications).map(([key, value]) => (
                <div key={key} className="spec-row">
                  <span style={{ textTransform: "capitalize", color: "#435376" }}>{key}</span>
                  <strong>{value}</strong>
                </div>
              ))
            )}
          </div>
        </details>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <article className="card" style={{ padding: "1rem" }}>
          <h2>Customer reviews</h2>
          <div className="stack" style={{ marginTop: "0.8rem" }}>
            {product.reviews.length === 0 ? (
              <p style={{ color: "#617065" }}>No published reviews yet.</p>
            ) : (
              product.reviews.map((review) => (
                <div key={review.id} className="card" style={{ padding: "0.75rem", background: "#fcfdf9" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>{review.user.name}</strong>
                    <span>{review.rating}/5</span>
                  </div>
                  <p style={{ color: "#5d665f" }}>{review.comment}</p>
                  {review.verifiedPurchase ? <span className="badge">Verified purchase</span> : null}
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card" style={{ padding: "1rem" }}>
          <h2>Write a review</h2>
          <ReviewForm productId={product.id} isAuthenticated={Boolean(session)} />
        </article>
      </section>

      <section className="stack">
        <h2>Related products</h2>
        <div className="product-grid">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
