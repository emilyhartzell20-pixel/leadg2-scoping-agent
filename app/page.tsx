import Link from "next/link";
import { AppHeader } from "@/components/Brand";
import { StartScoping } from "@/components/StartScoping";
import { ProposalList } from "@/components/ProposalList";
import { listProposals } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recent = await listProposals(5).catch(() => []);
  return (
    <>
      <AppHeader />
      <main>
        <section className="accent-bar grid-texture border-b border-line">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
            <div>
              <p className="eyebrow">Solutions Consultant</p>
              <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl">
                Scope it right.
                <br />
                <span className="text-orange">Propose it fast.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-steel">
                Pull a client&apos;s HubSpot history, run a sharp discovery conversation, and walk away with a branded
                proposal page and a 9-slide deck.
              </p>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
                {[
                  ["01", "HubSpot pull"],
                  ["02", "Guided scoping"],
                  ["03", "Proposal + deck"],
                ].map(([n, t]) => (
                  <div key={n} className="bg-midnight px-4 py-4">
                    <span className="font-heading text-sm font-extrabold text-orange">{n}</span>
                    <span className="mt-1 block text-sm font-semibold">{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:pt-6">
              <div className="rounded-lg border border-line bg-midnight/80 p-6 shadow-2xl shadow-black/30 sm:p-8">
                <p className="eyebrow">Start a new scope</p>
                <h2 className="mb-5 mt-2 text-2xl">Who are we scoping?</h2>
                <StartScoping />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="eyebrow">Saved</p>
              <h2 className="mt-1 text-2xl">Recent proposals</h2>
            </div>
            <Link href="/proposals" className="text-sm text-steel hover:text-orange">
              View all →
            </Link>
          </div>
          <ProposalList items={recent} />
        </section>
      </main>
    </>
  );
}
