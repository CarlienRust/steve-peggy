import { redirect } from "next/navigation";
import { getNavGroup } from "@/lib/navigation";

export default function StudyDesignHubPage() {
  const group = getNavGroup("/study-design");
  const first = group?.children.find((c) => c.ready !== false && !c.disabled);
  redirect(first?.href ?? "/study-design/gap-analysis");
}
