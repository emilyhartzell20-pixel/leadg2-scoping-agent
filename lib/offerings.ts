/**
 * Service points menu (Service Point Tracker), team roles and boilerplate (Executive Summary template).
 * Priced products live in HubSpot — see lib/products.ts. Point values are the base value of each range.
 */

/* ------------------------------------------------------------------ */
/* Service points catalog (Service Point Tracker)                      */
/* ------------------------------------------------------------------ */

export interface PointItem {
  id: string;
  name: string;
  desc: string;
  points: number; // base value used for totals
  pointsLabel: string;
  category: "consulting" | "content" | "sales" | "creation";
  addOnOf?: string;
}

export const POINT_CATEGORIES = [
  { key: "consulting", eyebrow: "Consulting & Support", title: "Strategy that keeps your engine tuned." },
  { key: "content", eyebrow: "Content & Promotion", title: "The assets that keep your pipeline full." },
  { key: "sales", eyebrow: "Sales", title: "Enablement that helps reps close." },
  { key: "creation", eyebrow: "Content Creation", title: "Premium assets for bigger moments." },
] as const;

export const POINT_ITEMS: PointItem[] = [
  { id: "audit", category: "consulting", name: "Marketing & sales audit", desc: "SEO, AEO, keyword, and social diagnostics that show exactly where you stand.", points: 3, pointsLabel: "3 pts" },
  { id: "call", category: "consulting", name: "Additional strategy call", desc: "Extra time with your consultant, beyond your standard cadence.", points: 2, pointsLabel: "2 pts" },
  { id: "hs-hour", category: "consulting", name: "HubSpot support hour", desc: "Hands-on help inside your portal — workflows, reports, troubleshooting.", points: 1, pointsLabel: "1 pt" },
  { id: "custom-report", category: "consulting", name: "Custom HubSpot report", desc: "A dashboard built around the metrics that matter most to your team.", points: 2, pointsLabel: "2 pts" },

  { id: "blog", category: "content", name: "Blog post + HubSpot publishing", desc: "An SEO-ready post, written, edited, and published to your blog.", points: 4, pointsLabel: "4–5 pts" },
  { id: "social-post", category: "content", name: "Social media post", desc: "One on-brand post, scheduled, with the graphic it needs.", points: 0.5, pointsLabel: "0.5 pts" },
  { id: "email", category: "content", name: "Marketing email", desc: "A single send, written and styled for your list.", points: 4, pointsLabel: "4 pts" },
  { id: "popup", category: "content", name: "Pop-up form", desc: "A conversion form designed and installed on your site.", points: 1, pointsLabel: "1 pt" },
  { id: "landing", category: "content", name: "Landing page", desc: "A page built to convert a single offer or campaign.", points: 3, pointsLabel: "3 pts" },
  { id: "landing-thanks", category: "content", name: "+ Thank-you page & confirmation email", desc: "Add-on to a landing page.", points: 5, pointsLabel: "+5 pts", addOnOf: "landing" },
  { id: "faq", category: "content", name: "FAQ website page", desc: "A dedicated page built to capture long-tail search intent.", points: 10, pointsLabel: "10 pts" },
  { id: "page-copy", category: "content", name: "Website page copy", desc: "New copy for a page on your existing site.", points: 6, pointsLabel: "6 pts" },
  { id: "module", category: "content", name: "New website module", desc: "A new module designed and built, scoped to complexity.", points: 3, pointsLabel: "3–10 pts" },
  { id: "battlecard", category: "content", name: "Competitor battle-card", desc: "A quick-reference card that arms sales against a specific competitor.", points: 4, pointsLabel: "4–6 pts" },
  { id: "li-newsletter", category: "content", name: "LinkedIn newsletter", desc: "A recurring newsletter published to your LinkedIn audience.", points: 3, pointsLabel: "3 pts" },
  { id: "graphic", category: "content", name: "Custom graphic", desc: "A one-off graphic sized for social, email, or web.", points: 1, pointsLabel: "1 pt" },

  { id: "seq-email", category: "sales", name: "Sales email in sequence", desc: "One email in an automated outbound or nurture sequence.", points: 1, pointsLabel: "1 pt" },
  { id: "proposal", category: "sales", name: "Sales proposal template", desc: "A reusable, on-brand template that helps reps close faster.", points: 8, pointsLabel: "8 pts" },
  { id: "saleshub-training", category: "sales", name: "Sales Hub tools training", desc: "Hands-on training to get reps fluent in HubSpot Sales Hub.", points: 2, pointsLabel: "2 pts" },
  { id: "seller-page", category: "sales", name: "Personalized seller landing page", desc: "A 1:1 landing page built for an individual rep's outreach.", points: 4, pointsLabel: "4 pts" },
  { id: "li-thought", category: "sales", name: "LinkedIn thought-leadership training", desc: "Coaching that helps sellers post with authority.", points: 3, pointsLabel: "3 pts" },
  { id: "ambassador", category: "sales", name: "Brand ambassador social post", desc: "One post written for a team member to share as themselves.", points: 0.5, pointsLabel: "0.5 pts" },
  { id: "sales-report", category: "sales", name: "HubSpot sales report", desc: "A custom report tracking pipeline and rep performance.", points: 2, pointsLabel: "2 pts" },

  { id: "survey", category: "creation", name: "Survey", desc: "A structured survey built to capture first-party data.", points: 4, pointsLabel: "4 pts" },
  { id: "persona", category: "creation", name: "Target persona profile", desc: "A documented profile of who you're really selling to.", points: 4, pointsLabel: "4 pts" },
  { id: "styleguide", category: "creation", name: "Style guide", desc: "Brand and voice guidelines that keep every asset consistent.", points: 6, pointsLabel: "6 pts" },
  { id: "onesheet", category: "creation", name: "One-sheet", desc: "A single-page asset that sells one idea, clearly.", points: 6, pointsLabel: "6–10 pts" },
  { id: "video", category: "creation", name: "Video", desc: "A produced video — 7 points for :30, 9 for :60, 11 for :90.", points: 7, pointsLabel: "7–11 pts" },
  { id: "case-study", category: "creation", name: "Case study", desc: "A customer's win, told in proof and numbers.", points: 6, pointsLabel: "6–9 pts" },
  { id: "ebook", category: "creation", name: "eBook", desc: "A long-form asset built to earn a lead's contact information.", points: 8, pointsLabel: "8–13 pts" },
  { id: "interactive", category: "creation", name: "Interactive premium content", desc: "A calculator, quiz, or assessment built to convert.", points: 5, pointsLabel: "5–10 pts" },
  { id: "pillar", category: "creation", name: "Pillar page", desc: "A comprehensive, SEO-anchoring page for a core topic.", points: 10, pointsLabel: "10 pts" },
  { id: "ppt", category: "creation", name: "PowerPoint presentation", desc: "A designed deck, ready to present.", points: 8, pointsLabel: "8–10 pts" },
  { id: "ppt-script", category: "creation", name: "+ Speaker script", desc: "Add-on to a PowerPoint presentation.", points: 10, pointsLabel: "+10–12 pts", addOnOf: "ppt" },
  { id: "press-release", category: "creation", name: "Press release", desc: "A written release announcing your news.", points: 4, pointsLabel: "4 pts" },
  { id: "press-promo", category: "creation", name: "+ Email & social promotion", desc: "Add-on to a press release.", points: 5, pointsLabel: "+5 pts", addOnOf: "press-release" },
  { id: "aeo-profiles", category: "creation", name: "3rd-party profiles for AEO", desc: "Profiles on G2, Glassdoor, Wikipedia — sites AI engines cite.", points: 3, pointsLabel: "3 pts" },
];

