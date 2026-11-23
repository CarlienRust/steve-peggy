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
  { kind: "link", num: "02", label: "Project admin", href: "/project-admin" },
  {
    kind: "group",
    num: "03",
    label: "Validate",
    href: "/validate/gap-analysis",
    sectionHref: "/validate",
    children: [
      {
        label: "Gap analysis",
        href: "/validate/gap-analysis",
        description: "Gaps, contradictions, and weak methods in the literature.",
        ready: true,
      },
      {
        label: "Literature search",
        href: "/validate/literature",
        description: "PubMed and PDFs for this project.",
        ready: true,
      },
      {
        label: "Validate datasets",
        href: "/validate/datasets",
        description: "Check tables for format and analysis readiness.",
        ready: true,
      },
      {
        label: "Aim and objectives",
        href: "/validate/aim",
        description: "Aim and objectives vs ingested literature.",
        ready: true,
      },
    ],
  },
  {
    kind: "group",
    num: "04",
    label: "Study design",
    href: "/study-design/samples",
    sectionHref: "/study-design",
    children: [
      {
        label: "Samples & datasets",
        href: "/study-design/samples",
        description: "Cohort, recruitment, criteria, dictionary.",
        ready: true,
      },
      {
        label: "Ethics",
        href: "/study-design/ethics",
        description: "IRB, consent, recruitment.",
        ready: true,
      },
      {
        label: "Methods plan",
        href: "/study-design/methods-plan",
        description: "Methods, analysis, then review.",
        ready: true,
      },
      {
        label: "Budget",
        href: "/study-design/budget",
        description: "Funding and constraints.",
        ready: true,
      },
      {
        label: "Proposal",
        href: "/study-design/proposal",
        description: "One- to two-page draft from this project.",
        ready: true,
      },
    ],
  },
  { kind: "link", num: "05", label: "Analysis tool", href: "/analysis-tool" },
  {
    kind: "group",
    num: "06",
    label: "Results",
    href: "/results/findings",
    sectionHref: "/results",
    children: [
      {
        label: "Upload and summary",
        href: "/results/findings",
        description: "Results, summary, objective tags.",
        ready: true,
      },
      {
        label: "Comparison",
        href: "/results/comparison",
        description: "Your finding vs the literature.",
        ready: true,
      },
    ],
  },
  {
    kind: "link",
    num: "07",
    label: "Outputs",
    href: "/outputs",
  },
  { kind: "link", num: "08", label: "Lab book", href: "/lab-book" },
  { kind: "link", num: "09", label: "Ask Peggy", href: "/chat" },
];

export type HomeNavItem = {
  num: string;
  label: string;
  href: string;
  tooltip?: string;
};

/** Main sidebar (home shell) — no active project. */
export const HOME_NAV: HomeNavItem[] = [
  { num: "01", label: "Home", href: "/", tooltip: "Overview" },
  { num: "02", label: "Project hub", href: "/projects", tooltip: "All projects" },
  { num: "03", label: "Calendar", href: "/calendar", tooltip: "Dates" },
  { num: "04", label: "Reading journal", href: "/reading-journal", tooltip: "To-read list" },
  { num: "05", label: "Ask Peggy", href: "/ask", tooltip: "General chat" },
  { num: "06", label: "Useful links", href: "/useful-links", tooltip: "External tools" },
];

/** Hover hints for project sidebar top-level links (keyed by href). */
export const PROJECT_NAV_TOOLTIPS: Record<string, string> = {
  "/dashboard": "Overview",
  "/project-admin": "Admin files and dates",
  "/validate/gap-analysis": "Validate",
  "/study-design/samples": "Study design",
  "/analysis-tool": "Local analysis",
  "/results/findings": "Findings",
  "/outputs": "Figures and tables",
  "/lab-book": "Lab notes",
  "/chat": "Project chat",
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
