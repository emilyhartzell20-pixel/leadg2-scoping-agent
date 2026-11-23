import "server-only";
import { Client } from "@hubspot/api-client";
import { hubspotMessage } from "./hubspotErrors";
import type {
  CompanyMatch,
  EmailStats,
  EngagementType,
  HubSpotCompany,
  HubSpotContact,
  HubSpotDeal,
  HubSpotEngagement,
  HubSpotSnapshot,
} from "./types";

export const hubspotConfigured = Boolean(process.env.HUBSPOT_ACCESS_TOKEN);

function client() {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN is not set");
  return new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN, numberOfApiCallRetries: 3 });
}

/** Keep the whole record readable by Claude without blowing past the context window. */
const MAX_ITEM_CHARS = 25_000;
const MAX_TOTAL_CHARS = 600_000;
const MAX_TRANSCRIPTS = 20;

const COMPANY_PROPS = [
  "name", "domain", "industry", "numberofemployees", "annualrevenue", "city", "state", "country",
  "lifecyclestage", "description", "createdate", "notes_last_updated",
];
const CONTACT_PROPS = [
  "firstname", "lastname", "email", "jobtitle", "lifecyclestage", "hs_lead_status", "notes_last_updated",
  "hs_email_delivered", "hs_email_open", "hs_email_click", "hs_email_bounce", "hs_email_last_open_date",
];
const DEAL_PROPS = ["dealname", "amount", "dealstage", "closedate", "pipeline", "createdate", "description"];

const ENGAGEMENT_SPECS: Record<EngagementType, { object: string; props: string[] }> = {
  call: {
    object: "calls",
    props: ["hs_timestamp", "hs_call_title", "hs_call_body", "hs_call_summary", "hs_call_has_transcript", "hs_call_direction", "hs_call_duration", "hs_call_disposition"],
  },
  meeting: {
    object: "meetings",
    props: ["hs_timestamp", "hs_meeting_title", "hs_meeting_body", "hs_internal_meeting_notes", "hs_meeting_outcome"],
  },
  email: {
    object: "emails",
    props: ["hs_timestamp", "hs_email_subject", "hs_email_text", "hs_email_html", "hs_email_direction", "hs_email_from_email", "hs_email_to_email"],
  },
  note: { object: "notes", props: ["hs_timestamp", "hs_note_body"] },
  task: { object: "tasks", props: ["hs_timestamp", "hs_task_subject", "hs_task_body", "hs_task_status"] },
};

