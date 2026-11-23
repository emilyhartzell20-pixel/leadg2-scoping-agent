import "server-only";
import { Client } from "@hubspot/api-client";
import snapshot from "@/data/products.json";
import { includesOf, type Billing, type CatalogProduct } from "./pricing";

/**
 * LeadG2's product library, read live from HubSpot (Products object) so prices stay current.
 * Falls back to data/products.json (a snapshot of the same library) when HubSpot isn't reachable.
 */

type RawProduct = { id: string; name: string; price: number; description: string; recurring?: string | null };

// Products that bill monthly even though HubSpot has no billing frequency set on them.
const MONTHLY_NAME = /\(monthly|monthly service|subscription|maintenance package|^marketing consulting$/i;
// Handled elsewhere (service points editor, the consulting retainer), or placeholders.
const EXCLUDE = /^service point$|^\[add-on\] service points$|^\[add-on\] \[template\]$|^marketing consulting$/i;

function normalize(raw: RawProduct[]): CatalogProduct[] {
  return raw
    .filter((p) => p.name && !EXCLUDE.test(p.name.trim()))
    .map((p) => {
      const name = p.name.trim();
      const billing: Billing = p.recurring || MONTHLY_NAME.test(name) ? "monthly" : "one_time";
      const lower = name.toLowerCase();
      const category: CatalogProduct["category"] = lower.startsWith("[onboarding]")
        ? "onboarding"
        : lower.startsWith("[base]")
          ? "base"
          : lower.startsWith("[add")
            ? "add-on"
            : billing === "monthly"
              ? "retainer"
              : "project";
      const includes = includesOf(p.description);
      return { id: String(p.id), name, price: Number(p.price) || 0, billing, description: p.description, includes, category, hourly: !Number(p.price) };
    });
}

let cache: { at: number; products: CatalogProduct[]; source: "hubspot" | "snapshot" } | null = null;
const TTL = 10 * 60 * 1000;

export async function getCatalog(): Promise<{ products: CatalogProduct[]; source: "hubspot" | "snapshot" }> {
  if (cache && Date.now() - cache.at < TTL) return cache;
  let products: CatalogProduct[] | null = null;
  let source: "hubspot" | "snapshot" = "snapshot";
  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      const hs = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN, numberOfApiCallRetries: 2 });
      const all = await hs.crm.products.getAll(undefined, undefined, ["name", "price", "description", "recurringbillingfrequency"]);
      products = normalize(
        all.map((p) => ({
          id: p.id,
          name: p.properties.name ?? "",
          price: Number(p.properties.price) || 0,
          description: p.properties.description ?? "",
          recurring: p.properties.recurringbillingfrequency,
        }))
      );
      if (products.length) source = "hubspot";
      else products = null;
    } catch (e) {
      console.warn("HubSpot products unavailable, using snapshot:", e instanceof Error ? e.message : e);
    }
  }
  if (!products) products = normalize(snapshot.products as RawProduct[]);
  cache = { at: Date.now(), products, source };
  return cache;
}

export function catalogForPrompt(products: CatalogProduct[], hourly: number): string {
  return products
    .map((p) => {
      const price = p.hourly ? `priced by estimated hours at $${hourly}/hr` : `$${p.price.toLocaleString()}${p.billing === "monthly" ? "/month" : " one-time"}`;
      const desc = p.description.replace(/\s+/g, " ").slice(0, 450);
      return `- id ${p.id}: ${p.name} — ${price}${desc ? `. ${desc}` : ""}`;
    })
    .join("\n");
}
