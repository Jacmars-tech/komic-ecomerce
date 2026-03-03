import Image from "next/image";
import Link from "next/link";
import { Headphones, ShieldCheck, ShoppingBag, Truck, Zap } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { optimizeImageUrl } from "@/lib/image";
import { formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const categoryImageMap: Record<string, string> = {
  electronics: "https://images.unsplash.com/photo-1519389950473-47ba0277781c",
  clothing: "https://images.unsplash.com/photo-1445205170230-053b83016050",
  fashion: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b",
  home: "https://images.unsplash.com/photo-1484101403633-562f891dc89a",
  beauty: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9",
  shoes: "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
  accessories: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa"
};

function resolveCategoryImage(slug: string): string {
  return categoryImageMap[slug.toLowerCase()] || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab";
}

export default async function HomePage() {
  const [featuredProducts, bestSellers, categories, orderStats] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [{ featured: true }, { newArrival: true }] },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 }
      },
      take: 8,
      orderBy: { createdAt: "desc" }
    }),
    prisma.product.findMany({
      where: { bestSeller: true },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 }
      },
      take: 4,
      orderBy: { createdAt: "desc" }
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      take: 8
    }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      _count: { _all: true }
    })
  ]);

  const revenue = orderStats._sum.totalCents || 0;

  return (
    <main>
      <section className="hero home-hero">
        <div className="container home-hero-inner">
          <div className="home-hero-copy animate-fade-in">
            <span className="badge badge-accent mb-8">Trusted Marketplace</span>
            <h1>Everything you need, delivered fast and securely.</h1>
            <p className="text-muted home-hero-subtext">
              Shop curated categories, pay with card or M-Pesa, and track your order status in real time.
            </p>
            <div className="home-hero-cta">
              <Link href="/products" className="btn btn-primary">
                <ShoppingBag size={18} />
                Shop now
              </Link>
              <Link href="/products?sort=popularity" className="btn btn-outline">
                Best sellers
              </Link>
            </div>
          </div>

          <div className="card home-stats animate-fade-in">
            <h3>Marketplace Snapshot</h3>
            <div className="home-stat-row">
              <span>Total sales</span>
              <strong>{formatCurrency(revenue)}</strong>
            </div>
            <div className="home-stat-row">
              <span>Orders processed</span>
              <strong>{orderStats._count._all}</strong>
            </div>
            <div className="home-stat-row">
              <span>Featured products</span>
              <strong>{featuredProducts.length}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container trust-strip">
          <article className="card trust-card">
            <Truck className="text-accent" size={20} />
            <div>
              <strong>Fast delivery</strong>
              <p className="text-muted">Tracked from checkout to doorstep.</p>
            </div>
          </article>
          <article className="card trust-card">
            <ShieldCheck className="text-accent" size={20} />
            <div>
              <strong>Secure checkout</strong>
              <p className="text-muted">Protected card and M-Pesa payments.</p>
            </div>
          </article>
          <article className="card trust-card">
            <Headphones className="text-accent" size={20} />
            <div>
              <strong>Live support</strong>
              <p className="text-muted">Real-time chat for buyers and sellers.</p>
            </div>
          </article>
          <article className="card trust-card">
            <Zap className="text-accent" size={20} />
            <div>
              <strong>Reliable stock</strong>
              <p className="text-muted">Inventory sync on every order.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="section bg-subtle">
        <div className="container">
          <div className="flex justify-between items-center mb-8">
            <h2 style={{ marginBottom: 0 }}>Shop by category</h2>
            <Link href="/products" className="btn btn-outline">
              View all
            </Link>
          </div>

          <div className="category-grid">
            {categories.map((category) => (
              <Link key={category.id} href={`/products?category=${category.slug}`} className="card category-card">
                <div className="category-media">
                  <Image
                    src={optimizeImageUrl(resolveCategoryImage(category.slug), 620)}
                    alt={category.name}
                    fill
                    style={{ objectFit: "cover" }}
                    unoptimized
                  />
                </div>
                <div className="category-label">{category.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="flex justify-between items-center mb-8">
            <h2 style={{ marginBottom: 0 }}>Featured arrivals</h2>
            <Link href="/products" className="btn btn-outline">
              Browse catalog
            </Link>
          </div>
          <div className="product-grid">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-subtle">
        <div className="container">
          <div className="flex justify-between items-center mb-8">
            <h2 style={{ marginBottom: 0 }}>Best sellers</h2>
            <Link href="/products?sort=popularity" className="btn btn-outline">
              See more
            </Link>
          </div>
          <div className="product-grid">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

