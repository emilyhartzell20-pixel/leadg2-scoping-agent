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

  const sections = [
    ["investment", "Investment"],
    ["learned", "What we've learned"],
    ["services", "Scope"],
    ...(hasOptions ? [["options", "Options"]] : []),
    ...(pts ? [["points", "Service points"]] : []),
    ["roadmap", "Roadmap"],
    ["start", "Getting started"],
  ] as [string, string][];

  const [active, setActive] = useState<string>("investment");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);

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
    ["Edits to proposal, if needed", "Within 1 week"],
    ["Contract sent", "Following approval"],
    ["Contract signed", `By ${formatDate(terms.contractStart)}`],
    ["Contract start date", formatDate(terms.contractStart)],
    ["Kick-off call", `Week of ${formatDate(terms.contractStart)}`],
  ];

  const price = (li: LineItem) => `${formatUSD(lineTotal(li))}${li.billing === "monthly" ? "/mo" : ""}`;

  return (
    <div className="bg-midnight text-smoke">
      {/* ---------- toolbar ---------- */}
      <div className="no-print sticky top-0 z-40 border-b border-line bg-midnight/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="LeadG2 Scoping Agent">
            <Logo variant="white" className="h-5 w-auto" />
          </Link>
          <nav className="hidden flex-1 justify-center gap-1 xl:flex">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={`rounded px-3 py-1.5 text-[13px] font-semibold transition ${active === id ? "bg-navy text-orange" : "text-steel hover:text-smoke"}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {sessionId && (
              <Link href={`/scope/${sessionId}`} className="hidden rounded px-3 py-1.5 text-[13px] font-semibold text-steel hover:text-smoke sm:block">
                Edit scope
              </Link>
            )}
            <button onClick={copyLink} className="rounded border border-line px-3 py-1.5 text-[13px] font-semibold text-steel transition hover:border-steel hover:text-smoke">
              {copied ? "Link copied ✓" : "Copy link"}
            </button>
            <button onClick={() => window.print()} className="hidden rounded border border-line px-3 py-1.5 text-[13px] font-semibold text-steel transition hover:border-steel hover:text-smoke sm:block">
              PDF
            </button>
            <button onClick={downloadDeck} disabled={downloading} className="rounded bg-orange px-3 py-1.5 font-heading text-[13px] font-extrabold text-midnight transition hover:bg-orange-hover disabled:opacity-60">
              {downloading ? "Building…" : "Download PPTX"}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- cover ---------- */}
      <header className="accent-bar grid-texture relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[36%] bg-navy lg:block" style={{ clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0 100%)" }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-24 pt-20 sm:px-6 lg:grid-cols-[1.6fr_1fr] lg:pt-24">
          <div className="animate-rise">
            <p className="eyebrow">Executive Summary · {longDate}</p>
            <p className="mt-5 font-heading text-lg font-bold text-steel">LeadG2 proposed services for</p>
            <h1 className="mt-1 text-5xl leading-[0.98] sm:text-7xl">{p.clientName}</h1>
            <p className="mt-5 font-heading text-xl font-bold text-orange sm:text-2xl">{c.engagement_type}</p>
            <div className="mt-6 h-1 w-16 bg-orange" />
            <p className="mt-6 max-w-2xl text-lg text-steel">{c.tagline}</p>
          </div>
          <div className="relative animate-rise space-y-6 self-end lg:pl-12" style={{ animationDelay: "120ms" }}>
            <Meta label="Prepared for" value={c.prepared_for} />
            <Meta label="Presented by" value={`${p.contact.name}, ${p.contact.title}`} />
            <div className="border-l-2 border-orange pl-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-steel">{hasOptions ? "Investment range" : "Total investment"}</p>
              <p className="mt-1 font-heading text-4xl font-extrabold text-orange">{lo === hi ? formatK(lo) : `${formatK(lo)}–${formatK(hi)}`}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- who we are + investment ---------- */}
      <section id="investment" className="scroll-mt-14 bg-smoke text-midnight">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="reveal">
            <Eyebrow>Who we are</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl">Who is LeadG2?</h2>
            <p className="mt-4 text-lg leading-relaxed text-[#33404F]">{WHO_WE_ARE}</p>
            <p className="mt-8 border-l-4 border-orange pl-5 text-xl leading-relaxed text-midnight">{c.executive_overview}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {c.stats.slice(0, 3).map((s, i) => (
                <div key={i} className="relative overflow-hidden rounded-md bg-navy p-5 text-smoke">
                  <div className="absolute inset-x-0 top-0 h-1 bg-orange" />
                  <p className="font-heading text-3xl font-extrabold text-orange">{s.value}</p>
                  <p className="mt-2 text-sm text-smoke/85">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="reveal accent-bar relative self-start overflow-hidden rounded-lg bg-midnight p-8 pb-10 text-smoke">
            <Eyebrow>Contract & investment</Eyebrow>
            <dl className="mt-6 space-y-5">
              <Inv k="Contract dates" v={`${formatDate(terms.contractStart)} – ${formatDate(contractEnd(terms.contractStart, headline.termMonths))}${hasOptions ? ` (${headline.label})` : ""}`} />
              <Inv k={hasOptions ? "Total LeadG2 investment, by option" : "Total LeadG2 investment"} v={lo === hi ? formatUSD(lo) : `${formatUSD(lo)} – ${formatUSD(hi)}`} big />
              {headline.monthly > 0 && <Inv k="Monthly" v={`${formatUSD(headline.monthly, true)}/month*`} />}
              {headline.oneTime > 0 && <Inv k="One-time" v={formatUSD(headline.oneTime)} />}
              {scope.discountPct > 0 && <Inv k={scope.discountLabel || "Discount"} v={`${scope.discountPct}% off LeadG2 services — included above`} />}
              <Inv k="Total HubSpot investment (paid separately)" v={terms.hubspotInvestment || "To be confirmed"} />
            </dl>
            <p className="mt-6 text-xs text-steel">
              *Pricing subject to change after 15 days. {terms.exclusions} {hasVendorItems(scope) ? VENDOR_NOTE : ""}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- learned + results ---------- */}
      <section id="learned" className="scroll-mt-14 border-t border-[#E4E6E2] bg-white text-midnight">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div className="reveal">
            <Eyebrow>Where you are today</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl">What we&apos;ve learned</h2>
            <ul className="mt-8 space-y-4">
              {c.what_we_learned.map((w, i) => (
                <li key={i} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-orange font-heading text-sm font-extrabold text-white">{i + 1}</span>
                  <span>
                    <span className="block font-heading text-[17px] font-extrabold">{w.title}</span>
                    <span className="block text-[15px] text-[#4A5568]">{w.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal rounded-lg bg-smoke p-8">
            <Eyebrow>Where we&apos;re going</Eyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl">Desired business results</h2>
            <ol className="mt-8 space-y-4">
              {c.desired_business_results.map((r, i) => (
                <li key={i} className="flex gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-navy font-heading font-extrabold text-orange">{i + 1}</span>
                  <span className="pt-1">
                    <span className="block text-[17px] font-semibold">{r.title}</span>
                    <span className="block text-[15px] text-[#4A5568]">{r.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- challenges + before/after ---------- */}
      <section className="accent-bar">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Current state" title="What's holding growth back" dark />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {c.challenges.slice(0, 4).map((ch, i) => (
              <div key={i} className="reveal relative rounded-lg border border-line bg-navy p-7 pl-9">
                <span className="absolute inset-y-0 left-0 w-1 rounded-l-lg bg-orange" />
                <span className="font-heading text-sm font-extrabold text-orange">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-xl">{ch.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-steel">{ch.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 grid gap-3 md:grid-cols-[1fr_40px_1fr]">
            <p className="hidden rounded-md bg-navy-2 px-6 py-3 text-xs font-extrabold uppercase tracking-[0.2em] text-steel md:block">Before</p>
            <span className="hidden md:block" />
            <p className="hidden rounded-md bg-orange px-6 py-3 text-xs font-extrabold uppercase tracking-[0.2em] text-midnight md:block">After</p>
            {c.before_after.before.slice(0, 4).map((b, i) => (
              <div key={i} className="reveal contents">
                <p className="rounded-md border border-line px-6 py-4 text-[15px] text-steel">{b}</p>
                <span className="hidden place-items-center text-orange md:grid">→</span>
                <p className="mb-4 rounded-md border border-orange/50 bg-navy px-6 py-4 text-[15px] font-semibold md:mb-0">{c.before_after.after[i]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- scope ---------- */}
      <section id="services" className="scroll-mt-14 bg-smoke text-midnight">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Scope of work" title="How we'll get you there" />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {c.scope_phases.slice(0, 3).map((ph, i) => (
              <div key={i} className={`reveal relative rounded-lg border bg-white p-7 ${i === 2 ? "border-orange" : "border-[#DADCD8]"}`}>
                <p className="font-heading text-sm font-extrabold text-orange">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 text-xl">{ph.title}</h3>
                <p className="mt-2 text-[15px] text-[#5A6472]">{ph.summary}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {ph.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-orange" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {impl.length > 0 && (
            <div className="mt-16">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange">HubSpot implementation{hasOptions ? " · included in every option" : ""}</p>
                  <h3 className="mt-1 text-2xl">Fixed-price scope of work</h3>
                </div>
                <p className="text-sm text-steel">
                  <span className="font-heading font-extrabold text-midnight">{formatUSD(implTotal)}</span> one-time, fixed price
                </p>
              </div>
              <div className="reveal mt-5 overflow-x-auto rounded-lg border border-[#DADCD8] bg-white">
                <table className="w-full min-w-[640px] text-left text-[15px]">
                  <thead>
                    <tr className="bg-navy text-[11px] uppercase tracking-[0.16em] text-smoke">
                      <th className="px-5 py-3 font-extrabold">Deliverable</th>
                      <th className="px-5 py-3 font-extrabold">What&apos;s included</th>
                      <th className="px-5 py-3 text-right font-extrabold">Investment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impl.map((li) => {
                      const inc = includesOf(li.description);
                      return (
                        <tr key={li.key} className="border-t border-[#E4E6E2] align-top">
                          <td className="px-5 py-4">
                            <span className="font-heading font-extrabold">{li.name.replace(/^\[[^\]]+\]\s*/, "")}</span>
                            {li.qty > 1 && <span className="text-steel"> × {li.qty}</span>}
                            {(note(li.name) || li.rationale) && <span className="mt-1 block text-sm text-[#5A6472]">{note(li.name) || li.rationale}</span>}
                          </td>
                          <td className="px-5 py-4 text-sm text-[#4A5568]">
                            {inc.length ? (
                              <ul className="space-y-1">
                                {inc.slice(0, 6).map((x, i) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-orange" />
                                    {x}
                                  </li>
                                ))}
                                {inc.length > 6 && <li className="text-steel">+ {inc.length - 6} more</li>}
                              </ul>
                            ) : (
                              <span className="text-steel">Custom scope, fixed price</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold tabular-nums">
                            {formatUSD(lineTotal(li))}
                            {li.vendor && <span className="block text-[11px] font-bold uppercase tracking-wider text-orange">Estimate*</span>}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-orange font-heading font-extrabold text-white">
                      <td className="px-5 py-3" colSpan={2}>
                        Implementation total
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatUSD(implTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {impl.some((li) => li.vendor) && <p className="mt-3 text-sm text-steel">*{VENDOR_NOTE}</p>}
            </div>
          )}

          {hasRetainer && (
            <div className="mt-16">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange">Growth retainer{hasOptions ? " · included in every option" : ""}</p>
                  <h3 className="mt-1 text-2xl">Consulting + service points</h3>
                </div>
                <p className="text-sm text-steel">
                  <span className="font-heading font-extrabold text-midnight">{formatUSD(retainerMonthly)}</span>/month
                </p>
              </div>
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {consult && (
                  <article className="reveal relative overflow-hidden rounded-lg border border-[#DADCD8] bg-white p-7">
                    <div className="absolute inset-x-0 top-0 h-1 bg-orange" />
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xl">{consult}</h3>
                      <span className="shrink-0 font-heading font-extrabold text-orange">{formatUSD(CONSULTING_MONTHLY)}/mo</span>
                    </div>
                    <p className="mt-2 text-[15px] text-[#5A6472]">Bi-weekly strategy with your Lead Consultant, with agendas, recaps and a monthly KPI update.</p>
                    {c.consulting_summary && <p className="mt-4 rounded-md bg-[#FBEEE3] px-4 py-3 text-[15px] font-semibold">{c.consulting_summary}</p>}
                    <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                      {[...(scope.consulting?.marketing ? MARKETING_CONSULTING_INCLUDES : ["Meetings every other week with agendas and recaps"]), ...(scope.consulting?.hubspot ? HUBSPOT_CONSULTING_INCLUDES : [])]
                        .filter((x, i, arr) => arr.indexOf(x) === i)
                        .slice(0, 10)
                        .map((x, i) => (
                          <li key={i} className="flex gap-2.5 text-sm">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-orange" />
                            {x}
                          </li>
                        ))}
                    </ul>
                  </article>
                )}
                {pts > 0 && (
                  <article className="reveal relative overflow-hidden rounded-lg border border-orange bg-white p-7">
                    <div className="absolute inset-x-0 top-0 h-1 bg-orange" />
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xl">Service Points</h3>
                      <span className="shrink-0 font-heading font-extrabold text-orange">{formatUSD(pts * POINT_PRICE)}/mo</span>
                    </div>
                    <p className="mt-2 text-[15px] text-[#5A6472]">{fmtPoints(pts)} points per month for marketing, HubSpot and sales-enablement deliverables.</p>
                    {c.points_focus && <p className="mt-4 rounded-md bg-[#FBEEE3] px-4 py-3 text-[15px] font-semibold">{c.points_focus}</p>}
                  </article>
                )}
                {monthlyAdds.map((li) => (
                  <ServiceCard key={li.key} li={li} why={note(li.name)} price={price(li)} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-16">
            <SectionHead eyebrow="Your partners" title="You will have a dedicated LeadG2 team" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {team.map((t) => (
                <div key={t.id} className="reveal rounded-lg border border-[#DADCD8] bg-white p-6">
                  <p className="font-heading text-lg font-extrabold">{t.title}</p>
                  <p className="mt-2 text-sm text-[#5A6472]">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- partnership options ---------- */}
      {hasOptions && (
        <section id="options" className="accent-bar grid-texture scroll-mt-14">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <SectionHead eyebrow="Partnership options" title="Choose your level of support" dark />
            {c.options_intro && <p className="reveal mt-4 max-w-3xl font-serif text-lg italic text-steel">{c.options_intro}</p>}
            <div className="reveal mt-8 rounded-md border border-orange bg-navy px-6 py-4 text-sm">
              <span className="mr-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange">Included in every option</span>
              {[consult, ...scope.lineItems.map((l) => l.name.replace(/^\[[^\]]+\]\s*/, ""))].filter(Boolean).join(" · ")}
              {pts ? ` · ${fmtPoints(pts)} service points/month` : ""}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {scope.options.map((o, i) => {
                const t = totals[i];
                return (
                  <div key={o.key} className={`reveal flex flex-col rounded-lg border p-7 ${o.recommended ? "border-orange bg-navy" : "border-line bg-navy/60"}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-2xl">{o.name}</h3>
                      <span className="text-sm font-bold text-orange">{o.termMonths} months</span>
                    </div>
                    {o.recommended && <span className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange">Recommended</span>}
                    <p className="mt-3 text-sm text-steel">{o.tagline}</p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {o.lineItems.map((li) => (
                        <li key={li.key} className="flex gap-2.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-orange" />
                          <span>
                            {li.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 border-t border-line pt-4">
                      <p className="font-heading text-3xl font-extrabold text-orange">{formatUSD(t.total)}</p>
                      <p className="text-xs text-steel">
                        {t.termMonths} months total{scope.discountPct ? ` · after ${scope.discountPct}% discount` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---------- service points ---------- */}
      {pts > 0 && (
        <section id="points" className="scroll-mt-14 border-t border-[#E4E6E2] bg-white text-midnight">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
              <div className="reveal">
                <SectionHead eyebrow="Flexible resources" title="Service points" />
                <p className="mt-6 text-lg leading-relaxed text-[#33404F]">
                  We&apos;ll use a service point system to develop the marketing, HubSpot and sales-enablement resources that help your team sell smarter and faster, and drive leads to
                  your website.
                </p>
                <div className="mt-8 rounded-lg bg-midnight p-7 text-smoke">
                  <p className="font-heading text-5xl font-extrabold text-orange">{fmtPoints(pts)}</p>
                  <p className="mt-1 font-heading font-bold">points per month included in this proposal</p>
                  <p className="mt-1 text-sm text-steel">{formatUSD(pts * POINT_PRICE)}/month at {formatUSD(POINT_PRICE)} per point</p>
                </div>
              </div>
              <div className="reveal">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-steel">A typical month</p>
                <div className="overflow-hidden rounded-lg border border-[#DADCD8]">
                  <table className="w-full text-left text-[15px]">
                    <thead>
                      <tr className="bg-navy text-[11px] uppercase tracking-[0.16em] text-smoke">
                        <th className="px-5 py-3 font-extrabold">Deliverable</th>
                        <th className="px-5 py-3 text-right font-extrabold">Qty / mo</th>
                        <th className="px-5 py-3 text-right font-extrabold">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointLines.map(({ item, qty }) => (
                        <tr key={item.id} className="border-t border-[#E4E6E2] even:bg-[#FAFAF8]">
                          <td className="px-5 py-3 font-semibold">{item.name}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{fmtPoints(qty)}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{fmtPoints(qty * item.points)}</td>
                        </tr>
                      ))}
                      <tr className="bg-orange font-heading font-extrabold text-white">
                        <td className="px-5 py-3" colSpan={2}>
                          Monthly total
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{fmtPoints(pts)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-steel">Points carry across the partnership, so the mix can shift as priorities change.</p>
              </div>
            </div>
            <button onClick={() => setShowMenu((v) => !v)} className="no-print mt-10 rounded border border-[#DADCD8] px-4 py-2 text-sm font-bold text-midnight hover:border-steel">
              {showMenu ? "Hide" : "View"} the full service points menu
            </button>
            <div className={`mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4 ${showMenu ? "" : "hidden"}`}>
              {POINT_CATEGORIES.map((cat) => (
                <div key={cat.key}>
                  <p className="eyebrow mb-3">{cat.eyebrow}</p>
                  <ul className="divide-y divide-[#E4E6E2] text-sm">
                    {POINT_ITEMS.filter((i) => i.category === cat.key).map((i) => (
                      <li key={i.id} className="flex justify-between gap-3 py-2">
                        <span>{i.name}</span>
                        <span className="shrink-0 font-bold text-orange">{i.pointsLabel.replace(" pts", "").replace(" pt", "")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- investment detail ---------- */}
      <section className="border-t border-[#E4E6E2] bg-smoke text-midnight">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Investment detail" title="Where the investment goes" />
          <div className="reveal mt-10 overflow-x-auto rounded-lg border border-[#DADCD8] bg-white">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead>
                <tr className="bg-navy text-[11px] uppercase tracking-[0.16em] text-smoke">
                  <th className="px-5 py-3 font-extrabold">{hasOptions ? "In every option" : "Service"}</th>
                  {hasOptions ? (
                    scope.options.map((o) => (
                      <th key={o.key} className="px-5 py-3 text-right font-extrabold">
                        {o.name} · {o.termMonths} mo
                      </th>
                    ))
                  ) : (
                    <th className="px-5 py-3 text-right font-extrabold">Amount</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {scope.lineItems.map((li) => (
                  <tr key={li.key} className="border-t border-[#E4E6E2]">
                    <td className="px-5 py-3">
                      <span className="font-semibold">{li.name}</span>
                      {li.vendor && <span className="text-sm text-orange"> · estimate*</span>}
                      {li.billing === "monthly" && <span className="text-sm text-steel"> · {formatUSD(lineTotal(li))}/mo</span>}
                    </td>
                    {(hasOptions ? scope.options : [null]).map((o, i) => (
                      <td key={i} className="px-5 py-3 text-right tabular-nums">
                        {li.billing === "monthly" ? formatUSD(lineTotal(li) * (o?.termMonths ?? scope.termMonths)) : formatUSD(lineTotal(li))}
                      </td>
                    ))}
                  </tr>
                ))}
                {consult && (
                  <tr className="border-t border-[#E4E6E2]">
                    <td className="px-5 py-3">
                      <span className="font-semibold">{consult}</span>
                      <span className="text-sm text-steel"> · {formatUSD(CONSULTING_MONTHLY)}/mo</span>
                    </td>
                    {(hasOptions ? scope.options : [null]).map((o, i) => (
                      <td key={i} className="px-5 py-3 text-right tabular-nums">
                        {formatUSD(CONSULTING_MONTHLY * (o?.termMonths ?? scope.termMonths))}
                      </td>
                    ))}
                  </tr>
                )}
                {pts > 0 && (
                  <tr className="border-t border-[#E4E6E2]">
                    <td className="px-5 py-3">
                      <span className="font-semibold">Service points</span>
                      <span className="text-sm text-steel"> · {fmtPoints(pts)}/mo × {formatUSD(POINT_PRICE)}</span>
                    </td>
                    {(hasOptions ? scope.options : [null]).map((o, i) => (
                      <td key={i} className="px-5 py-3 text-right tabular-nums">
                        {formatUSD(pts * POINT_PRICE * (o?.termMonths ?? scope.termMonths))}
                      </td>
                    ))}
                  </tr>
                )}
                {hasOptions && (
                  <tr className="border-t border-[#E4E6E2] bg-[#FAFAF8]">
                    <td className="px-5 py-3 font-semibold">Option additions</td>
                    {scope.options.map((o) => (
                      <td key={o.key} className="px-5 py-3 text-right tabular-nums">
                        {formatUSD(o.lineItems.reduce((a, li) => a + (li.billing === "monthly" ? lineTotal(li) * o.termMonths : lineTotal(li)), 0))}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="border-t border-[#E4E6E2]">
                  <td className="px-5 py-3 font-semibold">Standard</td>
                  {totals.map((t) => (
                    <td key={t.label} className="px-5 py-3 text-right tabular-nums">
                      {formatUSD(t.standard)}
                    </td>
                  ))}
                </tr>
                {scope.discountPct > 0 && (
                  <tr className="border-t border-[#E4E6E2]">
                    <td className="px-5 py-3 font-semibold">
                      {scope.discountLabel || "Discount"} ({scope.discountPct}%)
                    </td>
                    {totals.map((t) => (
                      <td key={t.label} className="px-5 py-3 text-right tabular-nums text-orange">
                        –{formatUSD(t.discount)}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="bg-orange font-heading font-extrabold text-white">
                  <td className="px-5 py-3">Your price</td>
                  {totals.map((t) => (
                    <td key={t.label} className="px-5 py-3 text-right tabular-nums">
                      {formatUSD(t.total)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-steel">
            {terms.hubspotInvestment ? `HubSpot licensing (paid separately): ${terms.hubspotInvestment}. ` : ""}
            {terms.exclusions}
            {hasVendorItems(scope) ? ` *${VENDOR_NOTE}` : ""}
          </p>
        </div>
      </section>

      {/* ---------- roadmap ---------- */}
      <section id="roadmap" className="accent-bar scroll-mt-14">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="The plan" title="How we get there" dark />
          <div className="reveal mt-10">
            <div className="relative hidden h-2 rounded-sm bg-navy md:block">
              <div className="absolute inset-y-0 left-0 rounded-sm bg-orange transition-all duration-500" style={{ width: `${((phaseIdx + 1) / Math.max(1, c.roadmap.length)) * 100}%` }} />
            </div>
            <div className={`mt-6 grid gap-4 md:grid-cols-2 ${c.roadmap.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
              {c.roadmap.slice(0, 6).map((ph, i) => (
                <button
                  key={i}
                  onClick={() => setPhaseIdx(i)}
                  onMouseEnter={() => setPhaseIdx(i)}
                  className={`flex flex-col rounded-lg border p-6 text-left transition ${i === phaseIdx ? "border-orange bg-navy" : "border-line bg-navy/50 hover:bg-navy"}`}
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange">
                    {ph.phase} · {ph.months}
                  </span>
                  <span className="mt-2 font-heading text-xl font-extrabold">{ph.title}</span>
                  <ul className="mt-4 space-y-2 text-sm text-steel">
                    {ph.activities.map((a, j) => (
                      <li key={j} className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-steel" />
                        {a}
                      </li>
                    ))}
                  </ul>
                  <span className={`mt-auto block border-t border-line pt-4 text-sm ${i === phaseIdx ? "text-smoke" : "text-steel"}`}>
                    <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-orange">Milestone</span>
                    {ph.milestone}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- open questions ---------- */}
      {c.open_questions.length > 0 && (
        <section className="bg-white text-midnight">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <SectionHead eyebrow="Open questions" title={`${c.open_questions.length === 1 ? "One answer" : `${["", "", "Two", "Three", "Four", "Five", "Six"][c.open_questions.length] ?? c.open_questions.length} answers`} to finalize the scope`} />
            <ol className="mt-8 divide-y divide-[#E4E6E2]">
              {c.open_questions.map((q, i) => (
                <li key={i} className="reveal grid gap-2 py-5 md:grid-cols-[60px_1fr_1.2fr]">
                  <span className="font-heading text-xl font-extrabold text-orange">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-heading text-[17px] font-extrabold">{q.question}</span>
                  <span className="text-[15px] text-[#4A5568]">{q.detail}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ---------- getting started ---------- */}
      <section id="start" className="accent-bar grid-texture scroll-mt-14">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionHead eyebrow="Next steps" title="Our critical path to getting started" dark />
            <ol className="mt-10 space-y-3">
              {path.map(([k, v], i) => (
                <li key={k} className="reveal flex items-center gap-5 rounded-md border border-line bg-navy/60 px-5 py-4">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md font-heading font-extrabold ${i === 0 ? "bg-orange text-midnight" : "bg-navy-2 text-smoke"}`}>{i + 1}</span>
                  <span className="font-heading text-lg font-extrabold">{k}</span>
                  <span className="ml-auto text-right text-sm text-steel">{v}</span>
                </li>
              ))}
            </ol>
            {c.next_steps.length > 0 && (
              <ul className="mt-8 space-y-3 text-[15px] text-steel">
                {c.next_steps.map((s, i) => (
                  <li key={i}>
                    <span className="font-semibold text-smoke">{s.title}:</span> {s.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="reveal self-start rounded-lg border border-line bg-navy p-8">
            <div className="-mx-8 -mt-8 mb-6 h-1 rounded-t-lg bg-orange" />
            <p className="eyebrow">Your LeadG2 contact</p>
            <p className="mt-3 font-heading text-2xl font-extrabold">{p.contact.name}</p>
            <p className="text-steel">{p.contact.title}</p>
            <dl className="mt-6 divide-y divide-line border-t border-line text-[15px]">
              {p.contact.email && <ContactRow k="Email" v={p.contact.email} href={`mailto:${p.contact.email}?subject=${encodeURIComponent(`${p.clientName} proposal`)}`} />}
              {p.contact.phone && <ContactRow k="Phone" v={p.contact.phone} href={`tel:${p.contact.phone.replace(/[^+\d]/g, "")}`} />}
              {p.contact.website && <ContactRow k="Web" v={p.contact.website} href={`https://${p.contact.website.replace(/^https?:\/\//, "")}`} />}
            </dl>
            <div className="no-print mt-7 grid gap-2">
              {p.contact.email && (
                <a href={`mailto:${p.contact.email}?subject=${encodeURIComponent(`Let's move forward — ${p.clientName}`)}`} className="rounded bg-orange px-5 py-3 text-center font-heading text-sm font-extrabold text-midnight hover:bg-orange-hover">
                  Approve & schedule kickoff
                </a>
              )}
              <button onClick={downloadDeck} className="rounded border border-line px-5 py-3 font-heading text-sm font-extrabold transition hover:border-steel">
                {downloading ? "Building deck…" : "Download the deck (PPTX)"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-line px-4 py-8 text-xs text-steel sm:px-6">
        <Logo variant="white" className="h-4 w-auto" />
        <span>· Executive summary for {p.clientName} · {longDate}</span>
      </footer>
    </div>
  );
}

function ServiceCard({ li, why, price }: { li: LineItem; why?: string; price: string }) {
  const inc = includesOf(li.description).slice(0, 10);
  return (
    <article className="reveal relative overflow-hidden rounded-lg border border-[#DADCD8] bg-white p-7">
      <div className="absolute inset-x-0 top-0 h-1 bg-orange" />
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-xl">
          {li.name.replace(/^\[[^\]]+\]\s*/, "")}
          {li.qty > 1 && <span className="text-steel"> × {li.qty}</span>}
        </h3>
        <span className="shrink-0 font-heading font-extrabold text-orange">{price}</span>
      </div>
      {(why || li.rationale) && <p className="mt-4 rounded-md bg-[#FBEEE3] px-4 py-3 text-[15px] font-semibold">{why || li.rationale}</p>}
      {inc.length > 0 && (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {inc.map((x, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-orange" />
              {x}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-1 w-8 bg-orange" />
      <span className="eyebrow">{children}</span>
    </div>
  );
}

function SectionHead({ eyebrow, title, dark }: { eyebrow: string; title: string; dark?: boolean }) {
  return (
    <div className="reveal">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={`mt-3 text-3xl sm:text-5xl ${dark ? "text-smoke" : "text-midnight"}`}>{title}</h2>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-line pl-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-steel">{label}</p>
      <p className="mt-1 font-heading text-lg font-extrabold">{value}</p>
    </div>
  );
}

function Inv({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="border-t border-line pt-4 first:border-0 first:pt-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-steel">{k}</dt>
      <dd className={`mt-1 font-heading font-extrabold ${big ? "text-3xl text-orange" : "text-lg"}`}>{v}</dd>
    </div>
  );
}

function ContactRow({ k, v, href }: { k: string; v: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-steel">{k}</dt>
      <dd>
        <a href={href} className="hover:text-orange">
          {v}
        </a>
      </dd>
    </div>
  );
}
