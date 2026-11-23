"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Brand";
import { pointItem, POINT_CATEGORIES, POINT_ITEMS, WHO_WE_ARE } from "@/lib/offerings";
import {
  CONSULTING_MONTHLY,
  HUBSPOT_CONSULTING_INCLUDES,
  MARKETING_CONSULTING_INCLUDES,
  POINT_PRICE,
  allTotals,
  consultingName,
  implementationItems,
  includesOf,
  lineTotal,
  monthlyPoints,
  retainerItems,
  VENDOR_NOTE,
  hasVendorItems,
  type LineItem,
} from "@/lib/pricing";
import { teamFor } from "@/lib/teamFor";
import { contractEnd, fmtPoints, formatDate, formatK, formatUSD, type Proposal } from "@/lib/types";

/**
 * Client-facing executive summary, built to the LeadG2 brand guide (v1.1):
 * cream hero → alternating White / Smoke sections → Midnight closing panel. Mulish headlines with a Lora-italic accent,
 * Lora body, feature cards with an orange rule and Lora-italic numbers, Midnight emphasis for the side we recommend.
 */
export function ProposalView({ p, sessionId }: { p: Proposal; sessionId?: string }) {
  const c = p.content;
  const scope = p.scope;
  const terms = p.terms;
  const pts = monthlyPoints(scope.points);
  const totals = allTotals(scope);
  const hasOptions = scope.options.length > 0;
  const recIdx = Math.max(0, scope.options.findIndex((o) => o.recommended));
  const headline = totals[hasOptions ? recIdx : 0];
  const lo = Math.min(...totals.map((t) => t.total));
  const hi = Math.max(...totals.map((t) => t.total));
  const team = teamFor(scope);
  const longDate = new Date(p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const consult = consultingName(scope.consulting);
  const impl = implementationItems(scope.lineItems);
  const monthlyAdds = retainerItems(scope.lineItems);
  const implTotal = impl.reduce((a, li) => a + lineTotal(li), 0);
  const hasRetainer = Boolean(consult) || pts > 0 || monthlyAdds.length > 0;
  const retainerMonthly = (consult ? CONSULTING_MONTHLY : 0) + pts * POINT_PRICE + monthlyAdds.reduce((a, li) => a + lineTotal(li), 0);
  const note = (name: string) => c.item_notes.find((n) => n.name.trim().toLowerCase() === name.trim().toLowerCase())?.why_for_you;
  const short = (name: string) => name.replace(/^\[[^\]]+\]\s*/, "");

  const sections = [
    ["investment", "Investment"],
    ["learned", "What we've learned"],
    ["services", "Scope"],
    ...(hasOptions ? [["options", "Options"]] : []),
    ...(pts ? [["points", "Service points"]] : []),
    ["roadmap", "Roadmap"],
    ["start", "Next steps"],
  ] as [string, string][];

  const [active, setActive] = useState<string>("investment");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const reveal = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")), { threshold: 0.1 });
    document.querySelectorAll(".reveal").forEach((el) => reveal.observe(el));
    const spy = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("section[id]").forEach((el) => spy.observe(el));
    return () => {
      reveal.disconnect();
      spy.disconnect();
    };
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function downloadDeck() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/proposals/${p.id}/pptx`);
      if (!res.ok) throw new Error((await res.json()).error || "Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${p.clientName.replace(/[^a-z0-9]+/gi, "_")}_x_LeadG2.pptx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const pointLines = Object.entries(scope.points)
    .map(([id, qty]) => ({ item: pointItem(id), qty }))
    .filter((l): l is { item: NonNullable<ReturnType<typeof pointItem>>; qty: number } => Boolean(l.item) && l.qty > 0)
    .sort((a, b) => b.qty * b.item.points - a.qty * a.item.points);

  const path = [
    ["Proposal review call", longDate],
    ["Edits to the proposal, if needed", "Within 1 week"],
    ["Contract sent", "Following approval"],
    ["Contract signed", `By ${formatDate(terms.contractStart)}`],
    ["Contract start", formatDate(terms.contractStart)],
    ["Kickoff call", `Week of ${formatDate(terms.contractStart)}`],
  ];

  const price = (li: LineItem) => `${formatUSD(lineTotal(li))}${li.billing === "monthly" ? "/mo" : ""}`;
  const amount = (li: LineItem, term: number) => (li.billing === "monthly" ? lineTotal(li) * term : lineTotal(li));
  const cols = hasOptions ? scope.options.map((o) => ({ key: o.key, label: `${o.name} · ${o.termMonths} mo`, term: o.termMonths })) : [{ key: "one", label: "Investment", term: scope.termMonths }];

  return (
    <div className="bg-white text-navy">
      {/* ---------- header ---------- */}
      <div className="no-print sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-page items-center gap-4 px-[18px] sm:px-8">
          <Link href="/" className="shrink-0" aria-label="LeadG2">
            <Logo variant="color" className="h-[22px] w-auto" />
          </Link>
          <nav className="hidden flex-1 justify-center gap-1 xl:flex">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={`rounded-sm px-3 py-1.5 text-[14px] font-bold transition ${active === id ? "text-orange-dark" : "text-navy hover:text-orange-dark"}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {sessionId && (
              <Link href={`/scope/${sessionId}`} className="link hidden px-2 text-[14px] sm:block">
                Edit scope
              </Link>
            )}
            <button onClick={copyLink} className="btn btn-secondary btn-sm">
              {copied ? "Link copied ✓" : "Copy link"}
            </button>
            <button onClick={() => window.print()} className="btn btn-secondary btn-sm hidden sm:inline-flex">
              PDF
            </button>
            <button onClick={downloadDeck} disabled={downloading} className="btn btn-primary btn-sm">
              {downloading ? "Building…" : "Download deck"}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- hero (Cream) ---------- */}
      <header className="bg-cream">
        <div className="mx-auto max-w-page px-[18px] pb-[100px] pt-20 sm:px-8 lg:pt-28">
          <div className="animate-rise max-w-4xl">
            <h1 className="text-[40px] sm:text-[62px]">
              {c.engagement_type} for <span className="accent">{p.clientName}</span>
            </h1>
            <p className="lead mt-6 max-w-2xl">{c.tagline}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <Meta label="Prepared for" value={c.prepared_for} />
            <Meta label="Presented by" value={`${p.contact.name}, ${p.contact.title}`} />
            <Meta label={hasOptions ? "Investment range" : "Total investment"} value={lo === hi ? formatK(lo) : `${formatK(lo)}–${formatK(hi)}`} accent />
          </div>
          <p className="label mt-6 text-slate">Executive summary · {longDate}</p>
        </div>
      </header>

      {/* ---------- who we are + investment (White) ---------- */}
      <Band id="investment" tone="white">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="reveal">
            <h2 className="text-[32px] sm:text-[42px]">
              Who is <span className="accent">LeadG2?</span>
            </h2>
            <p className="lead mt-5">{WHO_WE_ARE}</p>
            <div className="bottom-line mt-8 p-6">
              <p className="label text-orange-dark">Bottom line</p>
              <p className="mt-2 text-[18px] text-navy">{c.executive_overview}</p>
            </div>
            <div className="mt-8 grid gap-[18px] sm:grid-cols-3">
              {c.stats.slice(0, 3).map((s, i) => (
                <div key={i} className="card card-rule p-5 pt-6">
                  <p className="font-sans text-[32px] font-extrabold leading-none text-orange">{s.value}</p>
                  <p className="mt-3 text-[15px] text-slate">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal self-start rounded-lg bg-midnight p-8 text-white">
            <h3 className="text-[22px] text-white">Contract and investment</h3>
            <dl className="mt-6">
              <Inv k="Contract dates" v={`${formatDate(terms.contractStart)} – ${formatDate(contractEnd(terms.contractStart, headline.termMonths))}${hasOptions ? ` (${headline.label})` : ""}`} />
              <Inv k={hasOptions ? "Total LeadG2 investment, by option" : "Total LeadG2 investment"} v={lo === hi ? formatUSD(lo) : `${formatUSD(lo)} – ${formatUSD(hi)}`} big />
              {headline.monthly > 0 && <Inv k="Monthly" v={`${formatUSD(headline.monthly, true)}/month*`} />}
              {headline.oneTime > 0 && <Inv k="One-time" v={formatUSD(headline.oneTime)} />}
              {scope.discountPct > 0 && <Inv k={scope.discountLabel || "Discount"} v={`${scope.discountPct}% off LeadG2 services, included above`} />}
              <Inv k="HubSpot investment (paid separately)" v={terms.hubspotInvestment || "To be confirmed"} />
            </dl>
            <p className="mt-6 text-[13px] text-mist">
              *Pricing subject to change after 15 days. {terms.exclusions} {hasVendorItems(scope) ? VENDOR_NOTE : ""}
            </p>
          </div>
        </div>
      </Band>

      {/* ---------- learned + results (Smoke) ---------- */}
      <Band id="learned" tone="smoke">
        <SectionHeader title="What we've" accent="learned." lead="What your team told us across calls, emails and meetings, in plain terms." />
        <div className="mt-10 grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
          {c.what_we_learned.map((w, i) => (
            <FeatureCard key={i} n={i + 1} title={w.title} body={w.detail} />
          ))}
        </div>
        <h3 className="mt-16 text-[26px]">
          Desired business <span className="accent">results</span>
        </h3>
        <div className="mt-6 grid gap-[18px] md:grid-cols-2">
          {c.desired_business_results.map((r, i) => (
            <div key={i} className="reveal flex gap-4 rounded-lg border border-line bg-white p-5">
              <span className="num text-[22px] leading-none">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="block font-sans text-[18px] font-extrabold">{r.title}</span>
                <span className="mt-1 block font-serif text-[16px] text-slate">{r.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </Band>

      {/* ---------- challenges + before/after (White) ---------- */}
      <Band tone="white">
        <SectionHeader title="Sound" accent="familiar?" lead="The gaps that are costing time and pipeline today." />
        <div className="mt-10 grid gap-[18px] md:grid-cols-2">
          {c.challenges.slice(0, 4).map((ch, i) => (
            <FeatureCard key={i} n={i + 1} title={ch.title} body={ch.description} />
          ))}
        </div>
        <div className="mt-12 grid gap-[18px] md:grid-cols-2">
          <div className="reveal rounded-lg border border-line bg-white p-7">
            <h3 className="text-[20px]">Today</h3>
            <ul className="mt-4 space-y-3">
              {c.before_after.before.slice(0, 4).map((b, i) => (
                <li key={i} className="flex gap-3 text-[16px] text-slate">
                  <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-smoke font-sans text-[12px] font-bold text-steel" aria-hidden>
                    ✕
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal rounded-lg bg-midnight p-7 text-white">
            <h3 className="text-[20px] text-white">With LeadG2</h3>
            <ul className="mt-4 space-y-3">
              {c.before_after.after.slice(0, 4).map((a, i) => (
                <li key={i} className="flex gap-3 text-[16px] text-white">
                  <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-orange font-sans text-[12px] font-bold text-white" aria-hidden>
                    ✓
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Band>

      {/* ---------- scope (Smoke) ---------- */}
      <Band id="services" tone="smoke">
        <SectionHeader title="How we'll get" accent="you there." lead="The work in three stages, then exactly what's included." />
        <div className="mt-10 grid gap-[18px] lg:grid-cols-3">
          {c.scope_phases.slice(0, 3).map((ph, i) => (
            <div key={i} className="reveal card card-rule p-7 pt-8">
              <span className="num text-[20px]">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1 text-[20px]">{ph.title}</h3>
              <p className="mt-2 text-[16px] text-slate">{ph.summary}</p>
              <ul className="mt-4 space-y-1.5">
                {ph.bullets.map((b, j) => (
                  <Bullet key={j}>{b}</Bullet>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {impl.length > 0 && (
          <div className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h3 className="text-[26px]">
                HubSpot implementation, <span className="accent">fixed price</span>
              </h3>
              <p className="font-sans text-[15px] text-slate">
                <span className="text-[18px] font-extrabold text-navy">{formatUSD(implTotal)}</span> one-time{hasOptions ? ", in every option" : ""}
              </p>
            </div>
            <div className="reveal mt-5 overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full min-w-[640px] text-left font-sans text-[15px]">
                <thead>
                  <tr className="bg-navy text-white">
                    <th className="label px-5 py-3 text-[11px]">Deliverable</th>
                    <th className="label px-5 py-3 text-[11px]">What&apos;s included</th>
                    <th className="label px-5 py-3 text-right text-[11px]">Investment</th>
                  </tr>
                </thead>
                <tbody>
                  {impl.map((li) => {
                    const inc = includesOf(li.description);
                    return (
                      <tr key={li.key} className="border-t border-line align-top">
                        <td className="px-5 py-4">
                          <span className="font-extrabold">{short(li.name)}</span>
                          {li.qty > 1 && <span className="text-slate"> × {li.qty}</span>}
                          {(note(li.name) || li.rationale) && <span className="mt-1 block font-serif text-[14.5px] text-slate">{note(li.name) || li.rationale}</span>}
                        </td>
                        <td className="px-5 py-4">
                          {inc.length ? (
                            <ul className="space-y-1">
                              {inc.slice(0, 6).map((x, i) => (
                                <Bullet key={i} small>
                                  {x}
                                </Bullet>
                              ))}
                              {inc.length > 6 && <li className="font-sans text-[13px] text-steel">+ {inc.length - 6} more</li>}
                            </ul>
                          ) : (
                            <span className="font-serif text-slate">Custom scope, fixed price</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-bold tabular-nums">
                          {formatUSD(lineTotal(li))}
                          {li.vendor && <span className="label mt-1 block text-[10px] text-orange-dark">Estimate*</span>}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-navy bg-smoke font-extrabold">
                    <td className="px-5 py-3" colSpan={2}>
                      Implementation total
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatUSD(implTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {impl.some((li) => li.vendor) && <p className="mt-3 text-[14px] text-slate">*{VENDOR_NOTE}</p>}
          </div>
        )}

        {hasRetainer && (
          <div className="mt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h3 className="text-[26px]">
                Growth retainer, <span className="accent">monthly</span>
              </h3>
              <p className="font-sans text-[15px] text-slate">
                <span className="text-[18px] font-extrabold text-navy">{formatUSD(retainerMonthly)}</span>/month{hasOptions ? ", in every option" : ""}
              </p>
            </div>
            <div className="mt-5 grid gap-[18px] lg:grid-cols-2">
              {consult && (
                <article className="reveal card card-rule p-7 pt-8">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-[20px]">{consult}</h4>
                    <span className="shrink-0 font-sans text-[17px] font-extrabold">{formatUSD(CONSULTING_MONTHLY)}/mo</span>
                  </div>
                  <p className="mt-2 text-[16px] text-slate">Strategy every other week with your Lead Consultant, with agendas, recaps and a monthly KPI update.</p>
                  {c.consulting_summary && <p className="mt-4 rounded-md bg-cream px-4 py-3 text-[16px] text-navy">{c.consulting_summary}</p>}
                  <ul className="mt-5 grid gap-1.5 sm:grid-cols-2">
                    {[...(scope.consulting?.marketing ? MARKETING_CONSULTING_INCLUDES : ["Meetings every other week with agendas and recaps"]), ...(scope.consulting?.hubspot ? HUBSPOT_CONSULTING_INCLUDES : [])]
                      .filter((x, i, arr) => arr.indexOf(x) === i)
                      .slice(0, 10)
                      .map((x, i) => (
                        <Bullet key={i} small>
                          {x}
                        </Bullet>
                      ))}
                  </ul>
                </article>
              )}
              {pts > 0 && (
                <article className="reveal card card-rule p-7 pt-8">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-[20px]">Service points</h4>
                    <span className="shrink-0 font-sans text-[17px] font-extrabold">{formatUSD(pts * POINT_PRICE)}/mo</span>
                  </div>
                  <p className="mt-2 text-[16px] text-slate">{fmtPoints(pts)} points a month for marketing, HubSpot and sales-enablement deliverables.</p>
                  {c.points_focus && <p className="mt-4 rounded-md bg-cream px-4 py-3 text-[16px] text-navy">{c.points_focus}</p>}
                </article>
              )}
              {monthlyAdds.map((li) => (
                <article key={li.key} className="reveal card card-rule p-7 pt-8">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-[20px]">{short(li.name)}</h4>
                    <span className="shrink-0 font-sans text-[17px] font-extrabold">{price(li)}</span>
                  </div>
                  {(note(li.name) || li.rationale) && <p className="mt-2 text-[16px] text-slate">{note(li.name) || li.rationale}</p>}
                  <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                    {includesOf(li.description)
                      .slice(0, 8)
                      .map((x, i) => (
                        <Bullet key={i} small>
                          {x}
                        </Bullet>
                      ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        )}
      </Band>

      {/* ---------- team (White) ---------- */}
      <Band tone="white">
        <SectionHeader title="Your dedicated" accent="LeadG2 team." lead="We work as part of your team: your expertise plus our execution." />
        <div className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {team.map((t, i) => (
            <FeatureCard key={t.id} n={i + 1} title={t.title} body={t.desc} />
          ))}
        </div>
      </Band>

      {/* ---------- options (Smoke) ---------- */}
      {hasOptions && (
        <Band id="options" tone="smoke">
          <SectionHeader title="Choose your level of" accent="support." lead={c.options_intro || "Every option gets the full build. What changes is how closely we work with you after go-live."} />
          <div className="reveal mt-8 rounded-lg border border-line bg-white px-6 py-4">
            <span className="label mr-2 text-[11px] text-orange-dark">In every option</span>
            <span className="font-serif text-[15px] text-slate">
              {[consult, ...scope.lineItems.map((l) => short(l.name))].filter(Boolean).join(" · ")}
              {pts ? ` · ${fmtPoints(pts)} service points/month` : ""}
            </span>
          </div>
          <div className="mt-[18px] grid gap-[18px] md:grid-cols-3">
            {scope.options.map((o, i) => {
              const t = totals[i];
              const rec = o.recommended;
              return (
                <div key={o.key} className={`reveal flex flex-col rounded-lg p-7 ${rec ? "bg-midnight text-white" : "border border-line bg-white"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className={`text-[24px] ${rec ? "text-white" : ""}`}>{o.name}</h3>
                    <span className={`font-sans text-[14px] font-bold ${rec ? "text-orange-light" : "text-slate"}`}>{o.termMonths} months</span>
                  </div>
                  {rec && <span className="label mt-1 text-[11px] text-orange-light">Recommended</span>}
                  <p className={`mt-3 text-[15.5px] ${rec ? "text-mist" : "text-slate"}`}>{o.tagline}</p>
                  <ul className="mt-5 flex-1 space-y-1.5">
                    {o.lineItems.map((li) => (
                      <Bullet key={li.key} small dark={rec}>
                        {short(li.name)}
                      </Bullet>
                    ))}
                  </ul>
                  <div className={`mt-6 border-t pt-4 ${rec ? "border-white/15" : "border-line"}`}>
                    <p className={`font-sans text-[32px] font-extrabold leading-none ${rec ? "text-white" : "text-navy"}`}>{formatUSD(t.total)}</p>
                    <p className={`mt-2 font-sans text-[13px] ${rec ? "text-mist" : "text-slate"}`}>
                      {t.termMonths} months total{scope.discountPct ? ` · after ${scope.discountPct}% discount` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Band>
      )}

      {/* ---------- service points (White) ---------- */}
      {pts > 0 && (
        <Band id="points" tone="white">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
            <div className="reveal">
              <h2 className="text-[32px] sm:text-[42px]">
                Service <span className="accent">points</span>
              </h2>
              <p className="lead mt-5">
                A flexible monthly allocation for the marketing, HubSpot and sales-enablement work that moves your goals. Points carry across the partnership,
                so the mix can shift as priorities change.
              </p>
              <div className="card card-rule mt-8 p-7 pt-8">
                <p className="font-sans text-[48px] font-extrabold leading-none text-orange">{fmtPoints(pts)}</p>
                <p className="mt-2 font-sans text-[17px] font-bold">points per month</p>
                <p className="mt-1 text-[15px] text-slate">
                  {formatUSD(pts * POINT_PRICE)}/month at {formatUSD(POINT_PRICE)} per point
                </p>
              </div>
            </div>
            <div className="reveal">
              <h3 className="text-[20px]">A typical month</h3>
              <div className="mt-4 overflow-hidden rounded-lg border border-line">
                <table className="w-full text-left font-sans text-[15px]">
                  <thead>
                    <tr className="bg-navy text-white">
                      <th className="label px-5 py-3 text-[11px]">Deliverable</th>
                      <th className="label px-5 py-3 text-right text-[11px]">Qty / mo</th>
                      <th className="label px-5 py-3 text-right text-[11px]">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointLines.map(({ item, qty }) => (
                      <tr key={item.id} className="border-t border-line">
                        <td className="px-5 py-3 font-bold">{item.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{fmtPoints(qty)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{fmtPoints(qty * item.points)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-navy bg-smoke font-extrabold">
                      <td className="px-5 py-3" colSpan={2}>
                        Monthly total
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtPoints(pts)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button onClick={() => setShowMenu((v) => !v)} className="link no-print mt-4 text-[15px]">
                {showMenu ? "Hide" : "View"} the full service points menu →
              </button>
            </div>
          </div>
          <div className={`mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-4 ${showMenu ? "" : "hidden"}`}>
            {POINT_CATEGORIES.map((cat) => (
              <div key={cat.key}>
                <h4 className="text-[17px]">{cat.eyebrow}</h4>
                <ul className="mt-2 divide-y divide-line">
                  {POINT_ITEMS.filter((i) => i.category === cat.key).map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 py-2 font-sans text-[14px]">
                      <span>{i.name}</span>
                      <span className="shrink-0 font-bold text-orange-dark">{i.pointsLabel.replace(" pts", "").replace(" pt", "")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Band>
      )}

      {/* ---------- investment detail (Smoke) ---------- */}
      <Band tone="smoke">
        <SectionHeader title="Where the investment" accent="goes." lead={hasOptions ? "The shared scope is the same in every option. Options differ in support and term." : "Every line, one-time and monthly, over the full term."} />
        <div className="reveal mt-10 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[640px] text-left font-sans text-[15px]">
            <thead>
              <tr className="bg-navy text-white">
                <th className="label px-5 py-3 text-[11px]">{hasOptions ? "In every option" : "Service"}</th>
                {cols.map((col) => (
                  <th key={col.key} className="label px-5 py-3 text-right text-[11px]">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consult && (
                <tr className="border-t border-line">
                  <td className="px-5 py-3">
                    <span className="font-bold">{consult}</span> <span className="text-slate">· {formatUSD(CONSULTING_MONTHLY)}/mo</span>
                  </td>
                  {cols.map((col) => (
                    <td key={col.key} className="px-5 py-3 text-right tabular-nums">
                      {formatUSD(CONSULTING_MONTHLY * col.term)}
                    </td>
                  ))}
                </tr>
              )}
              {scope.lineItems.map((li) => (
                <tr key={li.key} className="border-t border-line">
                  <td className="px-5 py-3">
                    <span className="font-bold">{short(li.name)}</span>
                    {li.billing === "monthly" && <span className="text-slate"> · {formatUSD(lineTotal(li))}/mo</span>}
                    {li.vendor && <span className="text-orange-dark"> · estimate*</span>}
                  </td>
                  {cols.map((col) => (
                    <td key={col.key} className="px-5 py-3 text-right tabular-nums">
                      {formatUSD(amount(li, col.term))}
                    </td>
                  ))}
                </tr>
              ))}
              {pts > 0 && (
                <tr className="border-t border-line">
                  <td className="px-5 py-3">
                    <span className="font-bold">Service points</span>{" "}
                    <span className="text-slate">
                      · {fmtPoints(pts)}/mo × {formatUSD(POINT_PRICE)}
                    </span>
                  </td>
                  {cols.map((col) => (
                    <td key={col.key} className="px-5 py-3 text-right tabular-nums">
                      {formatUSD(pts * POINT_PRICE * col.term)}
                    </td>
                  ))}
                </tr>
              )}
              {hasOptions && (
                <tr className="border-t border-line bg-cream">
                  <td className="px-5 py-3 font-bold">Option-specific support and services</td>
                  {scope.options.map((o) => (
                    <td key={o.key} className="px-5 py-3 text-right tabular-nums">
                      {formatUSD(o.lineItems.reduce((a, li) => a + amount(li, o.termMonths), 0))}
                    </td>
                  ))}
                </tr>
              )}
              <tr className="border-t border-line">
                <td className="px-5 py-3 font-bold">Standard</td>
                {totals.map((t) => (
                  <td key={t.label} className="px-5 py-3 text-right tabular-nums">
                    {formatUSD(t.standard)}
                  </td>
                ))}
              </tr>
              {scope.discountPct > 0 && (
                <tr className="border-t border-line">
                  <td className="px-5 py-3 font-bold">
                    {scope.discountLabel || "Discount"} ({scope.discountPct}%)
                  </td>
                  {totals.map((t) => (
                    <td key={t.label} className="px-5 py-3 text-right tabular-nums text-orange-dark">
                      –{formatUSD(t.discount)}
                    </td>
                  ))}
                </tr>
              )}
              <tr className="border-t-2 border-navy bg-smoke text-[17px] font-extrabold">
                <td className="px-5 py-4">Your investment</td>
                {totals.map((t) => (
                  <td key={t.label} className="px-5 py-4 text-right tabular-nums">
                    {formatUSD(t.total)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[14px] text-slate">
          {terms.hubspotInvestment ? `HubSpot licensing (paid separately): ${terms.hubspotInvestment}. ` : ""}
          {terms.exclusions}
          {hasVendorItems(scope) ? ` *${VENDOR_NOTE}` : ""}
        </p>
      </Band>

      {/* ---------- roadmap (White) ---------- */}
      <Band id="roadmap" tone="white">
        <SectionHeader title="How we" accent="get there." lead="A directional timeline. Visibility and adoption move first; leads and deals follow." />
        <div className={`mt-10 grid gap-[18px] md:grid-cols-2 ${c.roadmap.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {c.roadmap.slice(0, 6).map((ph, i) => (
            <div key={i} className="reveal card card-rule flex flex-col p-6 pt-7">
              <span className="font-sans text-[13px] font-bold text-slate">{ph.months}</span>
              <h3 className="mt-1 flex items-baseline gap-2 text-[20px]">
                <span className="num text-[18px] font-normal">{String(i + 1).padStart(2, "0")}</span>
                {ph.title}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {ph.activities.map((a, j) => (
                  <Bullet key={j} small>
                    {a}
                  </Bullet>
                ))}
              </ul>
              <p className="mt-auto border-t border-line pt-3 text-[15px]">
                <span className="font-sans font-bold">Milestone: </span>
                <span className="text-slate">{ph.milestone}</span>
              </p>
            </div>
          ))}
        </div>
      </Band>

      {/* ---------- open questions (Smoke) ---------- */}
      {c.open_questions.length > 0 && (
        <Band tone="smoke">
          <SectionHeader title="A few answers to" accent="finalize the scope." lead="Everything else here is based on what you've told us." />
          <div className="mt-10 grid gap-[18px] md:grid-cols-2">
            {c.open_questions.map((q, i) => (
              <FeatureCard key={i} n={i + 1} title={q.question} body={q.detail} />
            ))}
          </div>
        </Band>
      )}

      {/* ---------- closing CTA: Midnight panel, radius 22, inside a white section ---------- */}
      <section id="start" className="scroll-mt-16 bg-white">
        <div className="mx-auto max-w-page px-[18px] py-16 sm:px-8 sm:py-24">
          <div className="reveal grid gap-12 rounded-xl bg-midnight p-8 text-white sm:p-12 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="text-[32px] text-white sm:text-[42px]">
                Ready to <span className="accent text-orange-light">get started?</span>
              </h2>
              <ol className="mt-8 space-y-3">
                {path.map(([k, v], i) => (
                  <li key={k} className="flex items-baseline gap-4 border-b border-white/10 pb-3">
                    <span className="num w-7 shrink-0 text-[18px] text-orange-light">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-sans text-[17px] font-bold text-white">{k}</span>
                    <span className="ml-auto text-right font-sans text-[14px] text-mist">{v}</span>
                  </li>
                ))}
              </ol>
              {c.next_steps.length > 0 && (
                <ul className="mt-6 space-y-2">
                  {c.next_steps.map((s, i) => (
                    <li key={i} className="text-[16px] text-mist">
                      <span className="font-sans font-bold text-white">{s.title}:</span> {s.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="self-start rounded-lg border border-white/15 p-7">
              <p className="font-sans text-[13px] font-bold text-steel">Your LeadG2 contact</p>
              <p className="mt-2 font-sans text-[24px] font-extrabold text-white">{p.contact.name}</p>
              <p className="text-mist">{p.contact.title}</p>
              <dl className="mt-5 space-y-2 font-sans text-[15px]">
                {p.contact.email && <ContactRow k="Email" v={p.contact.email} href={`mailto:${p.contact.email}?subject=${encodeURIComponent(`${p.clientName} proposal`)}`} />}
                {p.contact.phone && <ContactRow k="Phone" v={p.contact.phone} href={`tel:${p.contact.phone.replace(/[^+\d]/g, "")}`} />}
                {p.contact.website && <ContactRow k="Web" v={p.contact.website} href={`https://${p.contact.website.replace(/^https?:\/\//, "")}`} />}
              </dl>
              <div className="no-print mt-7 grid gap-2">
                {p.contact.email && (
                  <a href={`mailto:${p.contact.email}?subject=${encodeURIComponent(`Let's move forward — ${p.clientName}`)}`} className="btn btn-primary">
                    Schedule the kickoff →
                  </a>
                )}
                <button onClick={downloadDeck} className="btn btn-ghost">
                  {downloading ? "Building the deck…" : "Download the deck"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-[18px] py-8 sm:px-8">
          <Logo variant="color" className="h-[22px] w-auto" />
          <span className="font-sans text-[13px] text-slate">
            Executive summary for {p.clientName} · {longDate}
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Band({ id, tone, children }: { id?: string; tone: "white" | "smoke"; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-16 ${tone === "smoke" ? "bg-smoke" : "bg-white"}`}>
      <div className="mx-auto max-w-page px-[18px] py-14 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}

/** Section header: sentence-case headline with a Lora-italic accent; lead to the right on desktop, below on mobile. No eyebrow. */
function SectionHeader({ title, accent, lead }: { title: string; accent: string; lead?: string }) {
  return (
    <div className="reveal grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-end">
      <h2 className="text-[32px] sm:text-[42px]">
        {title} <span className="accent">{accent}</span>
      </h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

/** Feature card: White, Line border, orange rule, Lora-italic number. */
function FeatureCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="reveal card card-rule p-6 pt-7">
      <span className="num text-[20px]">{String(n).padStart(2, "0")}</span>
      <h3 className="mt-1 text-[20px]">{title}</h3>
      <p className="mt-2 text-[16px] text-slate">{body}</p>
    </div>
  );
}

function Bullet({ children, small, dark }: { children: React.ReactNode; small?: boolean; dark?: boolean }) {
  return (
    <li className={`flex gap-2.5 ${small ? "text-[15px]" : "text-[16px]"} ${dark ? "text-white" : "text-navy"}`}>
      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-[1px] bg-orange" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-4">
      <p className="font-sans text-[13px] font-bold text-slate">{label}</p>
      <p className={`mt-1 font-sans font-extrabold ${accent ? "text-[26px] text-orange" : "text-[18px]"}`}>{value}</p>
    </div>
  );
}

function Inv({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="border-t border-white/10 py-4 first:border-0 first:pt-0">
      <dt className="font-sans text-[13px] font-bold text-steel">{k}</dt>
      <dd className={`mt-1 font-sans font-extrabold ${big ? "text-[30px] text-orange-light" : "text-[18px] text-white"}`}>{v}</dd>
    </div>
  );
}

function ContactRow({ k, v, href }: { k: string; v: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-steel">{k}</dt>
      <dd className="font-sans">
        <a href={href} className="text-white hover:text-orange-light">
          {v}
        </a>
      </dd>
    </div>
  );
}
