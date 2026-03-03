import { randomUUID } from "crypto";

import { requireAdminDb } from "@/lib/firebase-admin";

type AnyRecord = Record<string, any>;
type PrismaLike = {
  [key: string]: any;
  $transaction: <T>(fn: (tx: PrismaLike) => Promise<T>) => Promise<T>;
  $disconnect: () => Promise<void>;
};

const COLLECTIONS = {
  user: "users",
  address: "addresses",
  category: "categories",
  product: "products",
  productImage: "productImages",
  productVariant: "productVariants",
  cartItem: "cartItems",
  order: "orders",
  orderItem: "orderItems",
  payment: "payments",
  coupon: "coupons",
  review: "reviews",
  inventoryLog: "inventoryLogs",
  notification: "notifications",
  auditLog: "auditLogs"
} as const;

function now() {
  return new Date();
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as any).toDate === "function") {
    return (value as any).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function normalize(value: unknown): unknown {
  const date = toDate(value);
  if (date) return date;
  if (Array.isArray(value)) return value.map((entry) => normalize(entry));
  if (value && typeof value === "object") {
    const out: AnyRecord = {};
    for (const [key, inner] of Object.entries(value as AnyRecord)) {
      out[key] = normalize(inner);
    }
    return out;
  }
  return value;
}

function mapDoc(snapshot: any): AnyRecord {
  const raw = snapshot.data() || {};
  const normalized = normalize(raw) as AnyRecord;
  return { id: snapshot.id, ...normalized };
}

function pick(record: AnyRecord, select?: AnyRecord): AnyRecord {
  if (!select) return record;
  const out: AnyRecord = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) out[key] = record[key];
  }
  return out;
}

function buildId() {
  return randomUUID().replace(/-/g, "");
}

function compareValues(a: any, b: any): number {
  const left = toDate(a)?.getTime() ?? a;
  const right = toDate(b)?.getTime() ?? b;
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function sortRows<T extends AnyRecord>(rows: T[], orderBy?: AnyRecord): T[] {
  if (!orderBy) return rows;
  const entries = Object.entries(orderBy);
  if (entries.length === 0) return rows;
  const [field, direction] = entries[0];
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compareValues(a[field], b[field]) * dir);
}

function isOperatorObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as AnyRecord);
  return keys.some((key) =>
    ["contains", "equals", "in", "not", "gte", "lte", "gt", "lt"].includes(key)
  );
}

function matchesField(value: any, condition: any): boolean {
  if (condition === undefined) return true;

  if (isOperatorObject(condition)) {
    const c = condition as AnyRecord;
    if ("equals" in c && value !== c.equals) return false;
    if ("contains" in c) {
      const hay = String(value || "").toLowerCase();
      const needle = String(c.contains || "").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if ("in" in c && Array.isArray(c.in) && !c.in.includes(value)) return false;
    if ("not" in c && value === c.not) return false;
    if ("gte" in c && compareValues(value, c.gte) < 0) return false;
    if ("lte" in c && compareValues(value, c.lte) > 0) return false;
    if ("gt" in c && compareValues(value, c.gt) <= 0) return false;
    if ("lt" in c && compareValues(value, c.lt) >= 0) return false;
    return true;
  }

  return value === condition;
}

function matchesSimple(record: AnyRecord, where?: AnyRecord): boolean {
  if (!where) return true;

  if (Array.isArray(where.AND) && !where.AND.every((entry) => matchesSimple(record, entry))) {
    return false;
  }
  if (Array.isArray(where.OR) && !where.OR.some((entry) => matchesSimple(record, entry))) {
    return false;
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR") continue;
    if (!matchesField(record[key], value)) return false;
  }
  return true;
}

function patchRecord(current: AnyRecord, data: AnyRecord): AnyRecord {
  const next = { ...current };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ("increment" in (value as AnyRecord) || "decrement" in (value as AnyRecord))
    ) {
      const start = Number(next[key] || 0);
      const delta = Number((value as AnyRecord).increment || 0) - Number((value as AnyRecord).decrement || 0);
      next[key] = start + delta;
    } else {
      next[key] = value;
    }
  }
  next.updatedAt = now();
  return next;
}

