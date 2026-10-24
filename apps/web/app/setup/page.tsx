import { redirect } from "next/navigation";

export default function SetupLandingPage() {
  redirect("/setup/checks");
}
