import "dotenv/config";
import crypto from "crypto";

import admin from "firebase-admin";

function now() {
  return new Date();
}

function id() {
  return crypto.randomUUID().replace(/-/g, "");
}

function hashPassword(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    })
  });
}

const db = admin.firestore();

const collections = [
  "auditLogs",
  "notifications",
  "reviews",
  "payments",
  "orderItems",
  "orders",
  "cartItems",
  "inventoryLogs",
  "productVariants",
  "productImages",
  "products",
  "categories",
  "addresses",
  "coupons",
  "users"
];

async function clearCollection(name) {
  const snapshot = await db.collection(name).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

async function main() {
  for (const name of collections) {
    await clearCollection(name);
  }

  const adminUser = {
    id: id(),
    name: "Admin User",
    email: "admin@shoplocal.dev",
    phone: "+254700000001",
    passwordHash: hashPassword("Admin123!"),
    role: "ADMIN",
    isVerified: true,
    twoFactorEnabled: true,
    createdAt: now(),
    updatedAt: now()
  };

  const buyerUser = {
    id: id(),
    name: "Buyer User",
    email: "buyer@shoplocal.dev",
    phone: "+254700000002",
    passwordHash: hashPassword("Buyer123!"),
    role: "USER",
    isVerified: true,
    twoFactorEnabled: false,
    createdAt: now(),
    updatedAt: now()
  };

  const vendorUser = {
    id: id(),
    name: "Vendor User",
    email: "vendor@shoplocal.dev",
    phone: "+254700000003",
    passwordHash: hashPassword("Vendor123!"),
    role: "VENDOR",
    isVerified: true,
    twoFactorEnabled: false,
    createdAt: now(),
    updatedAt: now()
  };

  await Promise.all([
    db.collection("users").doc(adminUser.id).set(adminUser),
    db.collection("users").doc(buyerUser.id).set(buyerUser),
    db.collection("users").doc(vendorUser.id).set(vendorUser)
  ]);

  const categories = [
    { id: id(), name: "Electronics", slug: "electronics" },
    { id: id(), name: "Fashion", slug: "fashion" },
    { id: id(), name: "Home", slug: "home" },
    { id: id(), name: "Beauty", slug: "beauty" }
  ].map((entry) => ({ ...entry, createdAt: now(), updatedAt: now() }));

  await Promise.all(categories.map((entry) => db.collection("categories").doc(entry.id).set(entry)));

  const products = [
    {
      id: id(),
      slug: "wireless-headphones-x1",
      name: "Wireless Headphones X1",
      description: "Premium noise-cancelling headphones with deep bass and all-day comfort.",
      sku: "ELEC-HP-001",
      brand: "Sonic",
      priceCents: 1299900,
      discountPriceCents: 999900,
      stockQuantity: 70,
      featured: true,
      newArrival: true,
      bestSeller: true,
      categoryId: categories[0].id,
      vendorId: vendorUser.id
    },
    {
      id: id(),
      slug: "urban-sneakers-lite",
      name: "Urban Sneakers Lite",
      description: "Breathable everyday sneakers with durable sole and modern silhouette.",
      sku: "FASH-SNK-014",
      brand: "Stride",
      priceCents: 749900,
      discountPriceCents: null,
      stockQuantity: 120,
      featured: true,
      newArrival: false,
      bestSeller: true,
      categoryId: categories[1].id,
      vendorId: vendorUser.id
    },
    {
      id: id(),
      slug: "smart-air-fryer-6l",
      name: "Smart Air Fryer 6L",
      description: "Energy-efficient fryer with digital presets and non-stick basket.",
      sku: "HOME-AF-101",
      brand: "HomeChef",
      priceCents: 1599900,
      discountPriceCents: 1399900,
      stockQuantity: 55,
      featured: false,
      newArrival: true,
      bestSeller: false,
      categoryId: categories[2].id,
      vendorId: vendorUser.id
    }
  ].map((entry) => ({
    ...entry,
    tags: JSON.stringify(["seed"]),
    specifications: JSON.stringify({ source: "firestore-seed" }),
    createdAt: now(),
    updatedAt: now()
  }));

  await Promise.all(products.map((entry) => db.collection("products").doc(entry.id).set(entry)));

  await Promise.all(
    products.map((product, index) => {
      const imageId = id();
      return db.collection("productImages").doc(imageId).set({
        id: imageId,
        productId: product.id,
        url:
          index === 0
            ? "https://images.unsplash.com/photo-1505740420928-5e560c06d30e"
            : index === 1
            ? "https://images.unsplash.com/photo-1542291026-7eec264c27ff"
            : "https://images.unsplash.com/photo-1585515656685-0d2f2ea0f8cf",
        altText: product.name,
        sortOrder: 0,
        createdAt: now(),
        updatedAt: now()
      });
    })
  );

  const couponOneId = id();
  const couponTwoId = id();
  await Promise.all([
    db.collection("coupons").doc(couponOneId).set({
      id: couponOneId,
      code: "WELCOME10",
      description: "10% off first order",
      discountType: "percentage",
      discountValue: 10,
      active: true,
      minimumOrderCents: 100000,
      usedCount: 0,
      createdAt: now(),
      updatedAt: now()
    }),
    db.collection("coupons").doc(couponTwoId).set({
      id: couponTwoId,
      code: "SAVE500",
      description: "Flat 500 KES off",
      discountType: "flat",
      discountValue: 50000,
      active: true,
      minimumOrderCents: 300000,
      usedCount: 0,
      createdAt: now(),
      updatedAt: now()
    })
  ]);

  const orderId = id();
  await db.collection("orders").doc(orderId).set({
    id: orderId,
    userId: buyerUser.id,
    guestEmail: null,
    status: "PAID",
    paymentStatus: "VERIFIED",
    paymentMethod: "CARD",
    paymentReference: "seed_ref_001",
    idempotencyKey: `seed-${orderId}`,
    subtotalCents: 999900,
    taxCents: 159984,
    shippingCents: 50000,
    totalCents: 1209884,
    currency: "KES",
    shippingName: "Buyer User",
    shippingPhone: buyerUser.phone,
    shippingLine1: "Nairobi CBD",
    shippingLine2: "",
    shippingCity: "Nairobi",
    shippingState: "Nairobi",
    shippingPostalCode: "00100",
    shippingCountry: "Kenya",
    notes: null,
    createdAt: now(),
    updatedAt: now()
  });

  const orderItemId = id();
  await db.collection("orderItems").doc(orderItemId).set({
    id: orderItemId,
    orderId,
    productId: products[0].id,
    variantId: null,
    name: products[0].name,
    sku: products[0].sku,
    quantity: 1,
    unitPriceCents: 999900,
    lineTotalCents: 999900,
    reviewed: true,
    createdAt: now(),
    updatedAt: now()
  });

  const reviewId = id();
  await db.collection("reviews").doc(reviewId).set({
    id: reviewId,
    userId: buyerUser.id,
    productId: products[0].id,
    orderItemId: null,
    rating: 5,
    comment: "Excellent quality and very fast delivery.",
    verifiedPurchase: true,
    approved: true,
    createdAt: now(),
    updatedAt: now()
  });

  console.log("Firestore seed completed.");
  console.log("Admin:", adminUser.email, "/ Admin123!");
  console.log("Buyer:", buyerUser.email, "/ Buyer123!");
  console.log("Vendor:", vendorUser.email, "/ Vendor123!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