async function list(collection: string): Promise<AnyRecord[]> {
  const db = requireAdminDb();
  const snap = await db.collection(collection).get();
  return snap.docs.map(mapDoc);
}

async function readOne(collection: string, id: string): Promise<AnyRecord | null> {
  const db = requireAdminDb();
  const doc = await db.collection(collection).doc(id).get();
  return doc.exists ? mapDoc(doc) : null;
}

async function write(collection: string, id: string, data: AnyRecord, merge = false) {
  const db = requireAdminDb();
  await db.collection(collection).doc(id).set(data, { merge });
}

async function createRecord(collection: string, data: AnyRecord, customId?: string) {
  const id = customId || data.id || buildId();
  const payload: AnyRecord = { ...data, createdAt: data.createdAt || now(), updatedAt: data.updatedAt || now() };
  delete payload.id;
  await write(collection, id, payload);
  return (await readOne(collection, id)) as AnyRecord;
}

async function updateRecord(collection: string, id: string, data: AnyRecord) {
  const current = await readOne(collection, id);
  if (!current) return null;
  const next = patchRecord(current, data);
  const payload: AnyRecord = { ...next };
  delete payload.id;
  await write(collection, id, payload);
  return (await readOne(collection, id)) as AnyRecord;
}

async function deleteRecord(collection: string, id: string) {
  const db = requireAdminDb();
  await db.collection(collection).doc(id).delete();
}

async function deleteManyRecords(collection: string, predicate: (row: AnyRecord) => boolean) {
  const rows = await list(collection);
  const matches = rows.filter(predicate);
  await Promise.all(matches.map((row) => deleteRecord(collection, row.id)));
  return { count: matches.length };
}

async function withProductIncludes(product: AnyRecord, include?: AnyRecord): Promise<AnyRecord> {
  if (!include) return product;
  const out: AnyRecord = { ...product };

  if (include.category) {
    out.category = product.categoryId ? await modelCategory.findUnique({ where: { id: product.categoryId } }) : null;
  }

  if (include.images) {
    let images = (await list(COLLECTIONS.productImage)).filter((entry) => entry.productId === product.id);
    images = sortRows(images, include.images.orderBy || { sortOrder: "asc" });
    if (include.images.take) images = images.slice(0, include.images.take);
    out.images = images;
  }

  if (include.variants) {
    let variants = (await list(COLLECTIONS.productVariant)).filter((entry) => entry.productId === product.id);
    if (include.variants.orderBy) variants = sortRows(variants, include.variants.orderBy);
    out.variants = variants;
  }

  if (include.reviews) {
    let reviews = (await list(COLLECTIONS.review)).filter((entry) => entry.productId === product.id);
    if (include.reviews.where) {
      reviews = reviews.filter((entry) => matchesSimple(entry, include.reviews.where));
    }
    if (include.reviews.orderBy) reviews = sortRows(reviews, include.reviews.orderBy);
    if (include.reviews.include?.user) {
      const users = await list(COLLECTIONS.user);
      reviews = reviews.map((review) => {
        const user = users.find((entry) => entry.id === review.userId) || null;
        return {
          ...review,
          user: user ? pick(user, include.reviews.include.user.select) : null
        };
      });
    }
    out.reviews = reviews;
  }

  if (include._count?.select?.reviews) {
    const reviews = (await list(COLLECTIONS.review)).filter((entry) => entry.productId === product.id);
    out._count = { reviews: reviews.length };
  }

  return out;
}

async function withOrderIncludes(order: AnyRecord, include?: AnyRecord): Promise<AnyRecord> {
  if (!include) return order;
  const out: AnyRecord = { ...order };

  if (include.items) {
    let items = (await list(COLLECTIONS.orderItem)).filter((entry) => entry.orderId === order.id);

    if (include.items.where?.product?.vendorId) {
      const products = await list(COLLECTIONS.product);
      const allowed = new Set(
        products
          .filter((entry) => entry.vendorId === include.items.where.product.vendorId)
          .map((entry) => entry.id)
      );
      items = items.filter((item) => allowed.has(item.productId));
    }

    if (include.items.include?.product) {
      const products = await list(COLLECTIONS.product);
      items = items.map((item) => {
        const product = products.find((entry) => entry.id === item.productId) || null;
        return {
          ...item,
          product: product ? pick(product, include.items.include.product.select) : null
        };
      });
    }

    out.items = items;
  }

  if (include.payments) {
    let payments = (await list(COLLECTIONS.payment)).filter((entry) => entry.orderId === order.id);
    if (include.payments.orderBy) payments = sortRows(payments, include.payments.orderBy);
    out.payments = payments;
  }

  if (include.user) {
    const user = order.userId ? await modelUser.findUnique({ where: { id: order.userId } }) : null;
    out.user = user ? pick(user, include.user.select) : null;
  }

  return out;
}

