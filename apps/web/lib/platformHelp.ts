export type HelpSection = {
  id: string;
  title: string;
  items: { heading: string; body: string }[];
};

export const PLATFORM_HELP_SECTIONS: HelpSection[] = [
  {
    id: "start",
    title: "Getting started",
    items: [
      { heading: "Create a project", body: "Home or Project hub → New project." },
      { heading: "Open a project", body: "Open a card on Home or Project hub." },
      { heading: "Switch project", body: "Sidebar footer → Switch project." },
    ],
  },
  {
    id: "nav",
    title: "Sidebars",
    items: [
      { heading: "Home", body: "Projects, calendar, reading journal, general Ask Peggy." },
      { heading: "Project", body: "Dashboard, Validate, Study design, Results, project Ask Peggy." },
    ],
  },
  {
    id: "validate",
    title: "Validate",
    items: [
      { heading: "Literature", body: "PDFs or PubMed, then extract fields." },
      { heading: "Aim and objectives", body: "Edit, save, then check against literature." },
      { heading: "Gap analysis", body: "Scan coverage in ingested papers." },
      { heading: "Validate datasets", body: "Same de-identified files as Samples. Column names and summaries only." },
    ],
  },
  {
    id: "design",
    title: "Study design and results",
    items: [
      { heading: "Plans and ethics", body: "Save each section. Bottom Save writes plan text and steps." },
      { heading: "Findings", body: "Upload under Results. Tag objectives. Compare when ready." },
    ],
  },
  {
    id: "peggy",
    title: "Ask Peggy",
    items: [
      { heading: "Side panel", body: "Chat icon (mobile) or floating button (desktop)." },
      { heading: "Context", body: "Home: optional project. Inside a project: that corpus." },
    ],
  },
  {
    id: "settings",
    title: "Profile and setup",
    items: [
      { heading: "Profile menu", body: "Name in the sidebar footer: profile, Peggy AI settings, Help." },
      { heading: "Export", body: "Dashboard title → edit. Proposal export is on the Proposal tab." },
    ],
  },
];
