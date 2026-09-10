export type NavChild = {
  label: string;
  href: string;
  description: string;
  ready?: boolean;
  disabled?: boolean;
};

export type NavLinkItem = {
  kind: "link";
  num: string;
  label: string;
  href: string;
  disabled?: boolean;
};

export type NavGroupItem = {
  kind: "group";
  num: string;
  label: string;
  href: string;
  children: NavChild[];
};

export type NavItem = NavLinkItem | NavGroupItem;

export const MAIN_NAV: NavItem[] = [
  { kind: "link", num: "01", label: "Dashboard", href: "/dashboard" },
  { kind: "link", num: "02", label: "Corpus", href: "/ingest" },
  {
    kind: "group",
    num: "03",
    label: "Study Design",
    href: "/study-design",
    children: [
      {
        label: "Gap analysis",
        href: "/study-design/gap-analysis",
        description: "Structured view of literature gaps, contradictions, and methodological weaknesses.",
        ready: true,
      },
      {
        label: "Samples & datasets",
        href: "/study-design/samples",
        description: "Cohort definition, sample size, inclusion criteria, and data dictionary.",
        ready: true,
      },
      {
        label: "Ethics",
        href: "/study-design/ethics",
        description: "IRB, consent, and recruitment considerations.",
        ready: true,
      },
      {
        label: "Methods plan",
        href: "/study-design/methods-plan",
        description: "Prospective study design, endpoints, and procedures.",
        ready: true,
      },
      {
        label: "Analysis plan",
        href: "/study-design/analysis-plan",
        description: "Pre-specified statistics, power, and analysis pipeline.",
        ready: true,
      },
      {
        label: "Proposal",
        href: "/study-design/proposal",
        description: "Generate a one–two page study or grant proposal from your project context.",
        ready: true,
      },
    ],
  },
  {
    kind: "link",
    num: "04",
    label: "Analysis tool",
    href: "/analysis-tool",
    disabled: true,
  },
  {
    kind: "group",
    num: "05",
    label: "Results",
    href: "/results",
    children: [
      {
        label: "Methods",
        href: "/results/methods",
        description: "Retrospective methods write-up for manuscripts or reports.",
        ready: false,
      },
      {
        label: "Our findings",
        href: "/results/findings",
        description: "Upload cohort results, internal analyses, and narrative summaries.",
        ready: true,
      },
      {
        label: "Comparison",
        href: "/results/comparison",
        description: "Your finding against ingested literature — agreement and discrepancies.",
        ready: true,
      },
    ],
  },
  { kind: "link", num: "06", label: "Ask Peggy", href: "/chat" },
];

export function isNavChildActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.kind === "link") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function groupsToExpand(pathname: string): string[] {
  return MAIN_NAV.filter(
    (item): item is NavGroupItem =>
      item.kind === "group" && (pathname === item.href || pathname.startsWith(`${item.href}/`))
  ).map((item) => item.href);
}

export function getNavGroup(href: string): NavGroupItem | undefined {
  const item = MAIN_NAV.find((n) => n.kind === "group" && n.href === href);
  return item?.kind === "group" ? item : undefined;
}

export function getNavChild(href: string): { child: NavChild; group: NavGroupItem } | undefined {
  for (const item of MAIN_NAV) {
    if (item.kind !== "group") continue;
    const child = item.children.find((c) => c.href === href || href.startsWith(`${c.href}/`));
    if (child) return { child, group: item };
  }
  return undefined;
}
