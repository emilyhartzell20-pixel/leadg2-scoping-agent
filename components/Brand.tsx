/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

/** The official LeadG2 logo files from the LeadG2 Design System — never a re-typed wordmark. */
export function Logo({ variant = "white", className = "h-6 w-auto" }: { variant?: "white" | "color" | "color-tagline"; className?: string }) {
  return <img src={`/brand/logo-${variant}.png`} alt="LeadG2" className={className} />;
}

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-midnight/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-4" aria-label="LeadG2 Scoping Agent home">
          <Logo variant="white" className="h-5 w-auto sm:h-6" />
          <span className="hidden border-l border-line pl-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-steel sm:block">Scoping Agent</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/proposals" className="rounded px-3 py-2 text-steel transition hover:bg-navy hover:text-smoke">
            Proposals
          </Link>
          <Link href="/" className="rounded bg-orange px-3 py-2 font-semibold text-midnight transition hover:bg-orange-hover">
            New scope
          </Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
