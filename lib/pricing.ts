/**
 * Pricing model — shared by server and client.
 *
 * - Products come from LeadG2's HubSpot product library (lib/products.ts).
 * - Service points and custom work are billed at the hourly rate ($125 by default).
 * - Two sides of the house:
 *     HubSpot implementation (onboarding, migration, integration) = a fixed-price scope of work, one-time.
 *     Growth retainer = consulting ($2,000/month — marketing, HubSpot, or both) + service points + other monthly add-ons.
 * - Larger deals add 2-3 partnership options with their own line items and term (e.g. Guided / Collaborative / Embedded).
 */
import { pointItem } from "./offerings";

export const HOURLY_RATE = Number(process.env.NEXT_PUBLIC_LEADG2_HOURLY_RATE) || 125;
/** One service point = one hour of work. */
export const POINT_PRICE = HOURLY_RATE;

/** Consulting retainer: one $2,000/month fee whether the focus is marketing, HubSpot, or both. */
export const CONSULTING_MONTHLY = Number(process.env.NEXT_PUBLIC_LEADG2_CONSULTING_MONTHLY) || 2000;

export type Billing = "one_time" | "monthly";

export interface Consulting {
  marketing: boolean;
  hubspot: boolean;
  rationale: string;
}

export const MARKETING_CONSULTING_INCLUDES = [
  "Meetings every other week with agendas and recaps",
  "Business & revenue goal alignment",
  "Monthly KPI update with interpretation and recommended next steps",
  "Competitor analysis & market positioning",
  "Content strategy & planning",
  "Campaign performance review and routine campaign maintenance",
  "Sales & marketing alignment",
  "Email guidance between meetings",
];
export const HUBSPOT_CONSULTING_INCLUDES = [
  "CRM management & optimization",
  "Building reports and dashboards",
  "Ongoing training for your team",
  "Workflow, pipeline and property recommendations",
  "Feature adoption & best-practice guidance",
  "Landing page & conversion rate optimization",
];

export function consultingName(c?: Consulting): string {
  if (!c || (!c.marketing && !c.hubspot)) return "";
  return c.marketing && c.hubspot ? "Marketing & HubSpot Consulting" : c.marketing ? "Marketing Consulting" : "HubSpot Consulting";
}
export function consultingMonthly(c?: Consulting): number {
  return c && (c.marketing || c.hubspot) ? CONSULTING_MONTHLY : 0;
}

export interface CatalogProduct {
  id: string;
  name: string;
  price: number; // 0 = priced by estimated hours
  billing: Billing;
  description: string;
  includes: string[];
  category: "onboarding" | "base" | "add-on" | "retainer" | "project";
  hourly: boolean;
}

export interface LineItem {
  key: string;
  productId: string | null; // null = custom work priced by hours
  name: string;
  description: string;
  billing: Billing;
  qty: number;
  unitPrice: number; // per unit (per month for monthly items)
  hours: number | null; // custom work only: internal estimate used to set its fixed price (hours × rate). Never shown to clients.
  rationale: string;
  /** Outsourced work (integration builds, migrations): price is a starting estimate until the vendor quotes. */
  vendor?: boolean;
}

export const hasVendorItems = (scope: ScopeDraft) =>
  [...scope.lineItems, ...scope.options.flatMap((o) => o.lineItems)].some((li) => li.vendor);
export const VENDOR_NOTE = "Integration and migration work is delivered with a specialist partner; these prices are estimates until the vendor quote is final.";

export interface PartnershipOption {
  key: string;
  name: string; // e.g. "Collaborative"
  tagline: string;
  termMonths: number;
  recommended: boolean;
  lineItems: LineItem[];
}

export interface ScopeDraft {
  consulting?: Consulting; // $2,000/month retainer
  termMonths: number; // term when there are no options
  lineItems: LineItem[]; // included in every option
  points: Record<string, number>; // service point item id -> qty per month
  options: PartnershipOption[];
  discountPct: number; // applies to LeadG2 services
  discountLabel: string;
}

export const lineTotal = (li: LineItem) => Math.round(li.qty * (li.hours != null ? li.hours * HOURLY_RATE : li.unitPrice));


/** Split a scope's items into the two sides of the house. */
export const implementationItems = (items: LineItem[]) => items.filter((i) => i.billing === "one_time");
export const retainerItems = (items: LineItem[]) => items.filter((i) => i.billing === "monthly");

export function monthlyPoints(points: Record<string, number>): number {
  return Math.round(Object.entries(points).reduce((sum, [id, qty]) => sum + (pointItem(id)?.points ?? 0) * qty, 0) * 100) / 100;
}

export interface Totals {
  label: string;
  termMonths: number;
  monthly: number; // recurring per month (incl. service points)
  oneTime: number;
  pointsMonthly: number;
  standard: number; // before discount
  discount: number;
  total: number;
}

function sum(items: LineItem[], billing: Billing) {
  return items.filter((i) => i.billing === billing).reduce((a, i) => a + lineTotal(i), 0);
}

export function totalsFor(scope: ScopeDraft, option?: PartnershipOption): Totals {
  const items = [...scope.lineItems, ...(option?.lineItems ?? [])];
  const term = option?.termMonths ?? scope.termMonths;
  const pointsMonthly = Math.round(monthlyPoints(scope.points) * POINT_PRICE);
  const monthly = sum(items, "monthly") + pointsMonthly + consultingMonthly(scope.consulting);
  const oneTime = sum(items, "one_time");
  const standard = monthly * term + oneTime;
  const discount = Math.round((standard * (scope.discountPct || 0)) / 100);
  return { label: option?.name ?? "Total", termMonths: term, monthly, oneTime, pointsMonthly, standard, discount, total: standard - discount };
}

export function allTotals(scope: ScopeDraft): Totals[] {
  return scope.options.length ? scope.options.map((o) => totalsFor(scope, o)) : [totalsFor(scope)];
}

export function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

/** Bullet list from a HubSpot product description. */
export function includesOf(description: string): string[] {
  return description
    .split("\n")
    .filter((l) => !l.trim().startsWith("*")) // internal footnotes ("*Required for…", "**Data files must…")
    .map((l) => l.replace(/^[\s\-•·]+/, "").trim())
    .filter((l) => l && !/^includes:?$/i.test(l));
}
