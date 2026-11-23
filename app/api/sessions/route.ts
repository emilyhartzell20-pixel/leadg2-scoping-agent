import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getCompanySnapshot, manualSnapshot } from "@/lib/hubspot";
import { analyzeProspect, scopeFromRecommendation, suggestionsFromRecommendation } from "@/lib/agent";
import { getCatalog } from "@/lib/products";
import { saveSession } from "@/lib/storage";
import { errorResponse } from "@/lib/http";
import type { ExtraSource, ScopingSession } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function firstOfNextMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 12).toISOString().slice(0, 10);
}

/** Pull the full HubSpot record + added sources, have Claude read it all and recommend a priced scope. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { companyId?: string; companyName?: string; notes?: string; sources?: ExtraSource[] };
    if (!body.companyId && !body.companyName?.trim()) {
      return NextResponse.json({ error: "Provide companyId or companyName" }, { status: 400 });
    }
    const sources = (body.sources ?? []).filter((s) => s?.data && (s.kind === "text" || s.kind === "pdf"));
    const notes = body.notes ?? "";
    if (!body.companyId && !sources.length && !notes.trim()) {
      return NextResponse.json({ error: "Without a HubSpot record, add call notes, transcripts or documents to analyze." }, { status: 400 });
    }

    const [snapshot, catalog] = await Promise.all([
      body.companyId ? getCompanySnapshot(body.companyId) : Promise.resolve(manualSnapshot(body.companyName!.trim())),
      getCatalog(),
    ]);
    const analysis = await analyzeProspect(snapshot, sources, notes, catalog.products);

    const now = new Date().toISOString();
    const session: ScopingSession = {
      id: nanoid(12),
      createdAt: now,
      updatedAt: now,
      snapshot,
      sources: [
        ...sources.map((s) => ({ name: s.name, kind: s.kind, chars: s.kind === "text" ? s.data.length : 0 })),
        ...(notes.trim() ? [{ name: "Consultant notes", kind: "text", chars: notes.length }] : []),
      ],
      analysis,
      scope: scopeFromRecommendation(analysis.recommendation, catalog.products),
      suggestions: suggestionsFromRecommendation(analysis.recommendation, catalog.products),
      terms: { contractStart: firstOfNextMonth(), hubspotInvestment: "", exclusions: "Excludes HubSpot licensing and third-party costs." },
      answers: {},
      consultantNotes: notes,
      status: "review",
    };
    await saveSession(session);
    return NextResponse.json({ id: session.id });
  } catch (err) {
    return errorResponse(err);
  }
}
