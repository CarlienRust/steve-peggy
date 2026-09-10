import { SectionGroupLayout } from "@/components/SectionGroupLayout";

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <SectionGroupLayout groupHref="/results">{children}</SectionGroupLayout>;
}
