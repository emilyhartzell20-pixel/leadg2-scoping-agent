import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { pointItem, pointsForPrompt, WHO_WE_ARE } from "./offerings";
import { catalogForPrompt } from "./products";
import { CONSULTING_MONTHLY, HOURLY_RATE, allTotals, consultingName, lineTotal, monthlyPoints, newKey, type CatalogProduct, type LineItem, type ScopeDraft } from "./pricing";
import {
  AnalysisSchema,
  ProposalContentSchema,
  formatUSD,
  type Analysis,
  type ExtraSource,
  type HubSpotSnapshot,
  type ProposalContent,
} from "./types";

const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: if the primary model declines, the API re-runs the request on a fallback model.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const anthropic = new Anthropic();

export class AgentError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

function handleApiError(err: unknown): never {
  if (err instanceof AgentError) throw err;
  if (err instanceof Anthropic.AuthenticationError) throw new AgentError("Anthropic API key is missing or invalid.", 500);
  if (err instanceof Anthropic.RateLimitError) throw new AgentError("Claude is rate limited — try again in a moment.", 429);
  if (err instanceof Anthropic.BadRequestError) throw new AgentError(`Claude request rejected: ${err.message}`, 400);
  if (err instanceof Anthropic.APIError) throw new AgentError(`Claude API error (${err.status}): ${err.message}`, 502);
  throw err;
}

/** Streams a structured-output request (long inputs/outputs) and validates the JSON against the schema. */
async function structured<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Anthropic.Beta.Messages.BetaContentBlockParam[];
  effort: "medium" | "high" | "xhigh";
}): Promise<z.infer<S>> {
  try {
    const stream = anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AgentError("Claude declined this request.", 422);
    if (msg.stop_reason === "max_tokens") throw new AgentError("Claude's response was cut off — please retry.", 502);
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AgentError("Claude returned malformed JSON — please retry.", 502);
    }
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) throw new AgentError("Claude's response didn't match the expected shape — please retry.", 502);
    return parsed.data;
  } catch (err) {
    handleApiError(err);
  }
}

/* ------------------------------------------------------------------ */
/* Dossier → prompt text                                               */
/* ------------------------------------------------------------------ */

export function dossierText(s: HubSpotSnapshot): string {
  if (s.source === "manual") return `CLIENT: ${s.company.name}\n(No HubSpot record. Rely on the added sources.)`;
  const c = s.company;
  const L: string[] = [];
  L.push(`COMPANY: ${c.name} (HubSpot ID ${c.id})`);
  L.push(
    [
      c.domain && `Domain: ${c.domain}`,
      c.industry && `Industry: ${c.industry}`,
      c.employees && `Employees: ${c.employees}`,
      c.annualRevenue && `Annual revenue: ${c.annualRevenue}`,
      (c.city || c.state) && `Location: ${[c.city, c.state, c.country].filter(Boolean).join(", ")}`,
      c.lifecycleStage && `Lifecycle stage: ${c.lifecycleStage}`,
    ]
      .filter(Boolean)
      .join(" | ")
  );
  if (c.description) L.push(`Description: ${c.description}`);

  L.push(`\nCONTACTS (${s.contacts.length}):`);
  for (const ct of s.contacts.slice(0, 60)) {
    L.push(`- ${ct.name}${ct.title ? `, ${ct.title}` : ""}${ct.email ? ` <${ct.email}>` : ""}${ct.lifecycleStage ? ` [${ct.lifecycleStage}]` : ""} — marketing emails delivered ${ct.emailsDelivered}, opened ${ct.emailsOpened}, clicked ${ct.emailsClicked}`);
  }

  L.push(`\nDEALS (${s.deals.length}):`);
  for (const d of s.deals) {
    L.push(`- ${d.name}: ${d.amount != null ? `$${d.amount.toLocaleString()}` : "no amount"}, stage ${d.stage ?? "?"}${d.closeDate ? `, close ${d.closeDate.slice(0, 10)}` : ""}${d.description ? `\n  ${d.description}` : ""}`);
  }

  const e = s.emailStats;
  L.push(`\nMARKETING EMAIL ENGAGEMENT: delivered ${e.delivered}, open rate ${e.openRate}%, click rate ${e.clickRate}%, engaged contacts ${e.engagedContacts}/${s.contacts.length}`);

  L.push(`\nACTIVITY HISTORY — ${s.engagements.length} records, newest first. Read all of it.`);
  for (const en of s.engagements) {
    const head = `\n=== ${en.type.toUpperCase()} · ${en.date?.slice(0, 10) ?? "undated"}${en.title ? ` · "${en.title}"` : ""}${en.direction ? ` · ${en.direction}` : ""}${en.participants ? ` · ${en.participants}` : ""}`;
    L.push(head);
    if (en.body) L.push(en.body);
  }
  if (s.warnings.length) L.push(`\nDATA GAPS: ${s.warnings.join("; ")}`);
  return L.join("\n");
}

