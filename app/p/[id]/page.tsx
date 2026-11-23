import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalView } from "@/components/ProposalView";
import { getProposal } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getProposal(id);
  if (!p) return { title: "Proposal not found" };
  return {
    title: `${p.clientName} — ${p.content.engagement_type} | LeadG2`,
    description: p.content.tagline,
    robots: { index: false, follow: false },
  };
}

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) notFound();
  return <ProposalView p={proposal} sessionId={proposal.sessionId} />;
}
