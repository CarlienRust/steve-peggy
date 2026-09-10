import { SectionGroupLayout } from "@/components/SectionGroupLayout";

export default function StudyDesignLayout({ children }: { children: React.ReactNode }) {
  return <SectionGroupLayout groupHref="/study-design">{children}</SectionGroupLayout>;
}
