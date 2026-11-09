export function starterPython(headers: string[], roles: Record<string, string>, planSteps: string[]): string {
  const cols = headers.map((h) => JSON.stringify(h)).join(", ");
  const roleLines = headers.map((h) => `# ${h}: ${roles[h] || "analysis"}`).join("\n");
  const plan = planSteps.map((s) => `# - ${s}`).join("\n");
  return `import pandas as pd\n# Column names only. Peggy does not run this.\n${roleLines}\n${plan}\ncols = [${cols}]\n# df = pd.read_csv("your-file.csv", usecols=cols)\n`;
}

export function starterR(headers: string[], roles: Record<string, string>, planSteps: string[]): string {
  const cols = headers.map((h) => `"${h.replace(/"/g, '\\"')}"`).join(", ");
  const roleLines = headers.map((h) => `# ${h}: ${roles[h] || "analysis"}`).join("\n");
  const plan = planSteps.map((s) => `# - ${s}`).join("\n");
  return `# Column names only. Peggy does not run this.\n${roleLines}\n${plan}\ncols <- c(${cols})\n# d <- read.csv("your-file.csv")[, cols]\n`;
}