function matchProductWhere(product: AnyRecord, where?: AnyRecord, categories?: AnyRecord[]): boolean {
  if (!where) return true;
  if (Array.isArray(where.AND) && !where.AND.every((entry) => matchProductWhere(product, entry, categories))) {
    return false;
  }
  if (Array.isArray(where.OR) && !where.OR.some((entry) => matchProductWhere(product, entry, categories))) {
    return false;
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR") continue;
    if (key === "category") {
      const category = categories?.find((entry) => entry.id === product.categoryId) || null;
      if (!category || !matchProductWhere(category, value as AnyRecord, categories)) return false;
      continue;
    }
    if (!matchesField(product[key], value)) return false;
  }

  return true;
}

function matchOrderWhere(order: AnyRecord, where: AnyRecord | undefined, orderItems: AnyRecord[], products: AnyRecord[]) {
  if (!where) return true;
  if (Array.isArray(where.AND) && !where.AND.every((entry) => matchOrderWhere(order, entry, orderItems, products))) {
    return false;
  }
  if (Array.isArray(where.OR) && !where.OR.some((entry) => matchOrderWhere(order, entry, orderItems, products))) {
    return false;
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === "AND" || key === "OR") continue;
    if (key === "items" && value && typeof value === "object") {
      const itemRows = orderItems.filter((entry) => entry.orderId === order.id);
      const some = (value as AnyRecord).some;
      if (some?.product?.vendorId) {
        const vendorId = some.product.vendorId;
        const hasMatch = itemRows.some((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          return product?.vendorId === vendorId;
        });
        if (!hasMatch) return false;
      }
      continue;
    }
    if (!matchesField(order[key], value)) return false;
  }

  return true;
}

const modelUser = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.user);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    if (args.select) return rows.map((row) => pick(row, args.select));
    if (!args.include) return rows;

    const [addresses, orders] = await Promise.all([list(COLLECTIONS.address), list(COLLECTIONS.order)]);
    return rows.map((row) => {
      const out: AnyRecord = { ...row };
      if (args.include.addresses) {
        let rowsAddresses = addresses.filter((entry) => entry.userId === row.id);
        rowsAddresses = sortRows(rowsAddresses, args.include.addresses.orderBy);
        out.addresses = rowsAddresses;
      }
      if (args.include.orders) {
        let rowsOrders = orders.filter((entry) => entry.userId === row.id);
        rowsOrders = sortRows(rowsOrders, args.include.orders.orderBy);
        if (args.include.orders.take) rowsOrders = rowsOrders.slice(0, args.include.orders.take);
        out.orders = args.include.orders.select
          ? rowsOrders.map((entry) => pick(entry, args.include.orders.select))
          : rowsOrders;
      }
      return out;
    });
  },
  async findFirst(args: AnyRecord = {}) {
    const rows = await this.findMany(args);
    return rows[0] || null;
  },
  async findUnique(args: AnyRecord) {
    const where = args?.where || {};
    const include = args?.include;

    const hydrate = async (row: AnyRecord | null) => {
      if (!row) return null;
      if (args.select) return pick(row, args.select);
      if (!include) return row;

      const out: AnyRecord = { ...row };
      if (include.addresses) {
        let addresses = (await list(COLLECTIONS.address)).filter((entry) => entry.userId === row.id);
        addresses = sortRows(addresses, include.addresses.orderBy);
        out.addresses = addresses;
      }
      if (include.orders) {
        let orders = (await list(COLLECTIONS.order)).filter((entry) => entry.userId === row.id);
        orders = sortRows(orders, include.orders.orderBy);
        if (include.orders.take) orders = orders.slice(0, include.orders.take);
        out.orders = include.orders.select ? orders.map((entry) => pick(entry, include.orders.select)) : orders;
      }
      return out;
    };

    if (where.id) {
      const row = await readOne(COLLECTIONS.user, where.id);
      return hydrate(row);
    }
    const rows = await this.findMany({ where });
    const row = rows[0] || null;
    return hydrate(row);
  },
  async create(args: AnyRecord) {
    const data = {
      role: "USER",
      isVerified: false,
      twoFactorEnabled: false,
      ...args.data
    };
    return createRecord(COLLECTIONS.user, data);
  },
  async update(args: AnyRecord) {
    const where = args.where || {};
    const id = where.id || (await this.findFirst({ where }))?.id;
    if (!id) return null;
    return updateRecord(COLLECTIONS.user, id, args.data || {});
  },
  async delete(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    const row = await readOne(COLLECTIONS.user, id);
    if (!row) return null;
    await deleteRecord(COLLECTIONS.user, id);
    return row;
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.user, (row) => matchesSimple(row, args.where));
  }
};

