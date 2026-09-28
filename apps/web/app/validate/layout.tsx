import { SectionGroupLayout } from "@/components/SectionGroupLayout";

export default function ValidateLayout({ children }: { children: React.ReactNode }) {
  return <SectionGroupLayout groupHref="/validate">{children}</SectionGroupLayout>;
}
