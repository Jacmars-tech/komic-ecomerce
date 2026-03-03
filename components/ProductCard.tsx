import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { AddToCartButton } from "@/components/AddToCartButton";
import { optimizeImageUrl } from "@/lib/image";
import { formatCurrency } from "@/lib/utils";

type Props = {
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    sku: string;
    priceCents: number;
    discountPriceCents: number | null;
    stockQuantity: number;
    featured?: boolean;
    newArrival?: boolean;
    bestSeller?: boolean;
    images?: { url: string; altText: string | null }[];
    rating?: { average: number; total: number };
  };
};

export function ProductCard({ product }: Props) {
  const imageUrl = optimizeImageUrl(
    product.images?.[0]?.url || "https://images.unsplash.com/photo-1512436991641-6745cdb1723f",
    700
  );
  const finalPrice = product.discountPriceCents ?? product.priceCents;
  const ratingValue = product.rating?.average || 0;

  return (
    <article className="card animate-fade-in product-card">
      <Link href={`/products/${product.slug}`} className="product-card-media">
        <Image
          src={imageUrl}
          alt={product.images?.[0]?.altText || product.name}
          fill
          className="product-image"
        />
        <div className="product-card-badges">
          {product.bestSeller && <span className="badge badge-accent">Best Seller</span>}
          {product.newArrival && <span className="badge badge-primary">New</span>}
        </div>
      </Link>

      <div className="product-card-body">
        <span className="product-card-brand">{product.brand}</span>
        <Link href={`/products/${product.slug}`} className="product-card-title">
          {product.name}
        </Link>

        <div className="product-card-rating">
          <Star size={14} className="text-warning" fill="currentColor" />
          <span className="product-card-rating-value">{ratingValue.toFixed(1)}</span>
          <span className="product-card-rating-total">({product.rating?.total || 0})</span>
        </div>

        <div className="product-card-footer">
          <div className="product-card-price-row">
            <span className="product-card-price">{formatCurrency(finalPrice)}</span>
            {product.discountPriceCents && (
              <span className="product-card-old-price">
                {formatCurrency(product.priceCents)}
              </span>
            )}
          </div>
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              sku: product.sku,
              priceCents: product.priceCents,
              discountPriceCents: product.discountPriceCents,
              stockQuantity: product.stockQuantity,
              imageUrl
            }}
          />
        </div>
      </div>
    </article>
  );
}
