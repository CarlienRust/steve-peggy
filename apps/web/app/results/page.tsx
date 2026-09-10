import { redirect } from "next/navigation";
import { getNavGroup } from "@/lib/navigation";

export default function ResultsHubPage() {
  const group = getNavGroup("/results");
  const first = group?.children.find((c) => c.ready !== false && !c.disabled);
  redirect(first?.href ?? "/results/findings");
}
