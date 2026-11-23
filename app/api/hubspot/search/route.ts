import { NextRequest, NextResponse } from "next/server";
import { hubspotConfigured, searchCompanies } from "@/lib/hubspot";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  if (!hubspotConfigured) return NextResponse.json({ configured: false, results: [] });
  try {
    return NextResponse.json({ configured: true, results: await searchCompanies(q) });
  } catch (err) {
    return errorResponse(err);
  }
}