function sourceBlocks(sources: ExtraSource[]): Anthropic.Beta.Messages.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  for (const src of sources) {
    if (src.kind === "pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: src.data }, title: src.name });
    }
  }
  const texts = sources.filter((s) => s.kind === "text");
  if (texts.length) {
    blocks.push({
      type: "text",
      text: texts.map((t) => `=== ADDED SOURCE: ${t.name} ===\n${t.data}`).join("\n\n"),
    });
  }
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Step 1 — read everything, recommend a scope                         */
/* ------------------------------------------------------------------ */

function analysisSystem(products: CatalogProduct[]) {
  return `You are LeadG2's senior solutions consultant. LeadG2 (by The Center for Sales Strategy) is a HubSpot Diamond Solution Partner. It sells HubSpot onboarding and implementation, migrations and integrations, marketing/HubSpot consulting retainers, websites on Content Hub, podcasting, AEO, and a monthly allocation of "service points" spent on deliverables.

You'll be given everything known about a prospect: HubSpot CRM data, every call (notes, AI summaries, transcripts), email, meeting, note and task, plus any documents the consultant added. Read all of it carefully. Then:

1. Pull out what we've learned — specific, evidence-backed findings. Quote or closely paraphrase the prospect and name the source (type, date, person). Never invent facts; if something isn't in the material, put it in open_questions.
2. Identify desired business results, pain points, the systems they run today, stakeholders, HubSpot status, budget and timeline signals.
3. Recommend the best-of-the-best scope — what a top LeadG2 consultant would actually propose to win the deal and get the client results — priced ONLY from LeadG2's product library below and the hourly rate. LeadG2 structures deals in two sides of the house:
   A. HubSpot implementation side (onboarding, portal setup, migration, integration, custom objects): a FIXED-PRICE scope of work — one-time line items, each a defined deliverable at a fixed price. Use library products wherever they fit; only create custom items for work the library doesn't cover. LeadG2 doesn't sell hours, so never describe work in hours in client-facing names.
   B. Marketing / growth side: the CONSULTING retainer plus SERVICE POINTS. Consulting is $${CONSULTING_MONTHLY}/month and covers marketing strategy, HubSpot strategy, or both for the same fee — set recommendation.consulting, never add a consulting product. Service points sit on top for deliverables. Other monthly products (AEO outreach, website maintenance, post-onboarding subscriptions) are additions on top of consulting.
   Most clients need one side; many need both (e.g. onboard HubSpot, then run marketing through it). Recommend consulting whenever there's ongoing strategy, optimization or adoption work.
   - Use exact product ids. Pick the right tier (Essential / Standard / Elite, Pro / Enterprise) for their size and complexity. [Base] HubSpot Portal Discovery is required for new work in an existing portal; [Base] HubSpot Foundations is required for new portals.
   - Integration builds (connecting HubSpot to billing systems, ERPs, order management, custom APIs) and data migrations beyond the library's Data Import products are OUTSOURCED to a vendor: product_id "", outsourced true, a recommended starting est_price for the whole item (realistic market rates — e.g. a native-connector configuration can be a few thousand dollars; a custom two-system API integration often $25K-$75K+; multi-source CRM migration $10K-$40K depending on record counts and sources), and the deliverables the vendor will build. hours = 0. The consultant replaces this with the vendor's quote later.
   - Anything else the library doesn't cover is custom work: product_id "", outsourced false, with an internal effort estimate in hours, which sets its fixed price at $${HOURLY_RATE}/hour (e.g. a custom API integration build, multi-source data migration, technical discovery, a post-launch support-hour bank, HubSpot admin-as-a-service). Estimate hours realistically.
   - Service points (1 point = 1 hour = $${HOURLY_RATE}) cover ongoing marketing, HubSpot and sales-enablement deliverables. Build a monthly mix only if they need ongoing work, tied to goals.
   - Respect budget signals, but don't under-scope: if the goals need more than the budget covers, recommend what's right and put the rest in optional_addons.
   - optional_addons: 2-4 high-value items you'd also offer (e.g. AI Visibility Audit, Content Marketing Plan, a podcast, an in-market workshop, an Elite tier upgrade), each with a sharp reason.
4. Size the deal honestly:
   - focused: one team, a few products, maybe a points retainer. No options.
   - growth: onboarding plus a retainer; options only if there's a real choice.
   - enterprise (multi-market, multiple CRMs or billing systems, migrations, integrations — like LeadG2's BridgeTower Media and Hubbard Broadcasting proposals): one shared implementation in line_items, then 2-3 partnership options that differ in post-launch adoption support and term (e.g. Guided +3 months, Collaborative +6, Embedded +12, with growing training hours, office hours and support banks), each priced by hours. Where an integration could be built two ways (middleware/iPaaS vs direct API), say so in the approach and price the recommended path. A Preferred Partner discount (typically 5%) is appropriate for enterprise deals.
5. Lay out 4-6 roadmap phases across the term.

Be specific and commercially sharp. No generic agency filler.

PRODUCT LIBRARY (LeadG2's HubSpot products — use these ids and prices):
${catalogForPrompt(products, HOURLY_RATE)}

SERVICE POINTS MENU (id: deliverable — points per unit):
${pointsForPrompt()}`;
}

