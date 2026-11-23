import { AppHeader } from "@/components/Brand";
import { ProposalList } from "@/components/ProposalList";
import { listProposals } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const items = await listProposals(200);
  return (
    <>
      <AppHeader />
      <section className="bg-cream">
        <div className="mx-auto max-w-page px-[18px] pb-14 pt-16 sm:px-8">
          <h1 className="text-[40px]">
            All <span className="accent">proposals</span>
          </h1>
          <p className="lead mt-3">Every executive summary and deck you&apos;ve generated, newest first.</p>
        </div>
      </section>
      <main className="mx-auto max-w-page px-[18px] py-12 sm:px-8">
        <ProposalList items={items} />
      </main>
    </>
  );
}