const modelAddress = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.address);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows;
  },
  async createMany(args: AnyRecord) {
    const data: AnyRecord[] = args.data || [];
    await Promise.all(data.map((entry) => createRecord(COLLECTIONS.address, entry)));
    return { count: data.length };
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.address, (row) => matchesSimple(row, args.where));
  }
};

const modelCategory = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.category);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return args.select ? rows.map((row) => pick(row, args.select)) : rows;
  },
  async findUnique(args: AnyRecord) {
    const where = args?.where || {};
    if (where.id) {
      const row = await readOne(COLLECTIONS.category, where.id);
      return row ? (args.select ? pick(row, args.select) : row) : null;
    }
    const rows = await this.findMany({ where });
    const row = rows[0] || null;
    return row ? (args.select ? pick(row, args.select) : row) : null;
  },
  async create(args: AnyRecord) {
    return createRecord(COLLECTIONS.category, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.category, (row) => matchesSimple(row, args.where));
  }
};

const modelProductImage = {
  async createMany(args: AnyRecord) {
    const data: AnyRecord[] = args.data || [];
    await Promise.all(data.map((entry) => createRecord(COLLECTIONS.productImage, entry)));
    return { count: data.length };
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.productImage, (row) => matchesSimple(row, args.where));
  }
};

const modelProductVariant = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.productVariant);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows;
  },
  async update(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    return updateRecord(COLLECTIONS.productVariant, id, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.productVariant, (row) => matchesSimple(row, args.where));
  }
};

const modelProduct = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.product);
    const categories = await list(COLLECTIONS.category);
    rows = rows.filter((row) => matchProductWhere(row, args.where, categories));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    if (!args.include) return rows;
    return Promise.all(rows.map((row) => withProductIncludes(row, args.include)));
  },
  async findUnique(args: AnyRecord) {
    const where = args?.where || {};
    let row: AnyRecord | null = null;
    if (where.id) {
      row = await readOne(COLLECTIONS.product, where.id);
    } else {
      const rows = await this.findMany({ where });
      row = rows[0] || null;
    }
    if (!row) return null;
    return args.include ? withProductIncludes(row, args.include) : row;
  },
  async create(args: AnyRecord) {
    const data = { ...args.data };
    const images = data.images?.create || [];
    delete data.images;

    const product = await createRecord(COLLECTIONS.product, data);
    if (images.length > 0) {
      await Promise.all(
        images.map((entry: AnyRecord) =>
          createRecord(COLLECTIONS.productImage, {
            ...entry,
            productId: product.id
          })
        )
      );
    }

    return args.include ? withProductIncludes(product, args.include) : product;
  },
  async update(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    const updated = await updateRecord(COLLECTIONS.product, id, args.data || {});
    if (!updated) return null;
    return args.include ? withProductIncludes(updated, args.include) : updated;
  },
  async delete(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    const row = await readOne(COLLECTIONS.product, id);
    if (!row) return null;
    await Promise.all([
      deleteManyRecords(COLLECTIONS.productImage, (entry) => entry.productId === id),
      deleteManyRecords(COLLECTIONS.productVariant, (entry) => entry.productId === id),
      deleteManyRecords(COLLECTIONS.cartItem, (entry) => entry.productId === id)
    ]);
    await deleteRecord(COLLECTIONS.product, id);
    return row;
  },
  async groupBy(args: AnyRecord) {
    const rows = await list(COLLECTIONS.product);
    const by = args.by || [];
    if (by.length === 1 && by[0] === "brand") {
      let brands = [...new Set(rows.map((row) => row.brand).filter(Boolean))].map((brand) => ({ brand }));
      brands = sortRows(brands, args.orderBy);
      return brands;
    }
    return [];
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.product, (row) => matchProductWhere(row, args.where));
  }
};