export async function analyzeProspect(snapshot: HubSpotSnapshot, sources: ExtraSource[], notes: string, products: CatalogProduct[]): Promise<Analysis> {
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    ...sourceBlocks(sources),
    {
      type: "text",
      text: `HUBSPOT RECORD\n${dossierText(snapshot)}${notes.trim() ? `\n\nCONSULTANT NOTES\n${notes.trim()}` : ""}\n\nAnalyze ${snapshot.company.name} and recommend the scope.`,
    },
  ];
  const analysis = await structured({ schema: AnalysisSchema, system: analysisSystem(products), content, effort: "high" });
  analysis.recommendation.points_plan = analysis.recommendation.points_plan
    .filter((p) => pointItem(p.id) && p.qty_per_month > 0)
    .map((p) => ({ ...p, qty_per_month: Math.round(p.qty_per_month * 100) / 100 }));
  analysis.recommendation.term_months = Math.max(1, Math.round(analysis.recommendation.term_months || 12));
  return analysis;
}

/** Turn Claude's recommendation into priced line items. Prices always come from the product library, never the model. */
export function suggestionsFromRecommendation(rec: Analysis["recommendation"], products: CatalogProduct[]): LineItem[] {
  return scopeFromRecommendation({ ...rec, line_items: rec.optional_addons ?? [], options: [] }, products).lineItems;
}

export function scopeFromRecommendation(rec: Analysis["recommendation"], products: CatalogProduct[]): ScopeDraft {
  const byId = new Map(products.map((p) => [p.id, p]));
  type Rec = Analysis["recommendation"]["line_items"][number];
  const toItem = (r: Rec): LineItem | null => {
    const qty = Math.max(0, Number(r.qty) || 1);
    const prod = r.product_id ? byId.get(r.product_id) : undefined;
    if (r.product_id && !prod) return null; // unknown id — drop rather than invent a price
    if (!prod && r.outsourced) {
      return {
        key: newKey(),
        productId: null,
        name: r.name,
        description: (r.deliverables ?? []).join("\n"),
        billing: "one_time",
        qty: 1,
        unitPrice: Math.max(0, Math.round(r.est_price || 0)),
        hours: null,
        rationale: r.rationale,
        vendor: true,
      };
    }
    if (prod) {
      return {
        key: newKey(),
        productId: prod.id,
        name: prod.name,
        description: prod.description,
        billing: prod.billing,
        qty,
        unitPrice: prod.price,
        hours: prod.hourly ? Math.max(1, Math.round(r.hours) || 1) : null,
        rationale: r.rationale,
      };
    }
    return {
      key: newKey(),
      productId: null,
      name: r.name,
      description: (r.deliverables ?? []).join("\n"),
      billing: r.billing,
      qty,
      unitPrice: 0,
      hours: Math.max(1, Math.round(r.hours) || 1),
      rationale: r.rationale,
    };
  };
  const items = (list: Rec[]) => list.map(toItem).filter((x): x is LineItem => Boolean(x));
  return {
    consulting: { marketing: Boolean(rec.consulting?.marketing), hubspot: Boolean(rec.consulting?.hubspot), rationale: rec.consulting?.rationale ?? "" },
    termMonths: rec.term_months,
    lineItems: items(rec.line_items),
    points: Object.fromEntries(rec.points_plan.map((p) => [p.id, p.qty_per_month])),
    options: rec.options.slice(0, 3).map((o) => ({
      key: newKey(),
      name: o.name,
      tagline: o.tagline,
      termMonths: Math.max(1, Math.round(o.term_months) || rec.term_months),
      recommended: o.recommended,
      lineItems: items(o.line_items),
    })),
    discountPct: Math.max(0, Math.min(25, rec.discount_pct || 0)),
    discountLabel: rec.discount_pct ? "Preferred Partner discount" : "",
  };
}


