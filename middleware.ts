import { NextRequest, NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const LIMIT = 120;

const buckets = new Map<string, Bucket>();

function getClientKey(req: NextRequest): string {
  const headerIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  return headerIp.split(",")[0].trim();
}

function enforceRateLimit(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith("/api")) {
    return null;
  }

  const key = getClientKey(req);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (bucket.count >= LIMIT) {
    return NextResponse.json(
      { error: "Too many requests. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((bucket.resetAt - now) / 1000).toString()
        }
      }
    );
  }

  bucket.count += 1;
  return null;
}

function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval';"
    : "script-src 'self' 'unsafe-inline';";
  const connectSrc = isDev
    ? "connect-src 'self' ws: wss: http: https:;"
    : "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.gstatic.com;";

  return [
    "default-src 'self';",
    "img-src 'self' https://images.unsplash.com data:;",
    scriptSrc,
    "style-src 'self' 'unsafe-inline';",
    connectSrc
  ].join(" ");
}

export function middleware(req: NextRequest) {
  const limitResponse = enforceRateLimit(req);
  if (limitResponse) {
    return limitResponse;
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=() ");
  response.headers.set("Content-Security-Policy", buildCsp());
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
