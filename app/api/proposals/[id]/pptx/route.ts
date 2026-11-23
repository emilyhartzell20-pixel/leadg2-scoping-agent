import { NextResponse } from "next/server";
import { getProposal } from "@/lib/storage";
import { buildDeck } from "@/lib/pptx";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Build the 9-slide deck on the server and stream it back as a download. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = await getProposal(id);
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    const buf = await buildDeck(proposal);
    const filename = `${proposal.clientName.replace(/[^a-z0-9]+/gi, "_")}_x_LeadG2.pptx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