const modelCartItem = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.cartItem);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);

    if (!args.include) return rows;

    const products = await list(COLLECTIONS.product);
    const variants = await list(COLLECTIONS.productVariant);
    const images = await list(COLLECTIONS.productImage);

    return rows.map((row) => {
      const out: AnyRecord = { ...row };
      if (args.include.product) {
        const product = products.find((entry) => entry.id === row.productId) || null;
        if (product && args.include.product.include?.images) {
          let productImages = images.filter((entry) => entry.productId === product.id);
          productImages = sortRows(productImages, args.include.product.include.images.orderBy || { sortOrder: "asc" });
          if (args.include.product.include.images.take) {
            productImages = productImages.slice(0, args.include.product.include.images.take);
          }
          out.product = { ...product, images: productImages };
        } else {
          out.product = product;
        }
      }
      if (args.include.variant) {
        out.variant = variants.find((entry) => entry.id === row.variantId) || null;
      }
      return out;
    });
  },
  async findFirst(args: AnyRecord = {}) {
    const rows = await this.findMany(args);
    return rows[0] || null;
  },
  async findUnique(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    const row = await readOne(COLLECTIONS.cartItem, id);
    if (!row) return null;
    if (!args.include) return row;
    const rows = await this.findMany({ where: { id }, include: args.include });
    return rows[0] || null;
  },
  async create(args: AnyRecord) {
    return createRecord(COLLECTIONS.cartItem, args.data || {});
  },
  async update(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    return updateRecord(COLLECTIONS.cartItem, id, args.data || {});
  },
  async delete(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    const row = await readOne(COLLECTIONS.cartItem, id);
    if (!row) return null;
    await deleteRecord(COLLECTIONS.cartItem, id);
    return row;
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.cartItem, (row) => matchesSimple(row, args.where));
  }
};

const modelOrderItem = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.orderItem);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows;
  },
  async findFirst(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.orderItem);
    const orders = await list(COLLECTIONS.order);
    rows = rows.filter((row) => {
      if (!args.where) return true;
      if (args.where.productId && row.productId !== args.where.productId) return false;
      if (args.where.order) {
        const order = orders.find((entry) => entry.id === row.orderId);
        if (!order) return false;
        if (args.where.order.userId && order.userId !== args.where.order.userId) return false;
        if (args.where.order.status?.in && !args.where.order.status.in.includes(order.status)) return false;
      }
      return true;
    });

    if (args.orderBy?.order?.createdAt) {
      const dir = args.orderBy.order.createdAt === "asc" ? 1 : -1;
      rows = rows.sort((a, b) => {
        const aOrder = orders.find((entry) => entry.id === a.orderId);
        const bOrder = orders.find((entry) => entry.id === b.orderId);
        return compareValues(aOrder?.createdAt, bOrder?.createdAt) * dir;
      });
    }

    return rows[0] || null;
  },
  async create(args: AnyRecord) {
    return createRecord(COLLECTIONS.orderItem, args.data || {});
  },
  async update(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    return updateRecord(COLLECTIONS.orderItem, id, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.orderItem, (row) => matchesSimple(row, args.where));
  }
};

const modelPayment = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.payment);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    return rows;
  },
  async create(args: AnyRecord) {
    return createRecord(COLLECTIONS.payment, args.data || {});
  },
  async update(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    return updateRecord(COLLECTIONS.payment, id, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.payment, (row) => matchesSimple(row, args.where));
  }
};

