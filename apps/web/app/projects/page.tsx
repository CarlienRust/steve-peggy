import { redirect } from "next/navigation";

/** Legacy URL — project hub now lives at `/`. */
export default function ProjectsRedirectPage() {
  redirect("/");
}
