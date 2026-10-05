import { redirect } from "next/navigation";

/** Legacy route — merged into /results/findings */
export default function ReportFindingsPage() {
  redirect("/results/findings");
}
