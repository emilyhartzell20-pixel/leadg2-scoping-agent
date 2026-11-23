import { POINT_ITEMS, TEAM_ROLES } from "./offerings";
import type { ScopeDraft } from "./pricing";

/** Which LeadG2 roles the client gets, derived from what's in the scope. */
export function teamFor(scope: ScopeDraft) {
  const names = [...scope.lineItems, ...scope.options.flatMap((o) => o.lineItems)].map((l) => l.name.toLowerCase()).join(" | ");
  const roles = new Set<string>(["lead"]);
  const contentPoints = Object.keys(scope.points).some((id) => {
    const c = POINT_ITEMS.find((i) => i.id === id)?.category;
    return c === "content" || c === "creation";
  });
  if (contentPoints || /content marketing|accelerator|aeo/.test(names)) roles.add("content");
  if (/website|template|maintenance/.test(names)) roles.add("web");
  if (/podcast/.test(names)) roles.add("podcast");
  if (scope.consulting?.marketing) roles.add("content");
  if (scope.consulting?.hubspot || /onboarding|foundations|discovery|audit|import|migration|integration|object|portal|admin|hub/.test(names)) roles.add("hubspot");
  roles.add("crew");
  const order = ["lead", "content", "web", "podcast", "hubspot", "crew"];
  return order.filter((r) => roles.has(r)).map((r) => ({ id: r, ...TEAM_ROLES[r] }));
}