const modelCoupon = {
  async findUnique(args: AnyRecord) {
    const where = args?.where || {};
    const rows = await list(COLLECTIONS.coupon);
    const row = rows.find((entry) => matchesSimple(entry, where)) || null;
    return row;
  },
  async createMany(args: AnyRecord) {
    const data: AnyRecord[] = args.data || [];
    await Promise.all(data.map((entry) => createRecord(COLLECTIONS.coupon, entry)));
    return { count: data.length };
  },
  async update(args: AnyRecord) {
    const where = args?.where || {};
    const rows = await list(COLLECTIONS.coupon);
    const row = rows.find((entry) => matchesSimple(entry, where));
    if (!row) return null;
    return updateRecord(COLLECTIONS.coupon, row.id, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.coupon, (row) => matchesSimple(row, args.where));
  }
};

const modelReview = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.review);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);
    if (!args.include?.user) return rows;
    const users = await list(COLLECTIONS.user);
    return rows.map((row) => ({
      ...row,
      user: pick(users.find((entry) => entry.id === row.userId) || {}, args.include.user.select)
    }));
  },
  async findUnique(args: AnyRecord) {
    const where = args?.where || {};
    const rows = await list(COLLECTIONS.review);
    let row: AnyRecord | undefined;
    if (where.userId_productId) {
      row = rows.find(
        (entry) =>
          entry.userId === where.userId_productId.userId &&
          entry.productId === where.userId_productId.productId
      );
    } else if (where.id) {
      row = rows.find((entry) => entry.id === where.id);
    } else {
      row = rows.find((entry) => matchesSimple(entry, where));
    }
    return row || null;
  },
  async create(args: AnyRecord) {
    return createRecord(COLLECTIONS.review, args.data || {});
  },
  async groupBy(args: AnyRecord) {
    const rows = (await list(COLLECTIONS.review)).filter((entry) => matchesSimple(entry, args.where));
    if (args.by?.length === 1 && args.by[0] === "productId") {
      const buckets = new Map<string, AnyRecord[]>();
      for (const row of rows) {
        const key = row.productId;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(row);
      }
      return [...buckets.entries()].map(([productId, entries]) => ({
        productId,
        _avg: { rating: entries.reduce((sum, item) => sum + Number(item.rating || 0), 0) / entries.length || 0 },
        _count: { rating: entries.length }
      }));
    }
    return [];
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.review, (row) => matchesSimple(row, args.where));
  }
};

const modelInventoryLog = {
  async create(args: AnyRecord) {
    return createRecord(COLLECTIONS.inventoryLog, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.inventoryLog, (row) => matchesSimple(row, args.where));
  }
};

const modelNotification = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.notification);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);

    if (!args.include?.order) return rows;
    const orders = await list(COLLECTIONS.order);
    return rows.map((row) => ({
      ...row,
      order: row.orderId
        ? pick(orders.find((entry) => entry.id === row.orderId) || {}, args.include.order.select)
        : null
    }));
  },
  async findUnique(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    return readOne(COLLECTIONS.notification, id);
  },
  async createMany(args: AnyRecord) {
    const data: AnyRecord[] = args.data || [];
    await Promise.all(data.map((entry) => createRecord(COLLECTIONS.notification, entry)));
    return { count: data.length };
  },
  async update(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    return updateRecord(COLLECTIONS.notification, id, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.notification, (row) => matchesSimple(row, args.where));
  }
};

const modelAuditLog = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.auditLog);
    rows = rows.filter((row) => matchesSimple(row, args.where));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);

    if (!args.include) return rows;
    const [users, orders] = await Promise.all([list(COLLECTIONS.user), list(COLLECTIONS.order)]);
    return rows.map((row) => ({
      ...row,
      actor: args.include.actor
        ? pick(users.find((entry) => entry.id === row.actorUserId) || {}, args.include.actor.select)
        : undefined,
      order: args.include.order
        ? pick(orders.find((entry) => entry.id === row.orderId) || {}, args.include.order.select)
        : undefined
    }));
  },
  async create(args: AnyRecord) {
    return createRecord(COLLECTIONS.auditLog, args.data || {});
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.auditLog, (row) => matchesSimple(row, args.where));
  }
};

