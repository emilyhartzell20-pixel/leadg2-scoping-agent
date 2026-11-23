import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/storage";
import { errorResponse } from "@/lib/http";
import type { DealTerms, ScopeDraft } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(session);
}

/** Save the consultant's edits to scope, answers and investment. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession(id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const body = (await req.json()) as {
      scope?: ScopeDraft;
      answers?: Record<string, string>;
      consultantNotes?: string;
      terms?: DealTerms;
    };
    if (body.scope) session.scope = body.scope;
    if (body.answers) session.answers = body.answers;
    if (typeof body.consultantNotes === "string") session.consultantNotes = body.consultantNotes;
    if (body.terms) session.terms = body.terms;
    session.updatedAt = new Date().toISOString();
    await saveSession(session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
