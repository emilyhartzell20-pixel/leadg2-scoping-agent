import Link from "next/link";
import type { ProposalListItem } from "@/lib/types";

export function ProposalList({ items }: { items: ProposalListItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-steel">
        No proposals yet. Completed proposals are saved here automatically.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border border-line">
      {items.map((p, i) => (
        <Link
          key={p.id}
          href={`/p/${p.id}`}
          className={`group grid grid-cols-[1fr_auto] items-center gap-4 bg-navy px-5 py-4 transition hover:bg-navy-2 sm:grid-cols-[1fr_auto_auto] ${
            i ? "border-t border-line" : ""
          }`}
        >
          <span className="min-w-0">
            <span className="block truncate font-heading text-base font-extrabold">{p.clientName}</span>
            <span className="block truncate text-sm text-steel">{p.engagementType}</span>
          </span>
          <span className="hidden text-right sm:block">
            <span className="block font-heading font-extrabold text-orange">
              {p.totalLabel}
            </span>
            <span className="block text-xs text-steel">
              {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </span>
          <span className="text-steel transition group-hover:translate-x-1 group-hover:text-orange">→</span>
        </Link>
      ))}
    </div>
  );
}
