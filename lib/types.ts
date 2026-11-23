import { z } from "zod";
import { POINT_IDS } from "./offerings";
import type { ScopeDraft } from "./pricing";
export type { ScopeDraft } from "./pricing";
export { monthlyPoints } from "./pricing";

/* ------------------------------------------------------------------ */
/* HubSpot dossier                                                     */
/* ------------------------------------------------------------------ */

export interface HubSpotCompany {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  employees?: string;
  annualRevenue?: string;
  city?: string;
  state?: string;
  country?: string;
  lifecycleStage?: string;
  description?: string;
  createdAt?: string;
  lastActivity?: string;
}

export interface HubSpotContact {
  id: string;
  name: string;
  email?: string;
  title?: string;
  lifecycleStage?: string;
  leadStatus?: string;
  lastActivity?: string;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsBounced: number;
  lastEmailOpen?: string;
}

export interface HubSpotDeal {
  id: string;
  name: string;
  amount?: number;
  stage?: string;
  closeDate?: string;
  pipeline?: string;
  createdAt?: string;
  description?: string;
}

export type EngagementType = "call" | "meeting" | "email" | "note" | "task";

export interface HubSpotEngagement {
  id: string;
  type: EngagementType;
  date?: string;
  title?: string;
  /** Full text: call notes + AI summary + transcript, email body, meeting notes, note body. */
  body?: string;
  direction?: string;
  participants?: string;
  hasTranscript?: boolean;
}

export interface EmailStats {
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  engagedContacts: number;
}

export interface HubSpotSnapshot {
  source: "hubspot" | "manual";
  company: HubSpotCompany;
  contacts: HubSpotContact[];
  deals: HubSpotDeal[];
  engagements: HubSpotEngagement[];
  emailStats: EmailStats;
  warnings: string[];
  fetchedAt: string;
}

export interface CompanyMatch {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  city?: string;
  state?: string;
}

/** Extra material the consultant adds: call transcripts, discovery notes, RFPs, PDFs. */
export interface ExtraSource {
  name: string;
  kind: "text" | "pdf";
  /** text content, or base64 for PDFs */
  data: string;
}

/* ------------------------------------------------------------------ */
/* Step 1 — analysis + recommended scope (Claude reads everything)     */
/* ------------------------------------------------------------------ */

const PhaseSchema = z.object({
  phase: z.string().describe("e.g. 'Phase 1'"),
  months: z.string().describe("e.g. 'Months 1-3'"),
  title: z.string().describe("2-4 word phase name"),
  activities: z.array(z.string()).describe("3-4 key activities"),
  milestone: z.string(),
});

const LineItemRecSchema = z.object({
  product_id: z.string().describe("Exact id from the PRODUCT LIBRARY, or empty string for custom or outsourced work"),
  outsourced: z.boolean().describe("true for integration builds and data migrations beyond the library's Data Import products — LeadG2 outsources these to a vendor"),
  est_price: z.number().describe("Outsourced items only: recommended starting price in USD for the whole item (realistic market rate). 0 otherwise."),
  deliverables: z.array(z.string()).describe("Outsourced and custom items: 3-6 concrete deliverables. Empty for library products."),
  name: z.string().describe("Product name, or a short name for the custom work (e.g. 'Marketron → HubSpot integration build')"),
  qty: z.number().describe("Quantity. For monthly products this is units per month."),
  hours: z.number().describe("Custom work or $0 hourly products: estimated hours per unit. 0 for priced products."),
  billing: z.enum(["one_time", "monthly"]).describe("Only used for custom work; priced products use the library's billing"),
  rationale: z.string().describe("Why this is in scope, tied to evidence"),
});

