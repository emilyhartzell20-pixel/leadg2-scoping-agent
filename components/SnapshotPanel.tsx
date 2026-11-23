import type { HubSpotSnapshot } from "@/lib/types";
import { formatUSD } from "@/lib/types";

export function SnapshotPanel({ s, sources = [] }: { s: HubSpotSnapshot; sources?: { name: string; kind: string }[] }) {
  const counts = (["call", "email", "meeting", "note", "task"] as const).map((t) => [t, s.engagements.filter((e) => e.type === t).length] as const);
  const transcripts = s.engagements.filter((e) => e.body?.includes("FULL TRANSCRIPT:")).length;
  const c = s.company;
  const pipeline = s.deals.reduce((a, d) => a + (d.amount ?? 0), 0);
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

  return (
    <aside className="space-y-6 p-5 sm:p-6">
      <div>
        <p className="label text-slate">{s.source === "hubspot" ? "HubSpot snapshot" : "Manual scope"}</p>
        <h2 className="mt-2 text-2xl leading-tight">{c.name}</h2>
        <p className="mt-1 text-sm text-slate">
          {[c.domain, c.industry?.replace(/_/g, " ").toLowerCase(), [c.city, c.state].filter(Boolean).join(", ")]
            .filter(Boolean)
            .join("  ·  ") || "No CRM details"}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate">What the agent read</h3>
        <div className="flex flex-wrap gap-1.5">
          {counts
            .filter(([, c]) => c > 0)
            .map(([t, c]) => (
              <span key={t} className="rounded-sm bg-smoke px-2 py-1 text-xs font-semibold">
                <span className="text-orange-dark">{c}</span> {t}
                {c === 1 ? "" : "s"}
              </span>
            ))}
          {transcripts > 0 && (
            <span className="rounded-sm bg-smoke px-2 py-1 text-xs font-semibold">
              <span className="text-orange-dark">{transcripts}</span> full transcript{transcripts === 1 ? "" : "s"}
            </span>
          )}
          {sources.map((src) => (
            <span key={src.name} className="max-w-full truncate rounded-sm bg-smoke px-2 py-1 text-xs font-semibold" title={src.name}>
              <span className="text-orange-dark">{src.kind}</span> {src.name}
            </span>
          ))}
          {!s.engagements.length && !sources.length && <span className="text-xs text-slate">CRM fields only</span>}
        </div>
      </div>

      {s.source === "hubspot" && (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
            <Stat label="Contacts" value={String(s.contacts.length)} />
            <Stat label="Deals" value={String(s.deals.length)} />
            <Stat label="Pipeline" value={pipeline ? formatUSD(pipeline) : "—"} />
            <Stat label="Employees" value={c.employees ?? "—"} />
            <Stat label="Email open rate" value={s.emailStats.delivered ? `${s.emailStats.openRate}%` : "—"} accent />
            <Stat label="Click rate" value={s.emailStats.delivered ? `${s.emailStats.clickRate}%` : "—"} accent />
          </div>

          {s.deals.length > 0 && (
            <Section title="Deals">
              {s.deals.slice(0, 5).map((d) => (
                <Row key={d.id} primary={d.name} secondary={`${d.stage ?? "—"} · close ${fmtDate(d.closeDate)}`} right={d.amount ? formatUSD(d.amount) : ""} />
              ))}
            </Section>
          )}

          {s.contacts.length > 0 && (
            <Section title="Key contacts">
              {s.contacts.slice(0, 6).map((ct) => (
                <Row
                  key={ct.id}
                  primary={ct.name}
                  secondary={ct.title ?? ct.email ?? ""}
                  right={ct.emailsDelivered ? `${ct.emailsOpened}/${ct.emailsDelivered} opens` : ""}
                />
              ))}
            </Section>
          )}

          {s.engagements.length > 0 && (
            <Section title="Recent activity">
              {s.engagements.slice(0, 6).map((e) => (
                <div key={e.id} className="flex gap-3 py-2">
                  <span className="mt-0.5 h-fit rounded-sm bg-smoke px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-dark">
                    {e.type}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{e.title || e.body?.slice(0, 60) || "(no subject)"}</span>
                    <span className="block text-xs text-slate">{fmtDate(e.date)}</span>
                  </span>
                </div>
              ))}
            </Section>
          )}
        </>
      )}

      {s.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-slate">
          {s.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white px-4 py-3">
      <span className={`block text-lg font-extrabold ${accent ? "text-orange-dark" : ""}`}>{value}</span>
      <span className="block text-[11px] uppercase tracking-wider text-slate">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-slate">{title}</h3>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function Row({ primary, secondary, right }: { primary: string; secondary: string; right?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{primary}</span>
        <span className="block truncate text-xs text-slate">{secondary}</span>
      </span>
      {right && <span className="shrink-0 text-xs font-semibold text-navy">{right}</span>}
    </div>
  );
}
