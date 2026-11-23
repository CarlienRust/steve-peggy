function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 255;
  b[1] = (n >>> 8) & 255;
  b[2] = (n >>> 16) & 255;
  b[3] = (n >>> 24) & 255;
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text.replace(/\n/g, "\r\n"));
}

/** Store-only ZIP (no compression). */
export function buildZip(files: { name: string; content: string }[]): Blob {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const data = encode(file.content);
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  const bytes = concat([...locals, centralDir, end]);
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return new Blob([ab], { type: "application/zip" });
}

export const PROJECT_GITIGNORE = `# Peggy project template — do not commit participant-level files
*.fastq
*.fastq.gz
*.fq
*.fq.gz
*.bam
*.cram
*.vcf
*.vcf.gz
*.bed
*.bim
*.fam
*.pgen
*.sav
*.zsav
data/*.csv
data/*.tsv
!data/README.md
`;

export const PROJECT_README = `# Analysis project (Peggy template)

Keep class C tables on this machine or institutional storage. Do not push them to GitHub.

- \`scripts/\` — generated analysis scripts (column names only)
- \`results/\` — class D JSON from \`export_for_peggy()\`
- \`config/config.yml\` — local paths

Pre-commit: refuse \`*.fastq\`, \`*.bam\`, \`*.vcf\`, \`*.sav\`, and \`data/*.csv\`.
`;

export function analysisProjectFiles(scripts: Record<string, string>): { name: string; content: string }[] {
  return [
    { name: "README.md", content: PROJECT_README },
    { name: ".gitignore", content: PROJECT_GITIGNORE },
    { name: "environment.yml", content: "name: peggy-analysis\\ndependencies:\\n  - python>=3.11\\n  - pandas\\n  - statsmodels\\n" },
    { name: "renv.lock", content: "{}" },
    { name: "config/config.yml", content: "data_path: data/your-file.csv\\n" },
    { name: "data/README.md", content: "Put local tables here. They are gitignored.\\n" },
    { name: "results/.gitkeep", content: "" },
    ...Object.entries(scripts).map(([name, content]) => ({ name, content })),
  ];
}
