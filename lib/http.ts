import { NextResponse } from "next/server";
import { AgentError } from "./agent";

export function errorResponse(err: unknown) {
  console.error(err);
  if (err instanceof AgentError) return NextResponse.json({ error: err.message }, { status: err.status });
  const message = err instanceof Error ? err.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
