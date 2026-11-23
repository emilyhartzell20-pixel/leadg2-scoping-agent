import { notFound } from "next/navigation";
import { AppHeader } from "@/components/Brand";
import { ScopeReview } from "@/components/ScopeReview";
import { SnapshotPanel } from "@/components/SnapshotPanel";
import { getSession } from "@/lib/storage";
import { getCatalog } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ScopePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, catalog] = await Promise.all([getSession(id), getCatalog()]);
  if (!session) notFound();

  return (
    <>
      <AppHeader />
      <div className="lg:grid lg:grid-cols-[360px_1fr]">
        <div className="border-b border-line bg-navy/40 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <details className="lg:hidden">
            <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-steel">
              {session.snapshot.company.name} — sources & HubSpot data
            </summary>
            <SnapshotPanel s={session.snapshot} sources={session.sources} />
          </details>
          <div className="hidden lg:block">
            <SnapshotPanel s={session.snapshot} sources={session.sources} />
          </div>
        </div>
        <ScopeReview initial={session} catalog={catalog.products} catalogSource={catalog.source} />
      </div>
    </>
  );
}
