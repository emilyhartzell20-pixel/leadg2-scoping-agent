import { AppHeader } from "@/components/Brand";
import { ProposalList } from "@/components/ProposalList";
import { listProposals } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const items = await listProposals(200);
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <p className="eyebrow">Library</p>
        <h1 className="mb-8 mt-2 text-4xl">All proposals</h1>
        <ProposalList items={items} />
      </main>
    </>
  );
}
