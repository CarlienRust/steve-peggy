import type { StudyDesignData, StudyDesignPlan, StudyDesignSamples } from "@/lib/studyDesign";

export type ProjectContextSection = "samples" | "methods" | "analysis" | "findings" | "datasets";

export function formatSamplesSection(samples?: StudyDesignSamples): string {
  if (!samples || Object.keys(samples).length === 0) return "";
  const lines: string[] = ["## Samples & datasets"];
  if (samples.studyType) lines.push(`Study type: ${samples.studyType}`);
  if (samples.expectedN) lines.push(`Expected N: ${samples.expectedN}`);
  if (samples.dataTypes?.length) lines.push(`Data types: ${samples.dataTypes.join(", ")}`);
  if (samples.collectionStatus) lines.push(`Collection status: ${samples.collectionStatus}`);
  if (samples.identifierLevel) lines.push(`Identifier level: ${samples.identifierLevel}`);
  if (samples.summary && samples.identifierLevel !== "identifiable") {
    lines.push(`Summary: ${samples.summary}`);
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

function formatPlanSection(plan: StudyDesignPlan | undefined, heading: string): string {
  if (!plan) return "";
  const lines: string[] = [`## ${heading}`];
  if (plan.userPlan?.trim()) lines.push(plan.userPlan.trim());
  if (plan.budget?.trim()) lines.push(`Budget: ${plan.budget.trim()}`);
  const tools = plan.preferredTools ?? plan.constraints;
  if (tools?.trim()) lines.push(`Tools: ${tools.trim()}`);
  if (plan.lastResult && typeof plan.lastResult === "object") {
    lines.push(`Last AI result: ${JSON.stringify(plan.lastResult).slice(0, 1500)}`);
  }
  return lines.length > 1 ? lines.join("\n\n") : "";
}

export function formatMethodsSection(studyDesign: StudyDesignData): string {
  return formatPlanSection(studyDesign.methodsPlan, "Methods plan");
}

export function formatAnalysisSection(studyDesign: StudyDesignData): string {
  return formatPlanSection(studyDesign.analysisPlan, "Analysis plan");
}

export function formatStudyDesignSections(
  studyDesign: StudyDesignData,
  sections: ProjectContextSection[]
): string {
  const blocks: string[] = [];
  if (sections.includes("samples")) {
    const s = formatSamplesSection(studyDesign.samples);
    if (s) blocks.push(s);
  }
  if (sections.includes("methods")) {
    const m = formatMethodsSection(studyDesign);
    if (m) blocks.push(m);
  }
  if (sections.includes("analysis")) {
    const a = formatAnalysisSection(studyDesign);
    if (a) blocks.push(a);
  }
  return blocks.join("\n\n---\n\n");
}