type Props = Record<string, string | null | undefined>;
const s = (v: string | null | undefined) => (v == null || v === "" ? undefined : v);
const n = (v: string | null | undefined) => (v ? Number(v) || 0 : 0);
const chunk = <T,>(arr: T[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

function stripHtml(v?: string) {
  return v
    ?.replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Drop the quoted reply chain so the same thread isn't read ten times. */
function stripQuotedReply(text?: string) {
  if (!text) return text;
  const cut = text.search(/\n\s*(On .{5,120} wrote:|-----Original Message-----|From: .+\nSent: )/);
  const body = cut > 0 ? text.slice(0, cut) : text;
  return body
    .split("\n")
    .filter((l) => !l.trim().startsWith(">"))
    .join("\n")
    .trim();
}

function toCompany(id: string, p: Props): HubSpotCompany {
  return {
    id,
    name: s(p.name) ?? "Unnamed company",
    domain: s(p.domain),
    industry: s(p.industry),
    employees: s(p.numberofemployees),
    annualRevenue: s(p.annualrevenue),
    city: s(p.city),
    state: s(p.state),
    country: s(p.country),
    lifecycleStage: s(p.lifecyclestage),
    description: s(p.description),
    createdAt: s(p.createdate),
    lastActivity: s(p.notes_last_updated),
  };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export async function searchCompanies(query: string): Promise<CompanyMatch[]> {
  const hs = client();
  const q = query.trim();
  const toMatch = (id: string, p: Props): CompanyMatch => ({
    id,
    name: s(p.name) ?? "Unnamed company",
    domain: s(p.domain),
    industry: s(p.industry),
    city: s(p.city),
    state: s(p.state),
  });

  if (/^\d+$/.test(q)) {
    try {
      const c = await hs.crm.companies.basicApi.getById(q, COMPANY_PROPS);
      return [toMatch(c.id, c.properties)];
    } catch {
      /* fall through to name search */
    }
  }

  const res = await hs.crm.companies.searchApi.doSearch({
    filterGroups: [
      { filters: [{ propertyName: "name", operator: "CONTAINS_TOKEN" as never, value: `*${q}*` }] },
      { filters: [{ propertyName: "domain", operator: "CONTAINS_TOKEN" as never, value: `*${q}*` }] },
    ],
    properties: ["name", "domain", "industry", "city", "state"],
    limit: 10,
    sorts: [],
    after: undefined as never,
  });
  return res.results.map((r) => toMatch(r.id, r.properties));
}

/* ------------------------------------------------------------------ */
/* Associations                                                        */
/* ------------------------------------------------------------------ */

/** All `to` IDs associated with any of `fromIds`, using the v4 batch endpoint. */
async function associatedIdsBatch(hs: Client, from: string, fromIds: string[], to: string): Promise<string[]> {
  const out = new Set<string>();
  for (const ids of chunk(fromIds, 100)) {
    let inputs = ids.map((id) => ({ id }) as { id: string; after?: string });
    // follow per-record paging (rare: >500 associations on a single record)
    for (let guard = 0; inputs.length && guard < 10; guard++) {
      const res = await hs.crm.associations.v4.batchApi.getPage(from, to, { inputs });
      const next: { id: string; after?: string }[] = [];
      for (const r of res.results) {
        for (const t of r.to) out.add(String(t.toObjectId));
        const after = (r as unknown as { paging?: { next?: { after?: string } } }).paging?.next?.after;
        if (after) next.push({ id: String(r._from.id), after });
      }
      inputs = next;
    }
  }
  return [...out];
}

async function batchRead(hs: Client, object: string, ids: string[], properties: string[]) {
  const results: { id: string; properties: Props }[] = [];
  for (const group of chunk(ids, 100)) {
    const res = await hs.crm.objects.batchApi.read(object, {
      inputs: group.map((id) => ({ id })),
      properties,
      propertiesWithHistory: [],
    });
    results.push(...res.results.map((r) => ({ id: r.id, properties: r.properties as Props })));
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Call transcripts (best effort — requires conversation intelligence) */
/* ------------------------------------------------------------------ */

async function fetchTranscript(hs: Client, callId: string): Promise<string | undefined> {
  try {
    const res = await hs.apiRequest({ method: "GET", path: `/crm/v3/extensions/calling/transcripts/${callId}` });
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      transcriptUtterances?: { speaker?: { name?: string; id?: string }; text?: string }[];
    };
    const lines = json.transcriptUtterances?.map((u) => `${u.speaker?.name ?? u.speaker?.id ?? "Speaker"}: ${u.text ?? ""}`);
    return lines?.length ? lines.join("\n") : undefined;
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Engagements                                                         */
/* ------------------------------------------------------------------ */

function toEngagement(type: EngagementType, id: string, p: Props): HubSpotEngagement {
  switch (type) {
    case "call": {
      const parts = [
        s(p.hs_call_summary) && `AI CALL SUMMARY:\n${stripHtml(p.hs_call_summary!)}`,
        s(p.hs_call_body) && `CALL NOTES:\n${stripHtml(p.hs_call_body!)}`,
      ].filter(Boolean);
      return {
        id, type, date: s(p.hs_timestamp), title: s(p.hs_call_title),
        direction: s(p.hs_call_direction), hasTranscript: p.hs_call_has_transcript === "true",
        body: parts.join("\n\n") || undefined,
      };
    }
    case "meeting": {
      const parts = [
        s(p.hs_meeting_body) && stripHtml(p.hs_meeting_body!),
        s(p.hs_internal_meeting_notes) && `INTERNAL NOTES:\n${stripHtml(p.hs_internal_meeting_notes!)}`,
        s(p.hs_meeting_outcome) && `Outcome: ${p.hs_meeting_outcome}`,
      ].filter(Boolean);
      return { id, type, date: s(p.hs_timestamp), title: s(p.hs_meeting_title), body: parts.join("\n\n") || undefined };
    }
    case "email":
      return {
        id, type, date: s(p.hs_timestamp), title: s(p.hs_email_subject), direction: s(p.hs_email_direction),
        participants: [s(p.hs_email_from_email) && `from ${p.hs_email_from_email}`, s(p.hs_email_to_email) && `to ${p.hs_email_to_email}`].filter(Boolean).join(" "),
        body: stripQuotedReply(s(p.hs_email_text) ?? stripHtml(s(p.hs_email_html))),
      };
    case "note":
      return { id, type, date: s(p.hs_timestamp), body: stripHtml(s(p.hs_note_body)) };
    case "task":
      return {
        id, type, date: s(p.hs_timestamp), title: s(p.hs_task_subject),
        body: [stripHtml(s(p.hs_task_body)), s(p.hs_task_status) && `Status: ${p.hs_task_status}`].filter(Boolean).join("\n") || undefined,
      };
  }
}

async function engagementsFor(
  hs: Client,
  owners: { companies: string[]; contacts: string[]; deals: string[] },
  warnings: string[]
): Promise<HubSpotEngagement[]> {
  const all: HubSpotEngagement[] = [];

  await Promise.all(
    (Object.keys(ENGAGEMENT_SPECS) as EngagementType[]).map(async (type) => {
      const spec = ENGAGEMENT_SPECS[type];
      try {
        const idSets = await Promise.all(
          (Object.entries(owners) as [string, string[]][])
            .filter(([, ids]) => ids.length)
            .map(([from, ids]) => associatedIdsBatch(hs, from, ids, spec.object))
        );
        const ids = [...new Set(idSets.flat())];
        if (!ids.length) return;
        const rows = await batchRead(hs, spec.object, ids, spec.props);
        all.push(...rows.map((r) => toEngagement(type, r.id, r.properties)));
      } catch (e) {
        warnings.push(`${spec.object} unavailable: ${errMsg(e)}`);
      }
    })
  );

  all.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  // Full transcripts for the most recent recorded calls.
  const withTranscript = all.filter((e) => e.type === "call" && e.hasTranscript).slice(0, MAX_TRANSCRIPTS);
  const transcripts = await Promise.all(withTranscript.map((c) => fetchTranscript(hs, c.id)));
  let missing = 0;
  withTranscript.forEach((c, i) => {
    if (transcripts[i]) c.body = [c.body, `FULL TRANSCRIPT:\n${transcripts[i]}`].filter(Boolean).join("\n\n");
    else missing++;
  });
  if (missing) warnings.push(`${missing} call transcript(s) couldn't be downloaded — used call summaries/notes instead.`);

  // Budget the total text, newest first.
  let used = 0;
  let omitted = 0;
  const kept: HubSpotEngagement[] = [];
  for (const e of all) {
    if (e.body && e.body.length > MAX_ITEM_CHARS) e.body = `${e.body.slice(0, MAX_ITEM_CHARS)}\n[…truncated]`;
    const size = (e.body?.length ?? 0) + (e.title?.length ?? 0) + 80;
    if (used + size > MAX_TOTAL_CHARS) {
      omitted++;
      continue;
    }
    used += size;
    kept.push(e);
  }
  if (omitted) warnings.push(`${omitted} oldest activities left out to fit the reading limit.`);
  return kept;
}

/* ------------------------------------------------------------------ */
/* Full dossier                                                        */
/* ------------------------------------------------------------------ */

export async function getCompanySnapshot(companyId: string): Promise<HubSpotSnapshot> {
  const hs = client();
  const warnings: string[] = [];

  const c = await hs.crm.companies.basicApi.getById(companyId, COMPANY_PROPS);
  const company = toCompany(c.id, c.properties);

  const [contactIds, dealIds] = await Promise.all([
    associatedIdsBatch(hs, "companies", [companyId], "contacts").catch((e) => {
      warnings.push(`Contacts unavailable: ${errMsg(e)}`);
      return [] as string[];
    }),
    associatedIdsBatch(hs, "companies", [companyId], "deals").catch((e) => {
      warnings.push(`Deals unavailable: ${errMsg(e)}`);
      return [] as string[];
    }),
  ]);

  const [contactRows, dealRows, engagements] = await Promise.all([
    contactIds.length ? batchRead(hs, "contacts", contactIds.slice(0, 300), CONTACT_PROPS) : [],
    dealIds.length ? batchRead(hs, "deals", dealIds.slice(0, 100), DEAL_PROPS) : [],
    engagementsFor(hs, { companies: [companyId], contacts: contactIds.slice(0, 300), deals: dealIds.slice(0, 100) }, warnings),
  ]);

  const contacts = contactRows.map<HubSpotContact>((r) => {
    const p = r.properties;
    return {
      id: r.id,
      name: [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "Unknown",
      email: s(p.email),
      title: s(p.jobtitle),
      lifecycleStage: s(p.lifecyclestage),
      leadStatus: s(p.hs_lead_status),
      lastActivity: s(p.notes_last_updated),
      emailsDelivered: n(p.hs_email_delivered),
      emailsOpened: n(p.hs_email_open),
      emailsClicked: n(p.hs_email_click),
      emailsBounced: n(p.hs_email_bounce),
      lastEmailOpen: s(p.hs_email_last_open_date),
    };
  });

  const deals = dealRows.map<HubSpotDeal>((r) => ({
    id: r.id,
    name: r.properties.dealname ?? "Untitled deal",
    amount: r.properties.amount ? Number(r.properties.amount) : undefined,
    stage: s(r.properties.dealstage),
    closeDate: s(r.properties.closedate),
    pipeline: s(r.properties.pipeline),
    createdAt: s(r.properties.createdate),
    description: stripHtml(s(r.properties.description)),
  }));

  if (deals.length) {
    try {
      const pipelines = await hs.crm.pipelines.pipelinesApi.getAll("deals");
      const labels = new Map<string, string>();
      for (const p of pipelines.results) for (const st of p.stages) labels.set(st.id, st.label);
      for (const d of deals) if (d.stage && labels.has(d.stage)) d.stage = labels.get(d.stage);
    } catch {
      /* keep raw stage IDs */
    }
  }

  return {
    source: "hubspot",
    company,
    contacts: contacts.sort((a, b) => b.emailsOpened - a.emailsOpened),
    deals,
    engagements,
    emailStats: emailStatsFrom(contacts),
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}

function emailStatsFrom(contacts: HubSpotContact[]): EmailStats {
  const delivered = contacts.reduce((a, c) => a + c.emailsDelivered, 0);
  const opened = contacts.reduce((a, c) => a + c.emailsOpened, 0);
  const clicked = contacts.reduce((a, c) => a + c.emailsClicked, 0);
  const bounced = contacts.reduce((a, c) => a + c.emailsBounced, 0);
  return {
    delivered,
    opened,
    clicked,
    bounced,
    openRate: delivered ? Math.round((opened / delivered) * 1000) / 10 : 0,
    clickRate: delivered ? Math.round((clicked / delivered) * 1000) / 10 : 0,
    engagedContacts: contacts.filter((c) => c.emailsOpened > 0 || c.emailsClicked > 0).length,
  };
}

export function manualSnapshot(name: string): HubSpotSnapshot {
  return {
    source: "manual",
    company: { id: "", name },
    contacts: [],
    deals: [],
    engagements: [],
    emailStats: { delivered: 0, opened: 0, clicked: 0, bounced: 0, openRate: 0, clickRate: 0, engagedContacts: 0 },
    warnings: ["No HubSpot record — working from the sources you added."],
    fetchedAt: new Date().toISOString(),
  };
}

function errMsg(e: unknown) {
  const hs = hubspotMessage(e);
  if (hs) return hs.status === 403 ? `missing HubSpot permission — ${hs.message.split(": ")[1]?.split(".")[0] ?? "check scopes"}` : hs.message;
  return e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "unknown error";
}
