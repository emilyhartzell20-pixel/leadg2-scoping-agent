import "server-only";
import { readFileSync } from "fs";
import path from "path";
import PptxGenJS from "pptxgenjs";
import { pointItem } from "./offerings";
import { CONSULTING_MONTHLY, POINT_PRICE, allTotals, consultingName, hasVendorItems, implementationItems, lineTotal, VENDOR_NOTE, monthlyPoints, retainerItems, type LineItem } from "./pricing";
import { teamFor } from "./teamFor";
import { contractEnd, fmtPoints, formatDate, formatK, formatUSD, type Proposal } from "./types";

/**
 * Server-side LeadG2 proposal deck, styled after the BridgeTower / Hubbard decks:
 * navy glow backgrounds, the official LeadG2 logo files, Mulish titles/labels and Lora body (brand guide v1.1).
 * LAYOUT_WIDE = 13.33 x 7.5 in. Slides for options / service points / open questions appear only when relevant.
 */

const C = {
  midnight: "0D1B2A",
  navy: "16243A",
  navyLine: "2E4467",
  slate: "4A5A72",
  orange: "E17226",
  orangeSoft: "F2913F",
  peach: "FBEEE3",
  white: "FFFFFF",
  offWhite: "F5F6F8",
  body: "4A5568",
  muted: "6B7684",
  mist: "C3CAD4",
  steel: "9DA6B5",
  rule: "E3E6EA",
  border: "D9DDE3",
};
// LeadG2 brand guide v1.1: Mulish for headlines/UI/labels, Lora for body copy and accents.
const HEAD = "Mulish";
const BODY = "Lora";
const UI = "Mulish";
const SERIF = "Lora";
const W = 13.333;
const H = 7.5;
const MX = 0.89;
const CW = W - MX * 2;

/* ---------- brand assets: official LeadG2 logo files + deck backgrounds ---------- */
const ASSET_DIR = path.join(process.cwd(), "assets", "deck");
const asset = (file: string, mime: string) => `${mime};base64,${readFileSync(path.join(ASSET_DIR, file)).toString("base64")}`;
let cache: { bg: string[]; logoColor: string; logoTagline: string } | null = null;
function assets() {
  if (!cache) {
    cache = {
      bg: [1, 2, 3, 4, 5, 6].map((i) => asset(`bg${i}.jpg`, "image/jpeg")),
      logoColor: asset("logo-on-dark.png", "image/png"), // 1200 x 234 — LEAD Orange, G2 Steel (primary lockup on dark)
      logoTagline: asset("logo-color-tagline.png", "image/png"), // 1200 x 348
    };
  }
  return cache;
}

type Slide = PptxGenJS.Slide;
type TextOpts = PptxGenJS.TextPropsOptions;
const short = (name: string) => name.replace(/^\[[^\]]+\]\s*/, "");

