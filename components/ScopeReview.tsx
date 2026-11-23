"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SpeechInput } from "./SpeechInput";
import { POINT_CATEGORIES, POINT_ITEMS } from "@/lib/offerings";
import {
  CONSULTING_MONTHLY,
  HOURLY_RATE,
  POINT_PRICE,
  consultingName,
  implementationItems,
  retainerItems,
  allTotals,
  lineTotal,
  monthlyPoints,
  newKey,
  type CatalogProduct,
  type LineItem,
  type PartnershipOption,
  type ScopeDraft,
} from "@/lib/pricing";
import { contractEnd, fmtPoints, formatDate, formatUSD, type DealTerms, type ScopingSession } from "@/lib/types";

export function ScopeReview({ initial, catalog, catalogSource }: { initial: ScopingSession; catalog: CatalogProduct[]; catalogSource: string }) {
  const router = useRouter();
  const a = initial.analysis;
  const rec = a.recommendation;
  const [scope, setScope] = useState<ScopeDraft>(initial.scope);
  const [terms, setTerms] = useState<DealTerms>(initial.terms);
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers);
  const [notes, setNotes] = useState(initial.consultantNotes);
  const [showAllPoints, setShowAllPoints] = useState(false);
  const [suggestions, setSuggestions] = useState<LineItem[]>(initial.suggestions ?? []);
  const consulting = scope.consulting ?? { marketing: false, hubspot: false, rationale: "" };
  const impl = implementationItems(scope.lineItems);
  const monthlyAdds = retainerItems(scope.lineItems);
  const implTotal = impl.reduce((a, li) => a + lineTotal(li), 0);
  const replaceSubset = (billing: LineItem["billing"], next: LineItem[]) =>
    setScope((s) => ({ ...s, lineItems: [...s.lineItems.filter((i) => i.billing !== billing), ...next.map((i) => ({ ...i, billing }))] }));
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recPoints = useMemo(() => new Map(rec.points_plan.map((p) => [p.id, p])), [rec.points_plan]);
  const pts = monthlyPoints(scope.points);
  const totals = allTotals(scope);

  /* ---------- autosave ---------- */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaving("saving");
    const t = setTimeout(async () => {
      await save();
      setSaving("saved");
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, terms, answers, notes]);

  function save() {
    return fetch(`/api/sessions/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, terms, answers, consultantNotes: notes }),
    });
  }

  const setQty = (id: string, qty: number) =>
    setScope((s) => {
      const points = { ...s.points };
      if (qty <= 0) delete points[id];
      else points[id] = Math.round(qty * 100) / 100;
      return { ...s, points };
    });

  const setOption = (key: string, patch: Partial<PartnershipOption>) =>
    setScope((s) => ({ ...s, options: s.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) }));

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      await save();
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: initial.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      router.push(`/p/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  const n = (i: number) => String(i).padStart(2, "0");
  let sec = 1;

  return (
    <div className="mx-auto w-full max-w-5xl px-[18px] pb-40 pt-10 sm:px-10">
      {/* ---------- read-out ---------- */}
      <span className="label inline-block rounded-sm bg-cream px-2 py-1 text-slate">{a.deal_size} deal</span>
      <h1 className="mt-3 text-[34px] sm:text-[44px]">
        {initial.snapshot.company.name}, <span className="accent">in brief.</span>
      </h1>
      <p className="lead mt-4">{a.situation}</p>

      <Section title="What we've learned" n={n(sec++)}>
        <div className="space-y-3">
          {a.what_we_learned.map((w, i) => (
            <div key={i} className="card p-5">
              <p className="font-sans text-[17px] font-bold text-navy">{w.point}</p>
              <blockquote className="mt-2 border-l-2 border-orange pl-3 text-[15px] italic text-slate">“{w.evidence}”</blockquote>
              <p className="label mt-3 text-[11px] text-orange-dark">{w.source}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card title="Desired business results">
          <ul className="space-y-2 text-sm">
            {a.desired_business_results.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-orange" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Pain points">
          <ul className="space-y-2 text-sm">
            {a.pain_points.map((p, i) => (
              <li key={i}>
                <span className="font-semibold">{p.title}</span> <span className="text-slate">— {p.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Stakeholders">
          <ul className="space-y-2 text-sm">
            {a.stakeholders.map((p, i) => (
              <li key={i}>
                <span className="font-semibold">{p.name}</span> <span className="text-slate">· {p.role} · {p.involvement}</span>
              </li>
            ))}
            {!a.stakeholders.length && <li className="text-slate">None identified</li>}
          </ul>
        </Card>
        <Card title="Signals">
          <dl className="space-y-2 text-sm">
            <Signal k="HubSpot" v={a.hubspot_status} />
            {a.current_systems.length > 0 && <Signal k="Current systems" v={a.current_systems.map((s) => `${s.name} (${s.role})`).join(" · ")} />}
            <Signal k="Budget" v={a.budget_signals} />
            <Signal k="Timeline" v={a.timeline_signals} />
          </dl>
        </Card>
      </div>

      {a.open_questions.length > 0 && (
        <Section title="Open questions" n={n(sec++)} sub="Answer what you can. Anything left blank appears in the deck as an open question to confirm.">
          <div className="space-y-5">
            {a.open_questions.map((q, i) => (
              <div key={i}>
                <p className="text-[17px] font-extrabold">{q.question}</p>
                <p className="mb-2 text-sm text-slate">{q.why}</p>
                <SpeechInput value={answers[i] ?? ""} onChange={(v) => setAnswers((s) => ({ ...s, [i]: v }))} placeholder="Type or dictate the answer…" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- scope: HubSpot implementation ---------- */}
      <Section title="HubSpot implementation — fixed scope of work" n={n(sec++)} sub={rec.approach}>
        <p className="mb-3 text-xs text-slate">
          One-time{scope.options.length ? ", included in every option" : ""}. Prices from your HubSpot product library
          {catalogSource === "snapshot" ? " (saved copy — HubSpot not connected)" : ""}. Custom work is priced from an internal estimate at {formatUSD(HOURLY_RATE)}/hour. Integrations and migrations are vendor-quoted: start from the agent&apos;s estimate, then enter the vendor&apos;s price and deliverables.
        </p>
        <LineItemsEditor items={impl} catalog={catalog} billing="one_time" onChange={(next) => replaceSubset("one_time", next)} />
        {impl.length > 0 && (
          <p className="mt-3 text-right text-sm text-slate">
            <span className="font-extrabold text-navy">{formatUSD(implTotal)}</span> one-time, fixed price
          </p>
        )}
      </Section>

      {/* ---------- scope: growth retainer ---------- */}
      <Section
        title="Growth retainer — consulting + service points"
        n={n(sec++)}
        sub={`Consulting is ${formatUSD(CONSULTING_MONTHLY)}/month for marketing, HubSpot, or both. Service points and other monthly services are added on top.`}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["marketing", "Marketing consulting", "Strategy, content planning, campaigns, KPI reviews."],
              ["hubspot", "HubSpot consulting", "CRM optimization, reporting, training, adoption."],
            ] as const
          ).map(([k, label, desc]) => {
            const on = consulting[k];
            return (
              <button
                key={k}
                aria-pressed={on}
                onClick={() => setScope((s) => ({ ...s, consulting: { ...consulting, [k]: !on } }))}
                className={`rounded-md border p-4 text-left transition ${on ? "border-orange bg-cream" : "border-line bg-white hover:border-navy"}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-extrabold">{label}</span>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-sm border text-[11px] font-bold ${on ? "border-orange bg-orange text-white" : "border-line text-transparent"}`}>✓</span>
                </span>
                <span className="mt-1 block text-sm text-slate">{desc}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-slate">
          {consultingName(consulting) ? (
            <>
              <span className="font-semibold text-navy">{consultingName(consulting)}</span> — {formatUSD(CONSULTING_MONTHLY)}/month. {consulting.rationale}
            </>
          ) : (
            "No consulting retainer."
          )}
        </p>
        <h3 className="mb-3 mt-6 text-xs font-bold uppercase tracking-[0.16em] text-slate">Other monthly services</h3>
        <LineItemsEditor items={monthlyAdds} catalog={catalog} billing="monthly" onChange={(next) => replaceSubset("monthly", next)} />
      </Section>

      {/* ---------- suggestions ---------- */}
      {suggestions.length > 0 && (
        <Section title="Also worth considering" n={n(sec++)} sub="High-value additions the agent would offer. They aren't in the scope unless you add them.">
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((sg) => (
              <div key={sg.key} className="flex flex-col rounded-md border border-dashed border-line bg-smoke p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-extrabold">{sg.name}</p>
                  <span className="shrink-0 text-sm font-bold text-orange-dark">
                    {formatUSD(lineTotal(sg))}
                    {sg.billing === "monthly" ? "/mo" : ""}
                  </span>
                </div>
                <p className="mt-1 flex-1 text-sm text-slate">{sg.rationale}</p>
                <button
                  onClick={() => {
                    setScope((s) => ({ ...s, lineItems: [...s.lineItems, { ...sg, key: newKey() }] }));
                    setSuggestions((cur) => cur.filter((x) => x.key !== sg.key));
                  }}
                  className="mt-3 self-start rounded border border-line px-3 py-1.5 text-sm font-semibold hover:border-orange hover:text-orange-dark"
                >
                  + Add to scope
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- options ---------- */}
      <Section
        title="Partnership options"
        n={n(sec++)}
        sub={
          scope.options.length
            ? "Each option adds its own items and term on top of the core scope — like Guided / Collaborative / Embedded in the Hubbard proposal."
            : "None for this deal. Add options when the client should choose a level of support or an approach."
        }
      >
        {!scope.options.length && (
          <label className="mb-4 block max-w-xs">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate">Term (months)</span>
            <input type="number" min={1} value={scope.termMonths} onChange={(e) => setScope({ ...scope, termMonths: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} />
          </label>
        )}
        <div className="space-y-5">
          {scope.options.map((o) => (
            <div key={o.key} className={`rounded-lg border p-5 ${o.recommended ? "border-orange" : "border-line"} bg-smoke`}>
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr_110px]">
                <input value={o.name} onChange={(e) => setOption(o.key, { name: e.target.value })} className={`${inputCls} font-extrabold`} aria-label="Option name" />
                <input value={o.tagline} onChange={(e) => setOption(o.key, { tagline: e.target.value })} className={inputCls} aria-label="Option tagline" />
                <label className="flex items-center gap-2 text-sm text-slate">
                  <input type="number" min={1} value={o.termMonths} onChange={(e) => setOption(o.key, { termMonths: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} aria-label="Term in months" />
                  mo
                </label>
              </div>
              <div className="mt-4">
                <LineItemsEditor items={o.lineItems} catalog={catalog} onChange={(lineItems) => setOption(o.key, { lineItems })} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm">
                <label className="flex items-center gap-2 text-slate">
                  <input
                    type="checkbox"
                    checked={o.recommended}
                    onChange={(e) => setScope((s) => ({ ...s, options: s.options.map((x) => ({ ...x, recommended: x.key === o.key ? e.target.checked : false })) }))}
                  />
                  Recommended
                </label>
                <button onClick={() => setScope((s) => ({ ...s, options: s.options.filter((x) => x.key !== o.key) }))} className="ml-auto text-slate hover:text-red-700">
                  Remove option
                </button>
              </div>
            </div>
          ))}
        </div>
        {scope.options.length < 3 && (
          <button
            onClick={() =>
              setScope((s) => ({
                ...s,
                options: [
                  ...s.options,
                  { key: newKey(), name: ["Guided", "Collaborative", "Embedded"][s.options.length], tagline: "", termMonths: s.termMonths, recommended: false, lineItems: [] },
                ],
              }))
            }
            className="mt-4 rounded border border-dashed border-line px-4 py-2 text-sm font-semibold text-slate hover:border-navy hover:text-navy"
          >
            + Add option
          </button>
        )}
      </Section>

      {/* ---------- service points ---------- */}
      <Section title="Monthly service points" n={n(sec++)} sub={`1 point = 1 hour = ${formatUSD(POINT_PRICE)}. ${fmtPoints(pts)} points = ${formatUSD(pts * POINT_PRICE)}/month.`}>
        <div className="mb-3 flex justify-end">
          <button onClick={() => setShowAllPoints((v) => !v)} className="text-sm font-semibold text-orange-dark hover:underline">
            {showAllPoints ? "Show selected only" : "Show the full menu"}
          </button>
        </div>
        <div className="space-y-6">
          {POINT_CATEGORIES.map((cat) => {
            const items = POINT_ITEMS.filter((i) => i.category === cat.key && (showAllPoints || recPoints.has(i.id) || (scope.points[i.id] ?? 0) > 0));
            if (!items.length) return null;
            return (
              <div key={cat.key}>
                <p className="label mb-2 text-slate">{cat.eyebrow}</p>
                <div className="overflow-hidden rounded-md border border-line">
                  {items.map((item, i) => {
                    const qty = scope.points[item.id] ?? 0;
                    return (
                      <div key={item.id} className={`flex items-center gap-4 bg-white px-4 py-3 ${i ? "border-t border-line" : ""} ${qty ? "" : "opacity-70"}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {item.name} <span className="ml-1 text-xs font-bold text-orange-dark">{item.pointsLabel}</span>
                          </p>
                          <p className="text-sm text-slate">{recPoints.get(item.id)?.rationale ?? item.desc}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <QtyBtn label={`Fewer ${item.name}`} onClick={() => setQty(item.id, Math.max(0, Math.ceil(qty) - 1))}>−</QtyBtn>
                          <span className="w-10 text-center font-extrabold tabular-nums">{fmtPoints(qty)}</span>
                          <QtyBtn label={`More ${item.name}`} onClick={() => setQty(item.id, Math.floor(qty) + 1)}>+</QtyBtn>
                        </div>
                        <span className="hidden w-16 text-right text-sm tabular-nums text-slate sm:block">{fmtPoints(qty * item.points)} pts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!pts && !showAllPoints && <p className="text-sm text-slate">No service points recommended for this deal.</p>}
        </div>
      </Section>

      {/* ---------- terms & totals ---------- */}
      <Section title="Contract & investment" n={n(sec++)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contract start">
            <input type="date" value={terms.contractStart} onChange={(e) => setTerms({ ...terms, contractStart: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <Field label="Discount %">
              <input type="number" min={0} max={50} value={scope.discountPct} onChange={(e) => setScope({ ...scope, discountPct: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
            </Field>
            <Field label="Discount label">
              <input value={scope.discountLabel} placeholder="Preferred Partner discount" onChange={(e) => setScope({ ...scope, discountLabel: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <Field label="HubSpot licensing (paid separately)" wide>
            <input placeholder="e.g. Sales Hub Pro upgrade — $1,500/month" value={terms.hubspotInvestment} onChange={(e) => setTerms({ ...terms, hubspotInvestment: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Exclusions / footnote" wide>
            <input value={terms.exclusions} onChange={(e) => setTerms({ ...terms, exclusions: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="mt-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="bg-smoke text-left text-[11px] uppercase tracking-wider text-slate">
                <th className="px-4 py-2.5">{scope.options.length ? "Option" : "Scope"}</th>
                <th className="px-4 py-2.5 text-right">One-time</th>
                <th className="px-4 py-2.5 text-right">Monthly</th>
                <th className="px-4 py-2.5 text-right">Term</th>
                <th className="px-4 py-2.5 text-right">Standard</th>
                <th className="px-4 py-2.5 text-right">Your price</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => (
                <tr key={t.label} className="border-t border-line bg-white">
                  <td className="px-4 py-3 font-semibold">{t.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatUSD(t.oneTime)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatUSD(t.monthly)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.termMonths} mo <span className="text-slate">→ {formatDate(contractEnd(terms.contractStart, t.termMonths))}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate">{formatUSD(t.standard)}</td>
                  <td className="px-4 py-3 text-right font-extrabold tabular-nums text-orange-dark">{formatUSD(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Anything else for the write-up?" n={n(sec++)}>
        <SpeechInput value={notes} onChange={setNotes} placeholder="Tone, emphasis, things to leave out…" />
      </Section>

      {/* ---------- sticky bar ---------- */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur lg:left-[360px]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3 sm:px-8">
          <div>
            <p className="text-2xl font-extrabold text-orange-dark">
              {totals.length > 1
                ? `${formatUSD(Math.min(...totals.map((t) => t.total)))} – ${formatUSD(Math.max(...totals.map((t) => t.total)))}`
                : formatUSD(totals[0].total)}
            </p>
            <p className="text-xs text-slate">
              {consultingName(consulting) ? `${consultingName(consulting)} · ` : ""}
              {impl.length} implementation items · {scope.options.length ? `${scope.options.length} options · ` : ""}
              {fmtPoints(pts)} pts/mo
              {saving === "saving" ? " · saving…" : saving === "saved" ? " · saved" : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {initial.proposalId && (
              <Link href={`/p/${initial.proposalId}`} className="text-sm text-slate hover:text-navy">
                Last version →
              </Link>
            )}
            <button
              onClick={generate}
              disabled={generating}
              className="btn btn-primary"
            >
              {generating ? "Writing executive summary & deck…" : "Generate executive summary & deck →"}
            </button>
          </div>
          {error && <p className="w-full text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Line items                                                          */
/* ------------------------------------------------------------------ */

function LineItemsEditor({ items, catalog, onChange, billing }: { items: LineItem[]; catalog: CatalogProduct[]; onChange: (items: LineItem[]) => void; billing?: LineItem["billing"] }) {
  const update = (key: string, patch: Partial<LineItem>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const groups = useMemo(() => {
    const order = ["base", "onboarding", "add-on", "retainer", "project"] as const;
    const label: Record<string, string> = { base: "Base", onboarding: "Onboarding", "add-on": "Add-ons", retainer: "Monthly", project: "Projects" };
    return order
      .map((c) => ({ label: label[c], products: catalog.filter((p) => p.category === c && (!billing || p.billing === billing)) }))
      .filter((g) => g.products.length);
  }, [catalog, billing]);

  function addProduct(id: string) {
    const p = catalog.find((x) => x.id === id);
    if (!p) return;
    onChange([
      ...items,
      { key: newKey(), productId: p.id, name: p.name, description: p.description, billing: p.billing, qty: 1, unitPrice: p.price, hours: p.hourly ? 1 : null, rationale: "" },
    ]);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-line">
        {items.map((li, i) => (
          <div key={li.key} className={`grid gap-3 bg-white px-4 py-3 sm:grid-cols-[1fr_auto] ${i ? "border-t border-line" : ""}`}>
            <div className="min-w-0">
              {li.productId ? (
                <p className="font-semibold">{li.name}</p>
              ) : (
                <input value={li.name} onChange={(e) => update(li.key, { name: e.target.value })} className={`${inputCls} py-1.5 font-semibold`} aria-label="Custom work name" />
              )}
              <p className="mt-0.5 text-xs text-slate">
                <span
                  className={`mr-2 rounded-sm px-1.5 py-0.5 font-bold uppercase ${li.vendor ? "bg-sky-100 text-sky-800" : li.productId ? "bg-smoke text-orange-dark" : "bg-cream text-orange-dark"}`}
                >
                  {li.vendor ? "Vendor quote · starting estimate" : li.productId ? "Product" : "Custom · fixed price"}
                </span>
                {li.rationale}
              </p>
              {li.vendor && (
                <label className="mt-2 block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate">Deliverables (one per line — update from the vendor&apos;s quote)</span>
                  <textarea
                    rows={Math.min(6, Math.max(3, li.description.split("\n").length))}
                    value={li.description}
                    onChange={(e) => update(li.key, { description: e.target.value })}
                    className={`${inputCls} py-2 text-sm`}
                    aria-label={`Deliverables for ${li.name}`}
                  />
                </label>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm sm:justify-end">
              {!billing &&
                (li.productId ? (
                  <span className="rounded-sm bg-smoke px-2 py-1 text-xs text-slate">{li.billing === "monthly" ? "Monthly" : "One-time"}</span>
                ) : (
                  <select value={li.billing} onChange={(e) => update(li.key, { billing: e.target.value as LineItem["billing"] })} className={`${inputBase} w-auto py-1.5 text-sm`} aria-label="Billing">
                    <option value="one_time">One-time</option>
                    <option value="monthly">Monthly</option>
                  </select>
                ))}
              {li.vendor ? (
                <label className="flex items-center gap-1 text-slate" title="Starting estimate — replace with the vendor's quote">
                  $
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={li.unitPrice}
                    onChange={(e) => update(li.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    className={`${inputBase} w-28 py-1.5 text-sm`}
                    aria-label={`Price for ${li.name}`}
                  />
                </label>
              ) : (
              <label className="flex items-center gap-1 text-slate">
                ×
                <input type="number" min={0} step={1} value={li.qty} onChange={(e) => update(li.key, { qty: Math.max(0, Number(e.target.value) || 0) })} className={`${inputBase} w-16 py-1.5 text-sm`} aria-label="Quantity" />
              </label>
              )}
              {li.hours != null && (
                <label className="flex items-center gap-1 text-slate" title="Internal estimate — sets the fixed price, never shown to the client">
                  <input type="number" min={0} value={li.hours} onChange={(e) => update(li.key, { hours: Math.max(0, Number(e.target.value) || 0) })} className={`${inputBase} w-20 py-1.5 text-sm`} aria-label="Hours" />
                  hrs est.
                </label>
              )}
              <span className="w-28 text-right font-extrabold tabular-nums">
                {formatUSD(lineTotal(li))}
                <span className="text-xs font-normal text-slate">{li.billing === "monthly" ? "/mo" : ""}</span>
              </span>
              <button onClick={() => onChange(items.filter((x) => x.key !== li.key))} aria-label={`Remove ${li.name}`} className="px-1 text-slate hover:text-red-700">
                ✕
              </button>
            </div>
          </div>
        ))}
        {!items.length && <p className="bg-white px-4 py-3 text-sm text-slate">No items.</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select value="" onChange={(e) => addProduct(e.target.value)} className={`${inputBase} w-auto max-w-full py-2 text-sm`} aria-label="Add a product">
          <option value="">+ Add a product…</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.hourly ? `hourly` : `${formatUSD(p.price)}${p.billing === "monthly" ? "/mo" : ""}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={() =>
            onChange([...items, { key: newKey(), productId: null, name: "Custom work", description: "", billing: billing ?? "one_time", qty: 1, unitPrice: 0, hours: 10, rationale: "" }])
          }
          className="rounded border border-dashed border-line px-3 py-2 text-sm font-semibold text-slate hover:border-navy hover:text-navy"
        >
          + Custom work
        </button>
        {billing !== "monthly" && (
          <button
            onClick={() =>
              onChange([
                ...items,
                {
                  key: newKey(),
                  productId: null,
                  name: "Integration build",
                  description: "Requirements & field mapping\nBuild & configuration\nTesting & UAT\nGo-live support",
                  billing: "one_time",
                  qty: 1,
                  unitPrice: 25000,
                  hours: null,
                  rationale: "Outsourced — update with the vendor's quote.",
                  vendor: true,
                },
              ])
            }
            className="rounded border border-dashed border-sky-300 bg-white px-3 py-2 text-sm font-bold text-sky-800 hover:border-sky-700"
          >
            + Vendor-quoted item (integration / migration)
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const inputBase =
  "rounded-sm border border-line bg-white px-3 py-2.5 font-sans text-[15px] text-navy placeholder:text-steel focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/10";
const inputCls = `w-full ${inputBase}`;

function Section({ title, n, sub, children }: { title: string; n: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-14 border-t border-line pt-10">
      <h2 className="flex items-baseline gap-3 text-[28px]">
        <span className="num text-[22px] font-normal">{n}</span>
        {title}
      </h2>
      {sub && <p className="mb-5 mt-2 max-w-3xl text-[16px] text-slate">{sub}</p>}
      <div className={sub ? "" : "mt-5"}>{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-rule p-5 pt-6">
      <h3 className="mb-3 text-[17px]">{title}</h3>
      {children}
    </div>
  );
}

function Signal({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label text-[11px] text-slate">{k}</dt>
      <dd className="text-navy">{v}</dd>
    </div>
  );
}

function QtyBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid h-8 w-8 place-items-center rounded border border-line bg-smoke font-bold text-navy transition hover:border-orange">
      {children}
    </button>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate">{label}</span>
      {children}
    </label>
  );
}
