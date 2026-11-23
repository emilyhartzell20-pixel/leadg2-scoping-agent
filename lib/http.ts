import { NextResponse } from "next/server";
import { AgentError } from "./agent";
import { hubspotMessage } from "./hubspotErrors";

export function errorResponse(err: unknown) {
  if (err instanceof AgentError) {
    console.error(err.message);
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const hs = hubspotMessage(err);
  if (hs) {
    console.error("HubSpot:", hs.message);
    return NextResponse.json({ error: hs.message }, { status: hs.status });
  }
  console.error(err);
  const message = err instanceof Error ? err.message.split("\n")[0].slice(0, 300) : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