const modelOrder = {
  async findMany(args: AnyRecord = {}) {
    let rows = await list(COLLECTIONS.order);
    const [orderItems, products] = await Promise.all([list(COLLECTIONS.orderItem), list(COLLECTIONS.product)]);
    rows = rows.filter((row) => matchOrderWhere(row, args.where, orderItems, products));
    rows = sortRows(rows, args.orderBy);
    if (args.take) rows = rows.slice(0, args.take);

    if (args.select) {
      const selected: AnyRecord[] = [];
      for (const row of rows) {
        const out: AnyRecord = pick(row, args.select);
        if (args.select.items) {
          let items = orderItems.filter((entry) => entry.orderId === row.id);
          if (args.select.items.select?.product?.select) {
            items = items.map((item) => {
              const product = products.find((entry) => entry.id === item.productId) || null;
              return { ...item, product: product ? pick(product, args.select.items.select.product.select) : null };
            });
          }
          out.items = items;
        }
        selected.push(out);
      }
      return selected;
    }

    if (!args.include) return rows;
    return Promise.all(rows.map((row) => withOrderIncludes(row, args.include)));
  },
  async findUnique(args: AnyRecord) {
    const where = args?.where || {};
    let row: AnyRecord | null = null;
    if (where.id) {
      row = await readOne(COLLECTIONS.order, where.id);
    } else {
      const rows = await this.findMany({ where });
      row = rows[0] || null;
    }
    if (!row) return null;

    if (args.select) {
      const out: AnyRecord = pick(row, args.select);
      if (args.select.items) {
        let items = (await list(COLLECTIONS.orderItem)).filter((entry) => entry.orderId === row!.id);
        if (args.select.items.select?.product?.select) {
          const products = await list(COLLECTIONS.product);
          items = items.map((item) => {
            const product = products.find((entry) => entry.id === item.productId) || null;
            return {
              ...item,
              product: product ? pick(product, args.select.items.select.product.select) : null
            };
          });
        }
        out.items = items;
      }
      return out;
    }

    return args.include ? withOrderIncludes(row, args.include) : row;
  },
  async create(args: AnyRecord) {
    const data = { ...(args.data || {}) };
    const nestedItems = data.items?.create || [];
    delete data.items;

    const order = await createRecord(COLLECTIONS.order, data);
    if (nestedItems.length > 0) {
      await Promise.all(
        nestedItems.map((entry: AnyRecord) =>
          createRecord(COLLECTIONS.orderItem, {
            ...entry,
            orderId: order.id
          })
        )
      );
    }
    return args.include ? withOrderIncludes(order, args.include) : order;
  },
  async update(args: AnyRecord) {
    const id = args?.where?.id;
    if (!id) return null;
    const updated = await updateRecord(COLLECTIONS.order, id, args.data || {});
    if (!updated) return null;
    return args.include ? withOrderIncludes(updated, args.include) : updated;
  },
  async aggregate(args: AnyRecord) {
    const rows = await list(COLLECTIONS.order);
    const result: AnyRecord = {};
    if (args._sum?.totalCents) {
      result._sum = {
        totalCents: rows.reduce((sum, entry) => sum + Number(entry.totalCents || 0), 0)
      };
    }
    if (args._count?._all) {
      result._count = { _all: rows.length };
    }
    return result;
  },
  async deleteMany(args: AnyRecord = {}) {
    return deleteManyRecords(COLLECTIONS.order, (row) => matchesSimple(row, args.where));
  }
};

const prismaCore: PrismaLike = {
  user: modelUser,
  address: modelAddress,
  category: modelCategory,
  product: modelProduct,
  productImage: modelProductImage,
  productVariant: modelProductVariant,
  cartItem: modelCartItem,
  order: modelOrder,
  orderItem: modelOrderItem,
  payment: modelPayment,
  coupon: modelCoupon,
  review: modelReview,
  inventoryLog: modelInventoryLog,
  notification: modelNotification,
  auditLog: modelAuditLog,
  async $transaction<T>(fn: (tx: PrismaLike) => Promise<T>) {
    return fn(prismaCore);
  },
  async $disconnect() {
    return;
  }
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaLike | undefined;
}

export const prisma: PrismaLike = global.prismaGlobal || prismaCore;

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