export const POINT_IDS = POINT_ITEMS.map((i) => i.id) as [string, ...string[]];
export const pointItem = (id: string) => POINT_ITEMS.find((i) => i.id === id);

/* ------------------------------------------------------------------ */
/* Team roles (Executive Summary → Your partners)                      */
/* ------------------------------------------------------------------ */

export const TEAM_ROLES: Record<string, { title: string; desc: string }> = {
  lead: { title: "Lead Consultant", desc: "Your primary point of contact — project management, strategic guidance, analysis and consulting." },
  content: { title: "Content Strategist", desc: "Leads content creation and SEO, managing writers and all content production." },
  web: { title: "Website Designer", desc: "Creates and maintains a user-friendly, visually appealing, functional website." },
  podcast: { title: "Podcast Producer", desc: "Oversees podcast production to support your media and engagement strategy." },
  hubspot: { title: "HubSpot Experts", desc: "Certified specialists who configure, migrate and optimize your portal." },
  crew: { title: "Writers, Designers & HubSpot Experts", desc: "A team immersed in your brand's style, tone and voice for consistent, high-quality work." },
};

export const WHO_WE_ARE =
  "LeadG2 is a HubSpot Diamond Solution Partner, and a dedicated, driven, results-oriented partner to help your sales and marketing teams leverage technology to maximize your investment and create solutions that drive results.";

/* ------------------------------------------------------------------ */
/* Prompt text                                                         */
/* ------------------------------------------------------------------ */

export function pointsForPrompt(): string {
  return POINT_ITEMS.map((i) => `- ${i.id}: ${i.name} — ${i.pointsLabel}${i.addOnOf ? ` (add-on to ${i.addOnOf})` : ""}. ${i.desc}`).join("\n");
}
