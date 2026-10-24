import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const SECTION_KEYS: { key: string; heading: string }[] = [
  { key: "title", heading: "Title" },
  { key: "summary", heading: "Summary" },
  { key: "background", heading: "Background" },
  { key: "methods", heading: "Methods" },
  { key: "analysis", heading: "Analysis" },
  { key: "sample_size", heading: "Sample size" },
  { key: "timeline", heading: "Timeline" },
  { key: "ethics_note", heading: "Ethics" },
];

function asString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function aimsList(body: Record<string, unknown>): string[] {
  if (!Array.isArray(body.aims)) return [];
  return body.aims.map((a) => String(a ?? "").trim()).filter(Boolean);
}

function limitationsList(body: Record<string, unknown>): string[] {
  if (!Array.isArray(body.limitations)) return [];
  return body.limitations.map((a) => String(a ?? "").trim()).filter(Boolean);
}

export function proposalToMarkdown(body: Record<string, unknown>, userNotes?: string): string {
  const full = asString(body.full_text);
  const lines: string[] = [];

  if (full) {
    lines.push(full);
    lines.push("");
  } else {
    const title = asString(body.title);
    if (title) {
      lines.push(`# ${title}`);
      lines.push("");
    }
    for (const { key, heading } of SECTION_KEYS) {
      if (key === "title") continue;
      const text = asString(body[key]);
      if (text) {
        lines.push(`## ${heading}`);
        lines.push("");
        lines.push(text);
        lines.push("");
      }
    }
    const aims = aimsList(body);
    if (aims.length) {
      lines.push("## Aims");
      lines.push("");
      for (const a of aims) lines.push(`- ${a}`);
      lines.push("");
    }
  }

  const limits = limitationsList(body);
  if (limits.length) {
    lines.push("## Limitations");
    lines.push("");
    for (const l of limits) lines.push(`- ${l}`);
    lines.push("");
  }

  if (userNotes?.trim()) {
    lines.push("## Notes");
    lines.push("");
    lines.push(userNotes.trim());
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

function paragraphFromText(text: string): Paragraph[] {
  return text.split(/\n\n+/).flatMap((block) => {
    const t = block.trim();
    if (!t) return [];
    if (t.startsWith("# ")) {
      return [new Paragraph({ text: t.slice(2).trim(), heading: HeadingLevel.HEADING_1 })];
    }
    if (t.startsWith("## ")) {
      return [new Paragraph({ text: t.slice(3).trim(), heading: HeadingLevel.HEADING_2 })];
    }
    if (t.startsWith("- ")) {
      return t
        .split("\n")
        .filter((l) => l.startsWith("- "))
        .map((l) => new Paragraph({ text: l.slice(2).trim(), bullet: { level: 0 } }));
    }
    return [new Paragraph({ children: [new TextRun(t)] })];
  });
}

export async function proposalToDocxBlob(body: Record<string, unknown>, userNotes?: string): Promise<Blob> {
  const md = proposalToMarkdown(body, userNotes);
  const children = paragraphFromText(md);
  const doc = new Document({
    sections: [{ properties: {}, children: children.length ? children : [new Paragraph("")] }],
  });
  return Packer.toBlob(doc);
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadProposalDocx(projectTitle: string, body: Record<string, unknown>, userNotes?: string) {
  const slug = projectTitle.replace(/[^\w.-]+/g, "-").slice(0, 48) || "proposal";
  const docx = await proposalToDocxBlob(body, userNotes);
  const url = URL.createObjectURL(docx);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-proposal.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
