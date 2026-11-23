import { claudeConfigured } from "@/lib/agent";
import { hubspotConfigured } from "@/lib/hubspot";
import { storageMode } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Setup check — reports only whether each setting is present, never the values. */
export function GET() {
  return Response.json({
    ok: true,
    claudeApiKey: claudeConfigured(),
    hubspotToken: hubspotConfigured,
    storage: storageMode === "redis" ? "upstash-redis" : process.env.DATA_DIR ? `disk (${process.env.DATA_DIR})` : "local ./.data (not persistent on Render)",
    passwordProtected: Boolean(process.env.APP_PASSWORD),
  });
}