export const AnalysisSchema = z.object({
  situation: z.string().describe("3-4 sentence read on where the prospect is and why they're talking to LeadG2"),
  deal_size: z.enum(["focused", "growth", "enterprise"]).describe("focused = single-team / under ~$50K; enterprise = multi-market, multi-system, migrations or integrations"),
  what_we_learned: z
    .array(
      z.object({
        point: z.string().describe("One insight, written so it can go straight into the executive summary"),
        evidence: z.string().describe("Short quote or paraphrase from the source material that supports it"),
        source: z.string().describe("Where it came from, e.g. 'Discovery call 2026-10-14 — Dana Whitaker' or 'Email 2026-10-20'"),
      })
    )
    .describe("5-8 specific findings from calls, emails, meetings, notes and documents"),
  desired_business_results: z.array(z.string()).describe("3-5 outcomes the prospect wants, in their words where possible"),
  pain_points: z.array(z.object({ title: z.string(), detail: z.string() })).describe("Exactly 4"),
  current_systems: z.array(z.object({ name: z.string(), role: z.string() })).describe("Systems in their stack today (CRMs, billing, OMS, email tools). Empty if unknown."),
  stakeholders: z
    .array(z.object({ name: z.string(), role: z.string(), involvement: z.string().describe("Decision maker, champion, influencer, user…") }))
    .describe("People involved in the decision"),
  hubspot_status: z.string().describe("What HubSpot hubs/tiers they have or are buying, and how well it's set up"),
  budget_signals: z.string().describe("Anything said about budget; 'None found' if nothing"),
  timeline_signals: z.string().describe("Anything said about timing or deadlines; 'None found' if nothing"),
  open_questions: z
    .array(z.object({ question: z.string(), why: z.string().describe("Why the answer changes the scope or price") }))
    .describe("0-5 gaps that would change scope or price. Empty if the record is complete."),
  recommendation: z.object({
    approach: z.string().describe("2-3 sentences: the recommended engagement and why"),
    consulting: z
      .object({
        marketing: z.boolean().describe("Include marketing strategy consulting"),
        hubspot: z.boolean().describe("Include HubSpot strategy consulting"),
        rationale: z.string(),
      })
      .describe("The $2,000/month consulting retainer — marketing, HubSpot, or both for the same fee. Both false = no retainer."),
    line_items: z
      .array(LineItemRecSchema)
      .describe("Core scope included no matter which option is chosen: the fixed HubSpot scope of work (one-time) plus any monthly add-ons"),
    optional_addons: z
      .array(LineItemRecSchema)
      .describe("2-4 high-value additions NOT in the recommended scope that the consultant could offer (upsells, stretch items). Empty if nothing fits."),
    options: z
      .array(
        z.object({
          name: z.string().describe("e.g. 'Guided', 'Collaborative', 'Embedded'"),
          tagline: z.string().describe("Who this option is for, one sentence"),
          term_months: z.number(),
          recommended: z.boolean(),
          line_items: z.array(LineItemRecSchema).describe("What this option adds on top of the core scope"),
        })
      )
      .describe("Empty for focused deals. 2-3 partnership options for larger deals where support level or approach is a real choice."),
    points_plan: z
      .array(z.object({ id: z.enum(POINT_IDS), qty_per_month: z.number(), rationale: z.string() }))
      .describe("Monthly service-points mix (1 point = 1 hour). Empty if the deal doesn't need a points retainer."),
    term_months: z.number().describe("Contract term in months when there are no options"),
    discount_pct: z.number().describe("0 unless the material supports a partner/multi-year discount (e.g. 5 for Preferred Partner)"),
    roadmap: z.array(PhaseSchema).describe("4-6 phases across the term"),
  }),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/* ------------------------------------------------------------------ */
/* Step 2 — what the consultant edits                                  */
/* ------------------------------------------------------------------ */

export interface DealTerms {
  contractStart: string; // yyyy-mm-dd
  hubspotInvestment: string; // HubSpot licensing, paid separately
  exclusions: string; // third-party costs etc.
}

export interface ScopingSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  snapshot: HubSpotSnapshot;
  sources: { name: string; kind: string; chars: number }[];
  analysis: Analysis;
  scope: ScopeDraft;
  suggestions?: import("./pricing").LineItem[]; // optional add-ons the agent suggested, not in scope
  terms: DealTerms;
  answers: Record<string, string>; // open question index -> answer
  consultantNotes: string;
  status: "review" | "proposal";
  proposalId?: string;
}

/* ------------------------------------------------------------------ */
/* Step 3 — executive summary + deck copy                              */
/* ------------------------------------------------------------------ */

export const ProposalContentSchema = z.object({
  engagement_type: z.string().describe("Deck cover title, 2-5 words, e.g. 'HubSpot Growth Partnership' or 'HubSpot Implementation Roadmap'"),
  tagline: z.string().describe("One-line promise of the engagement, under 110 characters"),
  prepared_for: z.string().describe("Primary stakeholder name and title, or the team name"),
  executive_overview: z.string().describe("2-3 sentences summarizing the situation and the plan"),
  stats: z
    .array(z.object({ value: z.string(), label: z.string().describe("Under 60 characters") }))
    .describe("Exactly 3 stat callouts grounded in the source material or stated targets"),
  what_we_learned: z
    .array(z.object({ title: z.string().describe("3-6 word headline, e.g. 'Forecasts built by hand'"), detail: z.string().describe("One sentence, under 120 characters") }))
    .describe("4-6 findings, specific to this client"),
  desired_business_results: z
    .array(z.object({ title: z.string().describe("3-6 word outcome"), detail: z.string().describe("One sentence on what success looks like") }))
    .describe("3-5 outcomes"),
  challenges: z.array(z.object({ title: z.string(), description: z.string().describe("Under 160 characters") })).describe("Exactly 4"),
  before_after: z.object({
    before: z.array(z.string()).describe("Exactly 4 short statements of today's state"),
    after: z.array(z.string()).describe("Exactly 4 matching future-state statements, same order"),
  }),
  scope_phases: z
    .array(z.object({ title: z.string().describe("2-4 words"), summary: z.string().describe("One sentence"), bullets: z.array(z.string()).describe("3-5 concrete deliverables") }))
    .describe("3 stages that explain the scope in plain language, e.g. Discovery → Business decisions → HubSpot build, or Foundation → Content engine → Sales enablement"),
  item_notes: z
    .array(z.object({ name: z.string().describe("Exact line item name from the final scope"), why_for_you: z.string().describe("1-2 sentences on why it fits this client") }))
    .describe("One entry per line item in the final scope (core and options)"),
  consulting_summary: z.string().describe("If the scope includes consulting: 1-2 sentences on what the bi-weekly consulting will focus on for this client. Otherwise empty string."),
  points_focus: z.string().describe("2-3 sentences on how the monthly service points will be spent. Empty string if there are no service points."),
  options_intro: z.string().describe("If there are partnership options: one sentence on what changes between them. Otherwise empty string."),
  roadmap: z.array(PhaseSchema).describe("4-6 phases"),
  open_questions: z
    .array(z.object({ question: z.string().describe("Short question"), detail: z.string().describe("Why it matters, one sentence") }))
    .describe("Unanswered questions that would tighten scope or price — client-facing wording. Empty if none."),
  next_steps: z.array(z.object({ title: z.string(), description: z.string() })).describe("3-4 steps"),
});
export type ProposalContent = z.infer<typeof ProposalContentSchema>;

export interface LeadG2Contact {
  name: string;
  title: string;
  email: string;
  phone: string;
  website: string;
}

export interface Proposal {
  id: string;
  createdAt: string;
  sessionId: string;
  clientName: string;
  hubspotCompanyId?: string;
  content: ProposalContent;
  scope: ScopeDraft;
  terms: DealTerms;
  contact: LeadG2Contact;
}

export interface ProposalListItem {
  id: string;
  createdAt: string;
  clientName: string;
  engagementType: string;
  totalLabel: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function contractEnd(start: string, months: number): string {
  const d = new Date(`${start}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function formatUSD(n: number, cents = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  }).format(n);
}

/** $176K style, for option ranges. */
export function formatK(n: number): string {
  return n >= 10000 ? `$${Math.round(n / 1000)}K` : formatUSD(n);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

export function fmtPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
