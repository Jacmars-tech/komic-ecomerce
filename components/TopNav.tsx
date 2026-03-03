import Link from "next/link";
import { Search, ShoppingCart, User, Heart, Menu, Store } from "lucide-react";

import { CartBadge } from "@/components/CartBadge";
import { LogoutButton } from "@/components/LogoutButton";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function TopNav() {
  const [session, categories] = await Promise.all([
    Promise.resolve(getSessionUser()),
    prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
      take: 10
    })
  ]);

  return (
    <header className="glass shadow-sm" style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--border)' }}>
      <div className="container">
        <nav className="flex items-center justify-between" style={{ height: '80px', gap: '2rem' }}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary)', letterSpacing: '-0.05em' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--accent)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <ShoppingCart size={20} />
            </div>
            <span>LUXE</span>
          </Link>

          {/* Search Bar */}
          <form action="/products" className="flex-1 max-width-md" style={{ maxWidth: '600px', position: 'relative' }}>
            <input
              name="q"
              placeholder="Search for items..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 3rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                outline: 'none',
                fontSize: '0.95rem'
              }}
            />
            <Search size={18} className="text-muted" style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)' }} />
          </form>

          {/* Nav Actions */}
          <div className="flex items-center gap-6">
            <details className="categories-menu" style={{ position: 'relative' }}>
              <summary className="flex items-center gap-1" style={{ cursor: 'pointer', fontWeight: 600, listStyle: 'none' }}>
                <Menu size={20} />
                Categories
              </summary>
              <div className="card glass animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '1rem', minWidth: '200px', padding: '0.5rem', zIndex: 100 }}>
                {categories.map((category) => (
                  <Link key={category.id} href={`/products?category=${category.slug}`} style={{ display: 'block', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s' }} className="nav-link-item">
                    {category.name}
                  </Link>
                ))}
              </div>
            </details>

            <div className="flex items-center gap-4">
              <Link href="/products?sort=popularity" className="text-muted hover-text-primary">
                <Heart size={22} />
              </Link>

              <Link href="/cart" className="flex items-center gap-2 text-muted hover-text-primary" style={{ position: 'relative' }}>
                <ShoppingCart size={22} />
                <CartBadge />
              </Link>

              <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>

              {session ? (
                <div className="flex items-center gap-4">
                  <Link href="/sell" className="flex items-center gap-2 font-semibold text-muted hover-text-primary">
                    <Store size={19} />
                    <span>Sell</span>
                  </Link>
                  <Link href="/account" className="flex items-center gap-2 font-semibold">
                    <User size={20} />
                    <span>Profile</span>
                  </Link>
                  <LogoutButton />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/sell" className="btn btn-ghost" style={{ padding: '0.5rem 1rem' }}>Sell</Link>
                  <Link href="/login" className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>Login</Link>
                  <Link href="/register" className="btn btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Join</Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
