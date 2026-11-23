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
        {/* Cream hero */}
        <section className="bg-cream">
          <div className="mx-auto grid max-w-page gap-12 px-[18px] pb-24 pt-20 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-28">
            <div>
              <h1 className="text-[40px] sm:text-[58px]">
                Scope it right. <span className="accent">Propose it fast.</span>
              </h1>
              <p className="lead mt-6 max-w-xl">
                Pull a prospect&apos;s HubSpot history, let the agent read every call and email, and walk away with a scope, an executive summary and a
                deck.
              </p>
              <ol className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
                {[
                  ["01", "Read everything"],
                  ["02", "Review the scope"],
                  ["03", "Summary and deck"],
                ].map(([n, t]) => (
                  <li key={n} className="card card-rule px-5 pb-4 pt-5">
                    <span className="num text-lg">{n}</span>
                    <span className="mt-1 block font-sans text-[15px] font-bold text-navy">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="lg:pt-2">
              <div className="card p-6 shadow-[0_34px_64px_-36px_rgba(13,27,42,.32)] sm:p-8">
                <h2 className="mb-5 text-[28px]">
                  Who are we <span className="accent">scoping?</span>
                </h2>
                <StartScoping />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-page px-[18px] py-16 sm:px-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="text-[30px]">Recent proposals</h2>
              <Link href="/proposals" className="link text-[15px]">
                View all →
              </Link>
            </div>
            <ProposalList items={recent} />
          </div>
        </section>
      </main>
    </>
  );
}