/* ------------------------------------------------------------------ */
/* Step 2 — write the executive summary + deck copy                    */
/* ------------------------------------------------------------------ */

const PROPOSAL_SYSTEM = `You are LeadG2's lead solutions consultant writing the client-facing executive summary and presentation for a proposal.

About LeadG2: ${WHO_WE_ARE}

Write from the analysis, the consultant's answers and the FINAL scope (the consultant may have changed the recommendation — the final scope wins). Rules:
- Specific to this client: their words, their numbers, their goals. No buzzwords, no generic filler.
- "What we've learned" and "Desired business results" are client-facing: confident, respectful, and never reveal internal notes about budget haggling or private opinions.
- item_notes: one entry for each line item in the final scope, using its exact name.
- scope_phases: three plain-language stages that explain the work.
- consulting_summary: what the bi-weekly consulting will focus on for this client (empty if there's no consulting retainer).
- points_focus: explain how the monthly points will be used, referencing the actual deliverables (empty if none).
- open_questions: only questions still unanswered after the consultant's answers, phrased for the client.
- Integration and migration items are delivered with a specialist partner and priced as estimates until the vendor quotes; it's fine to say so, never name a vendor.
- Never quote prices or hours in the copy — pricing is rendered separately from the final scope, and implementation work is sold as fixed-price deliverables, not hours.
- Keep every string tight enough to fit on a slide: titles 2-6 words, descriptions one sentence.
- Voice: plain, confident, sentence case. Short declarative headlines ("Forecasts built by hand", "One customer view").`;

export function scopeText(scope: ScopeDraft): string {
  const line = (li: LineItem) =>
    `- ${li.name}${li.qty !== 1 ? ` × ${li.qty}` : ""} — ${formatUSD(lineTotal(li))}${li.billing === "monthly" ? "/month" : li.vendor ? " one-time (vendor estimate, pending quote)" : " one-time (fixed price)"}`;
  const consult = consultingName(scope.consulting);
  const pts = Object.entries(scope.points)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `- ${q} × ${pointItem(id)?.name ?? id}`)
    .join("\n");
  const totals = allTotals(scope);
  const parts = [
    consult ? `CONSULTING RETAINER: ${consult} — ${formatUSD(CONSULTING_MONTHLY)}/month` : "NO CONSULTING RETAINER",
    `CORE SCOPE (in every option):\n${scope.lineItems.map(line).join("\n") || "- none"}`,
    pts ? `MONTHLY SERVICE POINTS: ${monthlyPoints(scope.points)} points/month ($${HOURLY_RATE}/point)\n${pts}` : "",
    ...scope.options.map(
      (o) => `OPTION "${o.name}"${o.recommended ? " (recommended)" : ""} — ${o.termMonths} months. ${o.tagline}\n${o.lineItems.map(line).join("\n") || "- no additions"}`
    ),
    !scope.options.length ? `TERM: ${scope.termMonths} months` : "",
    `TOTALS: ${totals.map((t) => `${t.label}: ${formatUSD(t.total)} over ${t.termMonths} months`).join("; ")}${scope.discountPct ? ` (after ${scope.discountPct}% ${scope.discountLabel || "discount"})` : ""}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

export async function writeProposal(input: {
  clientName: string;
  analysis: Analysis;
  scope: ScopeDraft;
  answers: { question: string; answer: string }[];
  consultantNotes: string;
}): Promise<ProposalContent> {
  const answered = input.answers.filter((a) => a.answer.trim());
  const text = [
    `CLIENT: ${input.clientName}`,
    `ANALYSIS\n${JSON.stringify(input.analysis, null, 2)}`,
    answered.length ? `CONSULTANT ANSWERS TO OPEN QUESTIONS\n${answered.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}` : "",
    input.consultantNotes.trim() ? `CONSULTANT NOTES\n${input.consultantNotes.trim()}` : "",
    `FINAL SCOPE\n${scopeText(input.scope)}`,
    `Write the executive summary and presentation copy for ${input.clientName}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content = await structured({
    schema: ProposalContentSchema,
    system: PROPOSAL_SYSTEM,
    content: [{ type: "text", text }],
    effort: "high",
  });
  return content;
}
