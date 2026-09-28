import { redirect } from "next/navigation";
import { getNavGroup } from "@/lib/navigation";

export default function ValidateHubPage() {
  const group = getNavGroup("/validate");
  const first = group?.children.find((c) => c.ready !== false && !c.disabled);
  redirect(first?.href ?? "/validate/gap-analysis");
}
