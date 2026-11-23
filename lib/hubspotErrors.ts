/** Parse HubSpot API client errors into short, actionable messages. */
type HubSpotBody = {
  message?: string;
  category?: string;
  errors?: { message?: string; context?: { requiredGranularScopes?: string[]; requiredScopes?: string[] } }[];
};

/** Turn a HubSpot client ApiException into a short, actionable message (never the raw headers/body). */
export function hubspotMessage(err: unknown): { status: number; message: string } | null {
  if (!err || typeof err !== "object" || !("code" in err) || !("body" in err)) return null;
  const code = Number((err as { code: unknown }).code);
  if (!Number.isFinite(code)) return null;
  let body: unknown = (err as { body: unknown }).body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body as string) as HubSpotBody;
    } catch {
      body = { message: body };
    }
  }
  const b = (body ?? {}) as HubSpotBody;

  if (b.category === "MISSING_SCOPES" || code === 403) {
    const scopes = [...new Set((b.errors ?? []).flatMap((e) => e.context?.requiredGranularScopes ?? e.context?.requiredScopes ?? []))];
    // HubSpot lists alternatives ("one or more of"); the plain .read scope is the one to add.
    const plain = scopes.filter((s) => !/sensitive/.test(s));
    const suggested = plain.filter((s) => s.startsWith("crm.objects.")).slice(0, 1).concat(plain.filter((s) => !s.startsWith("crm.objects.") && !s.startsWith("crm.schemas.")));
    if (!suggested.length && plain.length) suggested.push(plain[0]);
    return {
      status: 403,
      message:
        `HubSpot blocked this request because the private app is missing a permission` +
        (suggested.length ? `: ${suggested.join(", ")}.` : ".") +
        ` In HubSpot go to Settings → Integrations → Private Apps → your app → Scopes, add it, and click Commit changes. The access token stays the same.`,
    };
  }
  if (code === 401) return { status: 401, message: "HubSpot rejected the access token. Check HUBSPOT_ACCESS_TOKEN — it may be expired or rotated." };
  if (code === 429) return { status: 429, message: "HubSpot rate limit hit — wait a few seconds and try again." };
  if (code === 404) return { status: 404, message: "That HubSpot record wasn't found." };
  return { status: code >= 400 && code < 600 ? code : 502, message: `HubSpot error (${code}): ${b.message ?? "request failed"}` };
}

