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
  /** Sidebar link — first tab in the section. */
  href: string;
  /** Hub route for section landing pages (e.g. `/validate`). */
  sectionHref: string;
  children: NavChild[];
};

export type NavItem = NavLinkItem | NavGroupItem;

export const MAIN_NAV: NavItem[] = [
  { kind: "link", num: "01", label: "Dashboard", href: "/dashboard" },
  {
    kind: "group",
    num: "02",
    label: "Validate",
    href: "/validate/gap-analysis",
    sectionHref: "/validate",
    children: [
      {
        label: "Gap analysis",
        href: "/validate/gap-analysis",
        description: "Structured view of literature gaps, contradictions, and methodological weaknesses.",
        ready: true,
      },
      {
        label: "Literature search",
        href: "/validate/literature",
        description: "PubMed and PDF literature for your project.",
        ready: true,
      },
      {
        label: "Aim and objectives",
        href: "/validate/aim",
        description: "Check project aim and objectives against ingested literature.",
        ready: true,
      },
    ],
  },
  {
    kind: "group",
    num: "03",
    label: "Study design",
    href: "/study-design/samples",
    sectionHref: "/study-design",
    children: [
      {
        label: "Samples & datasets",
        href: "/study-design/samples",
        description: "Cohort, recruitment, inclusion/exclusion, and data dictionary.",
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
        label: "Budget",
        href: "/study-design/budget",
        description: "Funding overview and spending constraints.",
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
    kind: "group",
    num: "04",
    label: "Results",
    href: "/results/findings",
    sectionHref: "/results",
    children: [
      {
        label: "Upload and summary",
        href: "/results/findings",
        description: "Upload results, summary, and objective tags in one place.",
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
  { kind: "link", num: "05", label: "Ask Peggy", href: "/chat" },
];

export type HomeNavItem = {
  num: string;
  label: string;
  href: string;
  tooltip?: string;
};

/** Main sidebar (home shell) — no active project. */
export const HOME_NAV: HomeNavItem[] = [
  { num: "01", label: "Home", href: "/", tooltip: "Welcome and quick access to your projects" },
  { num: "02", label: "Project hub", href: "/projects", tooltip: "All projects and new project wizard" },
  { num: "03", label: "Ask Peggy", href: "/ask", tooltip: "General research help; optional project for literature" },
  { num: "04", label: "Useful links", href: "/useful-links", tooltip: "Curated external tools and databases" },
];

/** Hover hints for project sidebar top-level links (keyed by href). */
export const PROJECT_NAV_TOOLTIPS: Record<string, string> = {
  "/dashboard": "Objectives, setup flow, and project overview",
  "/validate/gap-analysis": "Gap scan, literature, and aim checks",
  "/study-design/samples": "Samples, ethics, methods, analysis, and proposal",
  "/analysis-tool": "Analysis tool (coming soon)",
  "/results/findings": "Findings upload and comparison to literature",
  "/chat": "Chat grounded in this project’s papers and findings",
};

export function isHomeNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/setup");
  if (href === "/ask") return pathname === "/ask";
  if (href === "/useful-links") return pathname === "/useful-links";
  if (href === "/help") return pathname === "/help";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavChildActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.kind === "link") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return item.children.some((child) => isNavChildActive(pathname, child.href));
}

export function groupsToExpand(pathname: string): string[] {
  return MAIN_NAV.filter(
    (item): item is NavGroupItem => item.kind === "group" && isNavItemActive(pathname, item)
  ).map((item) => item.href);
}

export function getNavGroup(href: string): NavGroupItem | undefined {
  const item = MAIN_NAV.find(
    (n) => n.kind === "group" && (n.sectionHref === href || n.href === href)
  );
  return item?.kind === "group" ? item : undefined;
}

export type WorkflowShortcut = {
  label: string;
  href: string;
  ready: boolean;
};

/** Dashboard and hub shortcuts — ready routes only, fixed order. */
export function getWorkflowShortcuts(): WorkflowShortcut[] {
  const fixed: { label: string; href: string }[] = [
    { label: "Literature search", href: "/validate/literature" },
    { label: "Gap analysis", href: "/validate/gap-analysis" },
    { label: "Samples", href: "/study-design/samples" },
    { label: "Methods plan", href: "/study-design/methods-plan" },
    { label: "Proposal", href: "/study-design/proposal" },
    { label: "Upload and summary", href: "/results/findings" },
    { label: "Comparison", href: "/results/comparison" },
    { label: "Ask Peggy", href: "/chat" },
  ];
  return fixed.map((item) => {
    const child = getNavChild(item.href);
    if (child) {
      return {
        ...item,
        ready: child.child.ready !== false && !child.child.disabled,
      };
    }
    const top = MAIN_NAV.find((n) => n.kind === "link" && n.href === item.href);
    if (top?.kind === "link") {
      return { ...item, ready: !top.disabled };
    }
    return { ...item, ready: true };
  });
}

export function getNavChild(href: string): { child: NavChild; group: NavGroupItem } | undefined {
  for (const item of MAIN_NAV) {
    if (item.kind !== "group") continue;
    const child = item.children.find((c) => c.href === href || href.startsWith(`${c.href}/`));
    if (child) return { child, group: item };
  }
  return undefined;
}
