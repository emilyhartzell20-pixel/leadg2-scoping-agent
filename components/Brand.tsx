/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

/**
 * Official LeadG2 logo files only (LeadG2 Design System).
 * "color": secondary lockup, for light backgrounds. "on-dark": primary lockup on Navy/Midnight — LEAD Orange, G2 Steel.
 */
export function Logo({ variant = "color", className = "h-6 w-auto" }: { variant?: "color" | "on-dark" | "color-tagline"; className?: string }) {
  return <img src={`/brand/logo-${variant}.png`} alt="LeadG2" className={className} />;
}

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between px-[18px] sm:px-8">
        <Link href="/" className="flex items-center gap-4" aria-label="LeadG2 Scoping Agent home">
          <Logo variant="color" className="h-[22px] w-auto" />
          <span className="label hidden border-l border-line pl-4 text-slate sm:block">Scoping Agent</span>
        </Link>
        <nav className="flex items-center gap-2 text-[15px] font-bold">
          <Link href="/proposals" className="rounded-sm px-3 py-2 text-navy transition hover:text-orange-dark">
            Proposals
          </Link>
          <Link href="/" className="btn btn-primary btn-sm">
            New scope
          </Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
