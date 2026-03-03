import Link from "next/link";
import { ShoppingCart, Facebook, Twitter, Instagram, Linkedin, Mail } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="section bg-subtle" style={{ borderTop: '1px solid var(--border)', marginTop: '4rem' }}>
      <div className="container">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '3rem' }}>
          <div className="stack">
            <Link href="/" className="flex items-center gap-2 mb-4" style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary)', letterSpacing: '-0.05em' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--accent)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                <ShoppingCart size={20} />
              </div>
              <span>LUXE</span>
            </Link>
            <p className="text-muted" style={{ fontSize: '0.95rem' }}>
              Redefining the digital shopping experience with curated premium collections
              and seamless global commerce.
            </p>
            <div className="flex gap-4 mt-6">
              <Link href="#" className="text-muted hover-text-primary"><Facebook size={20} /></Link>
              <Link href="#" className="text-muted hover-text-primary"><Twitter size={20} /></Link>
              <Link href="#" className="text-muted hover-text-primary"><Instagram size={20} /></Link>
              <Link href="#" className="text-muted hover-text-primary"><Linkedin size={20} /></Link>
            </div>
          </div>

          <div className="stack">
            <h4 style={{ marginBottom: '1.5rem' }}>Collection</h4>
            <div className="stack gap-2" style={{ fontSize: '0.9rem' }}>
              <Link href="/products?category=electronics" className="text-muted hover-text-primary">Electronics</Link>
              <Link href="/products?category=fashion" className="text-muted hover-text-primary">Fashion</Link>
              <Link href="/products?category=home" className="text-muted hover-text-primary">Home & Living</Link>
              <Link href="/products?category=beauty" className="text-muted hover-text-primary">Beauty</Link>
            </div>
          </div>

          <div className="stack">
            <h4 style={{ marginBottom: '1.5rem' }}>Company</h4>
            <div className="stack gap-2" style={{ fontSize: '0.9rem' }}>
              <Link href="#" className="text-muted hover-text-primary">About Luxe</Link>
              <Link href="#" className="text-muted hover-text-primary">Sustainability</Link>
              <Link href="#" className="text-muted hover-text-primary">Terms of Service</Link>
              <Link href="#" className="text-muted hover-text-primary">Privacy Policy</Link>
            </div>
          </div>

          <div className="stack">
            <h4 style={{ marginBottom: '1.5rem' }}>Newsletter</h4>
            <p className="text-muted mb-4" style={{ fontSize: '0.9rem' }}>Stay updated with our latest releases and exclusive offers.</p>
            <form className="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                className="input"
                style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.9rem' }}
              />
              <button className="btn btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
                <Mail size={18} />
              </button>
            </form>
          </div>
        </div>

        <div className="mt-16 pt-8 text-center text-muted border-t" style={{ fontSize: '0.85rem' }}>
          &copy; {new Date().getFullYear()} LUXE Global Marketplace. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

