import Link from "next/link";
import type { ProposalListItem } from "@/lib/types";

export function ProposalList({ items }: { items: ProposalListItem[] }) {
  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-line bg-smoke px-6 py-10 text-center"><p className="text-slate">No proposals yet. Completed proposals are saved here automatically.</p></div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {items.map((p, i) => (
        <Link
          key={p.id}
          href={`/p/${p.id}`}
          className={`group grid grid-cols-[1fr_auto] items-center gap-4 bg-white px-5 py-4 transition hover:bg-smoke sm:grid-cols-[1fr_auto_auto] ${i ? "border-t border-line" : ""}`}
        >
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-extrabold text-navy">{p.clientName}</span>
            <span className="block truncate font-serif text-[15px] text-slate">{p.engagementType}</span>
          </span>
          <span className="hidden text-right sm:block">
            <span className="block font-extrabold text-navy">{p.totalLabel}</span>
            <span className="block text-xs text-slate">{new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </span>
          <span className="font-bold text-orange-dark transition group-hover:translate-x-1">→</span>
        </Link>
      ))}
    </div>
  );
}
