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
      {
        heading: "Create a project",
        body: "Use + New project on Home or Project hub, or open the four-step wizard from Project hub. Each project has its own papers, findings, and plans.",
      },
      {
        heading: "Open a project",
        body: "Click a project card on Home or Project hub. Peggy remembers your last opened project when you return.",
      },
      {
        heading: "Switch project",
        body: "Inside a project, use Switch project at the bottom of the sidebar to return to Home without losing other projects.",
      },
    ],
  },
  {
    id: "nav",
    title: "Two sidebars",
    items: [
      {
        heading: "Home sidebar",
        body: "Home, Project hub, Ask Peggy (general help), and Useful links apply before you open a project. Setup checks and the new-project wizard use this sidebar too.",
      },
      {
        heading: "Project sidebar",
        body: "Dashboard, Validate, Study design, Results, and Ask Peggy (project chat) appear after you open a project. Tabs inside each section hold the detailed steps.",
      },
    ],
  },
  {
    id: "validate",
    title: "Validate",
    items: [
      {
        heading: "Literature",
        body: "Add PDFs or search PubMed, then run extraction on a paper to pull structured fields into your corpus.",
      },
      {
        heading: "Aim and objectives",
        body: "Edit aim and objectives separately, save each section, then run Check against literature when your corpus is ready.",
      },
      {
        heading: "Gap analysis",
        body: "Scan coverage across your ingested papers and note gaps before you lock your design.",
      },
    ],
  },
  {
    id: "design",
    title: "Study design and results",
    items: [
      {
        heading: "Plans and ethics",
        body: "Samples, ethics, methods, and analysis plans save per section. Fields under From your project can save on their own; use the bottom Save for plan text and steps.",
      },
      {
        heading: "Findings and comparison",
        body: "Upload or paste your findings under Results, tag objectives, and compare a finding to the literature when you are ready.",
      },
    ],
  },
  {
    id: "peggy",
    title: "Ask Peggy",
    items: [
      {
        heading: "Chat bubble",
        body: "The chat icon on mobile or the floating button on desktop opens a side panel without leaving your page.",
      },
      {
        heading: "General vs project chat",
        body: "From Home, Ask Peggy can answer methods questions or use an optional project picker for literature context. Inside a project, Ask Peggy uses that project’s corpus.",
      },
    ],
  },
  {
    id: "settings",
    title: "Profile and setup",
    items: [
      {
        heading: "Profile menu",
        body: "Update profile, Settings (system checks for API, LLM, and Qdrant), and Help live under your name at the bottom of the sidebar.",
      },
      {
        heading: "Export",
        body: "Project JSON export lives in Project details (edit icon next to the title on the dashboard). Proposal export is on the Proposal tab after you generate a draft.",
      },
    ],
  },
];
