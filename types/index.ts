export type ClientCartItem = {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
  stockQuantity: number;
};

export type ProductQueryParams = {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "rating" | "popularity";
};
