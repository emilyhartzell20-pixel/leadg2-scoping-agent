import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { writeProposal } from "@/lib/agent";
import { leadg2Contact } from "@/lib/contact";
import { getSession, listProposals, saveProposal, saveSession } from "@/lib/storage";
import { errorResponse } from "@/lib/http";
import type { Proposal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    return NextResponse.json({ proposals: await listProposals() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Write the executive summary + deck copy from the reviewed scope and store the proposal. */
export async function POST(req: NextRequest) {
  try {
    const { sessionId } = (await req.json()) as { sessionId?: string };
    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const clientName = session.snapshot.company.name;
    const content = await writeProposal({
      clientName,
      analysis: session.analysis,
      scope: session.scope,
      answers: session.analysis.open_questions.map((q, i) => ({ question: q.question, answer: session.answers[i] ?? "" })),
      consultantNotes: session.consultantNotes,
    });

    const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "client";
    const proposal: Proposal = {
      id: `${slug}-${nanoid(8)}`,
      createdAt: new Date().toISOString(),
      sessionId,
      clientName,
      hubspotCompanyId: session.snapshot.company.id || undefined,
      content,
      scope: session.scope,
      terms: session.terms,
      contact: leadg2Contact(),
    };
    await saveProposal(proposal);
    session.status = "proposal";
    session.proposalId = proposal.id;
    await saveSession(session);
    return NextResponse.json({ id: proposal.id });
  } catch (err) {
    return errorResponse(err);
  }
}