export async function buildDeck(p: Proposal): Promise<Buffer> {
  const A = assets();
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "LeadG2";
  pptx.company = "LeadG2";
  pptx.title = `${p.clientName} x LeadG2 — ${p.content.engagement_type}`;
  pptx.theme = { headFontFace: HEAD, bodyFontFace: BODY };
  const R = pptx.ShapeType;

  const c = p.content;
  const scope = p.scope;
  const terms = p.terms;
  const pts = monthlyPoints(scope.points);
  const totals = allTotals(scope);
  const hasOptions = scope.options.length > 0;
  const lo = Math.min(...totals.map((t) => t.total));
  const hi = Math.max(...totals.map((t) => t.total));
  const dateLong = new Date(p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  /* ---------------- primitives ---------------- */
  const text = (s: Slide, t: string | PptxGenJS.TextProps[], o: TextOpts) => s.addText(t, { fontFace: BODY, margin: 0, valign: "top", ...o });
  const dark = (bg: number) => {
    const s = pptx.addSlide();
    s.background = { data: A.bg[(bg - 1) % 6] };
    return s;
  };
  const light = (fill = C.white) => {
    const s = pptx.addSlide();
    s.background = { color: fill };
    return s;
  };
  /** Dark slides: primary lockup (G2 Steel). Light slides: color logo with tagline. */
  const logo = (s: Slide, isDark: boolean, x?: number, y = 0.5) => {
    if (isDark) {
      const w = 1.67;
      s.addImage({ data: A.logoColor, x: x ?? W - MX - w, y: y + 0.04, w, h: w * (234 / 1200) });
    } else {
      const w = 1.67;
      s.addImage({ data: A.logoTagline, x: x ?? W - MX - w, y, w, h: w * (348 / 1200) });
    }
  };

  function head(s: Slide, eyebrow: string, title: string | PptxGenJS.TextProps[], isDark: boolean, sub?: string) {
    text(s, eyebrow.toUpperCase(), { x: MX, y: 0.78, w: CW - 2, h: 0.26, fontFace: HEAD, fontSize: 12, bold: true, color: isDark ? C.orangeSoft : C.orange, charSpacing: 2 });
    text(s, title, { x: MX, y: 1.12, w: CW - 1.9, h: 0.55, fontFace: HEAD, fontSize: 30, bold: true, color: isDark ? C.white : C.midnight, charSpacing: -0.5, valign: "middle" });
    if (sub) text(s, sub, { x: MX, y: 1.72, w: CW - 1, h: 0.32, fontFace: SERIF, fontSize: 13, italic: true, color: isDark ? C.mist : C.muted });
    logo(s, isDark);
  }

  function badge(s: Slide, x: number, y: number, label: string, fill = C.orange, color = C.white, size = 0.39) {
    s.addShape(R.roundRect, { x, y, w: size, h: size, fill: { color: fill }, line: { color: fill }, rectRadius: 0.06 });
    text(s, label, { x, y, w: size, h: size, fontFace: UI, fontSize: 14, bold: true, color, align: "center", valign: "middle" });
  }

  function card(s: Slide, x: number, y: number, w: number, h: number, isDark: boolean, highlight = false) {
    s.addShape(R.roundRect, {
      x, y, w, h, rectRadius: 0.08,
      fill: { color: isDark ? C.navy : C.white, transparency: isDark ? 15 : 0 },
      line: { color: highlight ? C.orange : isDark ? C.navyLine : C.border, width: highlight ? 1.5 : 0.75 },
    });
  }

  function presenter(s: Slide) {
    const lines: PptxGenJS.TextProps[] = [
      { text: dateLong, options: { italic: true, color: C.mist, breakLine: true } },
      { text: `${p.contact.name}, ${p.contact.title}`, options: { bold: true, color: C.white } },
      ...(p.contact.email ? [{ text: `  |  ${p.contact.email}`, options: { color: C.mist } }] : []),
    ];
    text(s, lines, { x: 7.65, y: 5.7, w: W - 7.65 - 0.4, h: 0.8, fontFace: SERIF, fontSize: 13, paraSpaceAfter: 8 });
  }

  function grid<T>(s: Slide, items: T[], y0: number, availH: number, perRowFor: (n: number) => number, draw: (it: T, i: number, x: number, y: number, w: number, h: number) => void) {
    const perRow = perRowFor(items.length);
    const gap = 0.3;
    const w = (CW - gap * (perRow - 1)) / perRow;
    const rows = Math.ceil(items.length / perRow);
    const h = (availH - (rows - 1) * 0.25) / rows;
    items.forEach((it, i) => draw(it, i, MX + (i % perRow) * (w + gap), y0 + Math.floor(i / perRow) * (h + 0.25), w, h));
  }

  /* ================= Cover ================= */
  {
    const s = dark(1);
    logo(s, true, 10.36, 0.47);
    text(s, p.clientName, { x: MX, y: 1.45, w: 11, h: 1.0, fontFace: HEAD, fontSize: 40, bold: true, color: C.white, charSpacing: -1, valign: "bottom", fit: "shrink" });
    text(s, c.engagement_type, { x: MX, y: 2.6, w: 11.4, h: 1.6, fontFace: HEAD, fontSize: 44, bold: true, color: C.orange, charSpacing: -1, fit: "shrink" });
    text(s, c.tagline, { x: MX - 0.06, y: 4.45, w: 7.4, h: 1.0, fontFace: SERIF, fontSize: 22, italic: true, color: C.mist });
    presenter(s);
  }

  /* ================= Agenda ================= */
  {
    const agenda = [
      ["What we heard", "Your challenges and where things stand today"],
      ["Where we're going", "The business results this partnership is built around"],
      ["How we get there", hasOptions ? "Scope, partnership options and roadmap" : "Scope, services and roadmap"],
      ["Your LeadG2 team", "Who you'll work with every week"],
      ["Investment & next steps", "Pricing, decisions and moving forward"],
    ];
    const s = dark(4);
    head(s, "Agenda", "Today's conversation.", true);
    s.addShape(R.rect, { x: MX + 0.12, y: 2.67, w: 0.02, h: 0.88 * (agenda.length - 1), fill: { color: C.slate }, line: { color: C.slate } });
    agenda.forEach(([t, d], i) => {
      const y = 2.54 + i * 0.88;
      s.addShape(R.rect, { x: MX, y, w: 0.26, h: 0.26, fill: { color: C.midnight }, line: { color: C.orange, width: 2.25 } });
      s.addShape(R.rect, { x: MX + 0.08, y: y + 0.08, w: 0.1, h: 0.1, fill: { color: C.orange }, line: { color: C.orange } });
      text(s, t, { x: MX + 0.55, y: y - 0.06, w: 8, h: 0.32, fontFace: HEAD, fontSize: 16, bold: true, color: C.white });
      text(s, d, { x: MX + 0.55, y: y + 0.27, w: 8, h: 0.26, fontSize: 11.5, color: C.steel });
    });
  }

  /* ================= What we heard ================= */
  {
    const s = light();
    head(s, "Where you are today", "What we heard from your team.", false);
    const items = c.what_we_learned.slice(0, 6);
    const step = Math.min(0.83, 4.6 / items.length);
    items.forEach((it, i) => {
      const y = 2.13 + i * step;
      badge(s, MX, y, String(i + 1));
      text(s, it.title, { x: MX + 0.67, y: y - 0.02, w: CW - 0.7, h: 0.31, fontFace: HEAD, fontSize: 16, bold: true, color: C.midnight });
      text(s, it.detail, { x: MX + 0.67, y: y + 0.31, w: CW - 0.7, h: 0.28, fontSize: 12.5, color: C.body });
      if (i < items.length - 1) s.addShape(R.line, { x: MX, y: y + step - 0.15, w: CW - 0.3, h: 0, line: { color: C.rule, width: 0.75 } });
    });
  }

  /* ================= Current state ================= */
  {
    const s = dark(3);
    head(s, "Current state", "What's holding growth back.", true, "Every gap below is costing time or pipeline today.");
    grid(s, c.challenges.slice(0, 4), 2.35, 4.35, () => 2, (ch, i, x, y, w, h) => {
      card(s, x, y, w, h, true);
      text(s, String(i + 1).padStart(2, "0"), { x: x + 0.35, y: y + 0.32, w: 0.8, h: 0.4, fontFace: HEAD, fontSize: 20, bold: true, color: C.orange });
      text(s, ch.title, { x: x + 1.1, y: y + 0.32, w: w - 1.4, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: C.white });
      text(s, ch.description, { x: x + 1.1, y: y + 0.85, w: w - 1.4, h: h - 1.05, fontSize: 12.5, color: C.mist });
    });
  }

  /* ================= Before & after ================= */
  {
    const s = light(C.offWhite);
    head(s, "What changes", "From where you are to where you're going.", false);
    const w = (CW - 0.35) / 2;
    const y0 = 2.15;
    const h = 4.6;
    const cols = [
      { label: "BEFORE", items: c.before_after.before, fill: C.white, line: C.border, mark: "✕", markFill: "C9CED6", txt: C.body, bold: false },
      { label: "AFTER", items: c.before_after.after, fill: C.peach, line: C.orange, mark: "✓", markFill: C.orange, txt: C.midnight, bold: true },
    ];
    cols.forEach((col, ci) => {
      const x = MX + ci * (w + 0.35);
      s.addShape(R.roundRect, { x, y: y0, w, h, rectRadius: 0.08, fill: { color: col.fill }, line: { color: col.line, width: ci ? 1.5 : 0.75 } });
      s.addShape(R.rect, { x, y: y0 + 0.12, w: 0.06, h: h - 0.24, fill: { color: ci ? C.orange : "C9CED6" }, line: { color: ci ? C.orange : "C9CED6" } });
      text(s, col.label, { x: x + 0.4, y: y0 + 0.3, w: 3, h: 0.3, fontFace: HEAD, fontSize: 12, bold: true, color: ci ? C.orange : C.muted, charSpacing: 2 });
      col.items.slice(0, 4).forEach((t, i) => {
        const y = y0 + 0.85 + i * 0.92;
        badge(s, x + 0.4, y, col.mark, col.markFill, C.white, 0.3);
        text(s, t, { x: x + 0.9, y: y - 0.04, w: w - 1.2, h: 0.8, fontSize: 13, bold: col.bold, color: col.txt });
      });
    });
  }

  /* ================= Where we're going ================= */
  {
    const s = dark(2);
    head(s, "Where we're going", "The results this partnership is built around.", true);
    grid(s, c.desired_business_results.slice(0, 6), 2.35, 4.35, (n) => (n === 4 ? 2 : Math.min(3, n)), (r, i, x, y, w, h) => {
      card(s, x, y, w, h, true, i === 0);
      badge(s, x + 0.3, y + 0.3, String(i + 1));
      text(s, r.title, { x: x + 0.3, y: y + 0.85, w: w - 0.6, h: 0.6, fontFace: HEAD, fontSize: 16, bold: true, color: C.white });
      text(s, r.detail, { x: x + 0.3, y: y + 1.45, w: w - 0.6, h: Math.max(0.4, h - 1.6), fontSize: 12, color: C.mist });
    });
  }

  /* ================= How we get there (3 stages) ================= */
  {
    const s = light();
    head(s, "Scope of work", "How we'll get you there.", false);
    const stages = c.scope_phases.slice(0, 3);
    const gap = 0.55;
    const w = (CW - gap * (stages.length - 1)) / Math.max(1, stages.length);
    stages.forEach((st, i) => {
      const x = MX + i * (w + gap);
      const y = 2.15;
      const h = 4.6;
      const last = i === stages.length - 1;
      s.addShape(R.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: last ? C.white : C.offWhite }, line: { color: last ? C.orange : C.border, width: last ? 1.5 : 0.75 } });
      text(s, String(i + 1).padStart(2, "0"), { x: x + 0.3, y: y + 0.3, w: 1, h: 0.35, fontFace: HEAD, fontSize: 16, bold: true, color: C.orange });
      text(s, st.title, { x: x + 0.3, y: y + 0.7, w: w - 0.6, h: 0.4, fontFace: HEAD, fontSize: 17, bold: true, color: C.midnight });
      text(s, st.summary, { x: x + 0.3, y: y + 1.15, w: w - 0.6, h: 0.75, fontSize: 11.5, bold: true, color: C.midnight });
      text(s, st.bullets.slice(0, 6).map((b) => ({ text: b, options: { bullet: { code: "25AA" }, breakLine: true } })), {
        x: x + 0.25, y: y + 1.95, w: w - 0.5, h: h - 2.1, fontSize: 11, color: C.body, paraSpaceAfter: 4,
      });
      if (!last) text(s, "→", { x: x + w + 0.05, y: y + h / 2 - 0.25, w: gap - 0.1, h: 0.5, fontSize: 22, bold: true, color: C.orange, align: "center", valign: "middle" });
    });
  }

  /* ================= Here's what we recommend: two sides of the house ================= */
  const consult = consultingName(scope.consulting);
  const impl = implementationItems(scope.lineItems);
  const monthlyAdds = retainerItems(scope.lineItems);
  const implTotal = impl.reduce((a, li) => a + lineTotal(li), 0);
  const retainerMonthly = (consult ? CONSULTING_MONTHLY : 0) + pts * POINT_PRICE + monthlyAdds.reduce((a, li) => a + lineTotal(li), 0);
  {
    const s = light(C.offWhite);
    head(s, hasOptions ? "Included in every option" : "Recommended scope", "Here's what we recommend.", false);
    const panels: { eyebrow: string; title: string; rows: [string, string][]; foot: [string, string] }[] = [];
    if (impl.length)
      panels.push({
        eyebrow: "HubSpot implementation",
        title: "Fixed-price scope of work",
        rows: impl.map((li) => [short(li.name) + (li.qty > 1 ? ` × ${li.qty}` : ""), `${formatUSD(lineTotal(li))}${li.vendor ? " est.*" : ""}`]),
        foot: ["Fixed price, one-time", formatUSD(implTotal)],
      });
    if (consult || pts > 0 || monthlyAdds.length)
      panels.push({
        eyebrow: "Growth retainer",
        title: "Consulting + service points",
        rows: [
          ...(consult ? [[consult, `${formatUSD(CONSULTING_MONTHLY)}/mo`] as [string, string]] : []),
          ...(pts > 0 ? [[`Service points — ${fmtPoints(pts)}/month`, `${formatUSD(pts * POINT_PRICE)}/mo`] as [string, string]] : []),
          ...monthlyAdds.map((li) => [short(li.name), `${formatUSD(lineTotal(li))}/mo`] as [string, string]),
        ],
        foot: ["Monthly", `${formatUSD(retainerMonthly)}/mo`],
      });
    const gap = 0.35;
    const w = (CW - gap * (panels.length - 1)) / Math.max(1, panels.length);
    panels.forEach((pn, i) => {
      const x = MX + i * (w + gap);
      const y = 2.1;
      const h = 4.75;
      s.addShape(R.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.white }, line: { color: i === 1 ? C.orange : C.border, width: i === 1 ? 1.5 : 0.75 } });
      text(s, pn.eyebrow.toUpperCase(), { x: x + 0.35, y: y + 0.3, w: w - 0.7, h: 0.25, fontFace: HEAD, fontSize: 10.5, bold: true, color: C.orange, charSpacing: 1.5 });
      text(s, pn.title, { x: x + 0.35, y: y + 0.58, w: w - 0.7, h: 0.4, fontFace: HEAD, fontSize: 18, bold: true, color: C.midnight });
      const rows = pn.rows.slice(0, 9);
      const step = Math.min(0.36, 2.9 / Math.max(1, rows.length));
      rows.forEach(([name, val], j) => {
        const ry = y + 1.15 + j * step;
        text(s, name, { x: x + 0.35, y: ry, w: w - 2.0, h: step - 0.04, fontSize: 11, color: C.midnight, valign: "middle", fit: "shrink" });
        text(s, val, { x: x + w - 1.65, y: ry, w: 1.3, h: step - 0.04, fontSize: 11, bold: true, color: C.body, align: "right", valign: "middle" });
        s.addShape(R.line, { x: x + 0.35, y: ry + step - 0.02, w: w - 0.7, h: 0, line: { color: C.rule, width: 0.5 } });
      });
      if (i === 0 && impl.some((li) => li.vendor))
        text(s, `*${VENDOR_NOTE}`, { x: x + 0.35, y: y + h - 1.25, w: w - 0.7, h: 0.45, fontSize: 8.5, italic: true, color: C.muted, valign: "bottom" });
      if (pn.rows.length > rows.length) text(s, `+ ${pn.rows.length - rows.length} more`, { x: x + 0.35, y: y + 1.15 + rows.length * step, w: 2, h: 0.25, fontSize: 9.5, color: C.muted });
      s.addShape(R.roundRect, { x: x + 0.2, y: y + h - 0.75, w: w - 0.4, h: 0.55, rectRadius: 0.05, fill: { color: i === 1 ? C.peach : C.offWhite }, line: { color: i === 1 ? C.peach : C.offWhite } });
      text(s, pn.foot[0], { x: x + 0.4, y: y + h - 0.75, w: w / 2, h: 0.55, fontFace: HEAD, fontSize: 12, bold: true, color: C.midnight, valign: "middle" });
      text(s, pn.foot[1], { x: x + w / 2, y: y + h - 0.75, w: w / 2 - 0.4, h: 0.55, fontFace: HEAD, fontSize: 14, bold: true, color: C.orange, align: "right", valign: "middle" });
    });
  }

  /* ================= Partnership options ================= */
  if (hasOptions) {
    const s = light();
    head(s, "Partnership options", "Choose your level of support.", false, c.options_intro || undefined);
    // included-in-every-option banner
    const by = 2.15;
    s.addShape(R.roundRect, { x: MX, y: by, w: CW, h: 0.72, rectRadius: 0.06, fill: { color: C.midnight }, line: { color: C.orange, width: 1 } });
    text(s, [
      { text: "INCLUDED IN EVERY OPTION  ", options: { bold: true, color: C.orangeSoft, fontFace: HEAD, fontSize: 10, charSpacing: 1.5, breakLine: true } },
      { text: [consult, ...scope.lineItems.map((l) => short(l.name))].filter(Boolean).join(" · ") + (pts ? ` · ${fmtPoints(pts)} service points/month` : ""), options: { color: C.white, fontSize: 10.5 } },
    ], { x: MX + 0.25, y: by + 0.08, w: CW - 0.5, h: 0.6, valign: "middle", fit: "shrink" });
    const opts = scope.options;
    const gap = 0.3;
    const w = (CW - gap * (opts.length - 1)) / opts.length;
    const y = 3.1;
    const h = 3.85;
    opts.forEach((o, i) => {
      const x = MX + i * (w + gap);
      const t = totals[i];
      s.addShape(R.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: o.recommended ? C.peach : C.white }, line: { color: o.recommended ? C.orange : C.border, width: o.recommended ? 1.75 : 0.75 } });
      text(s, o.name.toUpperCase(), { x: x + 0.25, y: y + 0.22, w: w - 1.6, h: 0.3, fontFace: HEAD, fontSize: 13, bold: true, color: o.recommended ? C.orange : C.midnight, charSpacing: 1 });
      text(s, `${o.termMonths} months`, { x: x + w - 1.45, y: y + 0.22, w: 1.2, h: 0.3, fontSize: 10, bold: true, color: C.orange, align: "right" });
      text(s, o.tagline, { x: x + 0.25, y: y + 0.58, w: w - 0.5, h: 0.5, fontSize: 10.5, color: C.body });
      text(s, o.lineItems.slice(0, 6).map((li) => ({ text: short(li.name), options: { bullet: { code: "25AA" }, breakLine: true } })), {
        x: x + 0.2, y: y + 1.15, w: w - 0.4, h: 1.75, fontSize: 10, color: C.midnight, paraSpaceAfter: 3, fit: "shrink",
      });
      text(s, formatK(t.total), { x: x + 0.25, y: y + h - 0.85, w: w - 0.5, h: 0.45, fontFace: HEAD, fontSize: 22, bold: true, color: C.orange });
      text(s, `${t.termMonths} months total${scope.discountPct ? ` · after ${scope.discountPct}% discount` : ""}`, { x: x + 0.25, y: y + h - 0.38, w: w - 0.5, h: 0.25, fontSize: 9, color: C.muted });
    });
  }

  /* ================= Service points ================= */
  if (pts > 0) {
    const s = dark(5);
    head(s, "Flexible resources", "Your monthly service points plan.", true, "Points carry across the partnership, so the mix can shift as priorities change.");
    const cx = MX;
    const cw = 3.6;
    card(s, cx, 2.35, cw, 4.35, true, true);
    text(s, fmtPoints(pts), { x: cx + 0.35, y: 2.6, w: cw - 0.7, h: 1.1, fontFace: HEAD, fontSize: 60, bold: true, color: C.orange });
    text(s, "points per month", { x: cx + 0.35, y: 3.7, w: cw - 0.7, h: 0.35, fontFace: HEAD, fontSize: 15, bold: true, color: C.white });
    text(s, `${formatUSD(pts * POINT_PRICE)}/month at ${formatUSD(POINT_PRICE)} per point`, { x: cx + 0.35, y: 4.05, w: cw - 0.7, h: 0.3, fontSize: 10.5, color: C.steel });
    text(s, c.points_focus, { x: cx + 0.35, y: 4.5, w: cw - 0.7, h: 2.0, fontFace: SERIF, fontSize: 12, italic: true, color: C.mist, fit: "shrink" });
    const lines = Object.entries(scope.points)
      .map(([id, q]) => ({ it: pointItem(id), q }))
      .filter((x) => x.it && x.q > 0)
      .sort((a, b) => b.q * b.it!.points - a.q * a.it!.points)
      .slice(0, 9);
    const tx = cx + cw + 0.35;
    const tw = W - MX - tx;
    const hdr = { bold: true, color: C.orangeSoft, fontFace: HEAD, fontSize: 10, fill: { color: C.midnight } };
    const cell = (t: string, o: Partial<PptxGenJS.TableCellProps> = {}) => ({ text: t, options: { color: C.white, fill: { color: C.navy }, ...o } });
    const rows: PptxGenJS.TableRow[] = [
      [{ text: "DELIVERABLE", options: hdr }, { text: "QTY / MO", options: { ...hdr, align: "right" } }, { text: "PTS EACH", options: { ...hdr, align: "right" } }, { text: "POINTS", options: { ...hdr, align: "right" } }],
      ...lines.map((l) => [
        cell(l.it!.name, { bold: true }),
        cell(fmtPoints(l.q), { align: "right" }),
        cell(l.it!.pointsLabel.replace(" pts", "").replace(" pt", ""), { align: "right", color: C.mist }),
        cell(fmtPoints(l.q * l.it!.points), { align: "right" }),
      ]),
      [
        { text: "Monthly total", options: { bold: true, color: C.white, fill: { color: C.orange }, colspan: 3, fontFace: HEAD } },
        { text: fmtPoints(pts), options: { bold: true, color: C.white, fill: { color: C.orange }, align: "right", fontFace: HEAD } },
      ],
    ];
    s.addTable(rows, {
      x: tx, y: 2.35, w: tw, colW: [tw - 3.3, 1.1, 1.1, 1.1], fontFace: UI, fontSize: 11.5, valign: "middle",
      rowH: Math.min(0.42, 4.35 / rows.length), border: { type: "solid", pt: 0.75, color: C.navyLine }, margin: [3, 10, 3, 10],
    });
  }

  /* ================= Roadmap (Gantt) ================= */
  {
    const s = dark(6);
    const phases = c.roadmap.slice(0, 6);
    const lastMonth = Math.max(0, ...phases.flatMap((ph) => (ph.months.match(/\d+/g) ?? []).map(Number)));
    const term = lastMonth >= 3 ? Math.min(lastMonth, 36) : Math.max(...totals.map((t) => t.termMonths));
    head(s, "The plan", `${term} months, ${["", "one", "two", "three", "four", "five", "six"][phases.length] ?? phases.length} phases.`, true, "Directional timeline. Subject to kickoff date, approvals and data readiness.");
    const labelW = 3.3;
    const gx = MX + labelW;
    const gw = W - MX - gx;
    const monthW = gw / term;
    const parsed = phases.map((ph, i) => {
      const nums = (ph.months.match(/\d+/g) ?? []).map(Number);
      const fs = Math.floor((i * term) / phases.length) + 1;
      const fe = Math.floor(((i + 1) * term) / phases.length);
      const start = Math.min(Math.max(1, nums[0] ?? fs), term);
      const end = Math.min(Math.max(start, nums[1] ?? nums[0] ?? fe), term);
      return { ...ph, start, end };
    });
    const rowH = Math.min(0.98, 4.1 / phases.length);
    const y0 = 2.3;
    for (let m = 1; m <= term; m++) {
      const x = gx + (m - 1) * monthW;
      s.addShape(R.line, { x, y: y0 - 0.05, w: 0, h: rowH * phases.length, line: { color: C.navyLine, width: 0.5, dashType: "dash" } });
      if (term <= 12 || m % Math.ceil(term / 12) === 1) text(s, `M${m}`, { x, y: y0 + rowH * phases.length + 0.02, w: monthW * Math.ceil(term / 12), h: 0.25, fontSize: 9, color: C.steel });
    }
    parsed.forEach((ph, i) => {
      const y = y0 + i * rowH;
      text(s, ph.title, { x: MX, y: y + 0.02, w: labelW - 0.2, h: 0.3, fontFace: HEAD, fontSize: 13, bold: true, color: i % 2 ? C.white : C.orangeSoft });
      text(s, ph.activities.slice(0, 3).join(" · "), { x: MX, y: y + 0.32, w: labelW - 0.25, h: rowH - 0.38, fontSize: 9.5, color: C.steel, fit: "shrink" });
      const bx = gx + (ph.start - 1) * monthW + 0.03;
      const bw = (ph.end - ph.start + 1) * monthW - 0.06;
      s.addShape(R.roundRect, { x: bx, y: y + 0.08, w: bw, h: 0.34, rectRadius: 0.04, fill: { color: i % 2 ? C.slate : C.orange }, line: { color: i % 2 ? C.slate : C.orange } });
      text(s, bw >= 1.9 ? `${ph.phase} · ${ph.months}` : bw >= 0.9 ? ph.months.replace(/Months?\s*/i, "M") : "", { x: bx + 0.08, y: y + 0.08, w: Math.max(bw - 0.16, 0.2), h: 0.34, fontSize: 9.5, bold: true, color: C.white, valign: "middle" });
      text(s, [{ text: "MILESTONE  ", options: { bold: true, color: C.orangeSoft, fontSize: 8.5, charSpacing: 1 } }, { text: ph.milestone, options: { color: C.white, fontSize: 10 } }], {
        x: Math.min(bx, W - MX - 3), y: y + 0.48, w: Math.max(bw, 3), h: Math.max(0.3, rowH - 0.52),
      });
    });
  }

  /* ================= Team ================= */
  {
    const s = light(C.offWhite);
    head(s, "Your partners", "You'll have a dedicated LeadG2 team.", false);
    const team = teamFor(scope).slice(0, 6);
    grid(s, team, 2.15, team.length > 3 ? 4.4 : 3.0, (n) => (n === 4 ? 2 : 3), (t, i, x, y, w, h) => {
      card(s, x, y, w, h, false, i === 0);
      s.addShape(R.rect, { x: x + 0.3, y: y + 0.32, w: 0.42, h: 0.06, fill: { color: C.orange }, line: { color: C.orange } });
      text(s, t.title, { x: x + 0.3, y: y + 0.5, w: w - 0.6, h: 0.4, fontFace: HEAD, fontSize: 16, bold: true, color: C.midnight, fit: "shrink" });
      text(s, t.desc, { x: x + 0.3, y: y + 1.0, w: w - 0.6, h: h - 1.15, fontSize: 12, color: C.body });
    });
  }

  /* ================= Investment detail ================= */
  {
    const s = light();
    head(s, "Investment detail", "Where the investment goes.", false);
    const cols = hasOptions ? scope.options.map((o) => ({ label: `${o.name} · ${o.termMonths} mo`, term: o.termMonths })) : [{ label: "Amount", term: scope.termMonths }];
    const hdr = { bold: true, color: C.white, fontFace: HEAD, fontSize: 10, fill: { color: C.midnight } };
    const cellAmt = (v: string, shade: boolean, extra: Partial<PptxGenJS.TableCellProps> = {}) => ({ text: v, options: { align: "right" as const, color: C.midnight, fill: { color: shade ? C.offWhite : C.white }, ...extra } });
    const amount = (li: LineItem, term: number) => (li.billing === "monthly" ? lineTotal(li) * term : lineTotal(li));
    const rows: PptxGenJS.TableRow[] = [[{ text: hasOptions ? "In every option" : "Service", options: hdr }, ...cols.map((col) => ({ text: col.label, options: { ...hdr, align: "right" as const } }))]];
    const coreRows = scope.lineItems.slice(0, 9);
    coreRows.forEach((li, i) => {
      const label = `${short(li.name)}${li.billing === "monthly" ? `  (${formatUSD(lineTotal(li))}/mo)` : li.vendor ? "  (estimate*)" : ""}`;
      rows.push([{ text: label, options: { color: C.midnight, fill: { color: i % 2 ? C.offWhite : C.white } } }, ...cols.map((col) => cellAmt(formatUSD(amount(li, col.term)), i % 2 === 1))]);
    });
    const extraCore = scope.lineItems.slice(coreRows.length);
    if (extraCore.length) rows.push([{ text: `Other included items (${extraCore.length})`, options: { color: C.midnight } }, ...cols.map((col) => cellAmt(formatUSD(extraCore.reduce((a, li) => a + amount(li, col.term), 0)), false))]);
    if (consult) rows.push([{ text: `${consult}  (${formatUSD(CONSULTING_MONTHLY)}/mo)`, options: { color: C.midnight } }, ...cols.map((col) => cellAmt(formatUSD(CONSULTING_MONTHLY * col.term), false))]);
    if (pts > 0) rows.push([{ text: `Service points  (${fmtPoints(pts)}/mo × $${POINT_PRICE})`, options: { color: C.midnight } }, ...cols.map((col) => cellAmt(formatUSD(pts * POINT_PRICE * col.term), false))]);
    if (hasOptions) rows.push([{ text: "Option-specific support & services", options: { bold: true, color: C.midnight, fill: { color: C.peach } } }, ...scope.options.map((o) => cellAmt(formatUSD(o.lineItems.reduce((a, li) => a + amount(li, o.termMonths), 0)), false, { fill: { color: C.peach }, bold: true }))]);
    rows.push([{ text: "Standard", options: { bold: true, color: C.midnight } }, ...totals.map((t) => cellAmt(formatUSD(t.standard), false, { bold: true }))]);
    if (scope.discountPct > 0) rows.push([{ text: `${scope.discountLabel || "Discount"} (${scope.discountPct}%)`, options: { color: C.orange } }, ...totals.map((t) => cellAmt(`–${formatUSD(t.discount)}`, false, { color: C.orange }))]);
    const firstW = hasOptions ? CW - 2.1 * cols.length : CW - 2.6;
    s.addTable(rows, {
      x: MX, y: 2.05, w: CW, colW: [firstW, ...cols.map(() => (CW - firstW) / cols.length)], fontFace: UI, fontSize: 10.5, valign: "middle",
      rowH: Math.min(0.4, 3.75 / rows.length), border: { type: "solid", pt: 0.75, color: C.border }, margin: [3, 10, 3, 10],
    });
    const by = 6.15;
    s.addShape(R.roundRect, { x: MX, y: by, w: CW, h: 0.62, rectRadius: 0.06, fill: { color: C.midnight }, line: { color: C.midnight } });
    text(s, [
      { text: scope.discountPct > 0 ? `After your ${scope.discountLabel || "discount"}:  ` : "Total LeadG2 investment:  ", options: { color: C.white } },
      { text: lo === hi ? formatUSD(lo) : `${formatK(lo)} – ${formatK(hi)}`, options: { color: C.orange, bold: true } },
      { text: hasOptions ? `  over ${Math.min(...totals.map((t) => t.termMonths))} – ${Math.max(...totals.map((t) => t.termMonths))} months` : `  over ${totals[0].termMonths} months`, options: { color: C.white } },
    ], { x: MX, y: by, w: CW, h: 0.62, fontFace: HEAD, fontSize: 17, bold: true, align: "center", valign: "middle" });
    text(s, [terms.hubspotInvestment ? `HubSpot licensing (paid separately): ${terms.hubspotInvestment}.` : "", terms.exclusions, "Pricing subject to change after 15 days.", hasVendorItems(scope) ? `*${VENDOR_NOTE}` : ""].filter(Boolean).join(" "), {
      x: MX, y: by + 0.7, w: CW, h: 0.3, fontSize: 9, italic: true, color: C.muted,
    });
  }

  /* ================= Open questions ================= */
  if (c.open_questions.length > 0) {
    const s = light();
    const nWord = ["", "One answer", "Two answers", "Three answers", "Four answers", "Five answers", "Six answers"][c.open_questions.length] ?? `${c.open_questions.length} answers`;
    head(s, "Open questions", `${nWord} to ${hasOptions ? "turn the range into a number" : "finalize the scope"}.`, false, "Everything else in this deck is based on what you've told us.");
    const qs = c.open_questions.slice(0, 6);
    const step = Math.min(0.85, 4.5 / qs.length);
    qs.forEach((q, i) => {
      const y = 2.25 + i * step;
      text(s, String(i + 1).padStart(2, "0"), { x: MX, y, w: 0.6, h: 0.35, fontFace: HEAD, fontSize: 16, bold: true, color: C.orange });
      text(s, q.question, { x: MX + 0.7, y, w: 5.2, h: step - 0.15, fontFace: HEAD, fontSize: 13, bold: true, color: C.midnight });
      s.addShape(R.line, { x: MX + 6.1, y: y + 0.02, w: 0, h: step - 0.25, line: { color: C.border, width: 1 } });
      text(s, q.detail, { x: MX + 6.35, y, w: CW - 6.35, h: step - 0.15, fontSize: 11.5, color: C.body });
    });
  }

  /* ================= Next steps ================= */
  {
    const s = dark(4);
    text(s, "NEXT STEPS", { x: MX, y: 0.78, w: 6, h: 0.26, fontFace: HEAD, fontSize: 12, bold: true, color: C.orangeSoft, charSpacing: 2 });
    text(s, [{ text: "Let's get ", options: { color: C.white } }, { text: "started.", options: { color: C.orange } }], {
      x: MX, y: 1.12, w: 8, h: 0.6, fontFace: HEAD, fontSize: 32, bold: true, charSpacing: -0.5, valign: "middle",
    });
    logo(s, true);
    c.next_steps.slice(0, 4).forEach((st, i) => {
      const y = 2.3 + i * 0.95;
      text(s, String(i + 1), { x: MX, y, w: 0.4, h: 0.35, fontFace: HEAD, fontSize: 15, bold: true, color: C.orange });
      text(s, st.title, { x: MX + 0.45, y, w: 7.6, h: 0.32, fontFace: HEAD, fontSize: 15, bold: true, color: C.white });
      text(s, st.description, { x: MX + 0.45, y: y + 0.34, w: 7.6, h: 0.3, fontSize: 11.5, color: C.steel });
      s.addShape(R.line, { x: MX + 0.45, y: y + 0.8, w: 7.6, h: 0, line: { color: C.navyLine, width: 0.75 } });
    });
    const cx = 9.35;
    const cw = W - MX - cx;
    card(s, cx, 2.3, cw, 3.75, true, true);
    text(s, "CRITICAL PATH", { x: cx + 0.3, y: 2.55, w: cw - 0.6, h: 0.25, fontFace: HEAD, fontSize: 10, bold: true, color: C.orangeSoft, charSpacing: 1.5 });
    [
      ["Proposal review", dateLong.replace(/, \d{4}$/, "")],
      ["Contract signed", `By ${formatDate(terms.contractStart)}`],
      ["Contract start", formatDate(terms.contractStart)],
      ["Kick-off call", `Week of ${formatDate(terms.contractStart)}`],
    ].forEach(([k, v], i) => {
      const y = 2.95 + i * 0.72;
      text(s, k, { x: cx + 0.3, y, w: cw - 0.6, h: 0.28, fontFace: HEAD, fontSize: 12.5, bold: true, color: C.white });
      text(s, v, { x: cx + 0.3, y: y + 0.28, w: cw - 0.6, h: 0.25, fontSize: 10.5, color: C.steel });
    });
    void contractEnd;
  }

  /* ================= Thank you ================= */
  {
    const s = dark(1);
    logo(s, true, 10.36, 0.47);
    text(s, "Thank you", { x: MX, y: 1.45, w: 11, h: 0.85, fontFace: HEAD, fontSize: 48, bold: true, color: C.orange, charSpacing: -1, valign: "middle" });
    text(s, p.clientName, { x: MX, y: 2.45, w: 9, h: 0.8, fontFace: HEAD, fontSize: 32, bold: true, color: C.white, fit: "shrink" });
    text(s, "We look forward to building this together.", { x: MX - 0.06, y: 4.48, w: 7.15, h: 0.6, fontFace: SERIF, fontSize: 22, italic: true, color: C.mist });
    presenter(s);
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
