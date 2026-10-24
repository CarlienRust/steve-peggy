export type UsefulLink = {
  label: string;
  href: string;
  description?: string;
};

export type UsefulLinkGroup = {
  id: string;
  title: string;
  links: UsefulLink[];
};

/** Curated external resources (main sidebar — no project context). */
export const USEFUL_LINK_GROUPS: UsefulLinkGroup[] = [
  {
    id: "publication",
    title: "Publication & discovery",
    links: [
      { label: "Elsevier", href: "https://www.elsevier.com", description: "Publisher and ScienceDirect" },
      { label: "Wiley Online Library", href: "https://onlinelibrary.wiley.com", description: "Journals and books" },
      { label: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov", description: "Biomedical literature search" },
      { label: "NCBI", href: "https://www.ncbi.nlm.nih.gov", description: "Genetics and molecular biology resources" },
      { label: "DOAJ", href: "https://doaj.org", description: "Directory of Open Access Journals" },
    ],
  },
  {
    id: "referencing",
    title: "Referencing & identity",
    links: [
      { label: "Zotero", href: "https://www.zotero.org", description: "Reference management" },
      { label: "Mendeley", href: "https://www.mendeley.com", description: "Reference management" },
      { label: "ORCID", href: "https://orcid.org", description: "Researcher identifier" },
    ],
  },
  {
    id: "design-tools",
    title: "Figures & design",
    links: [
      { label: "Canva", href: "https://www.canva.com", description: "Graphics and presentations" },
      { label: "BioRender", href: "https://www.biorender.com", description: "Scientific illustrations" },
      { label: "Figma", href: "https://www.figma.com", description: "UI and diagram design" },
      { label: "GraphPad", href: "https://www.graphpad.com", description: "GraphPad Prism statistics and plotting" },
    ],
  },
  {
    id: "statistics",
    title: "Statistics & methods",
    links: [
      {
        label: "NIH research methods",
        href: "https://researchmethodsresources.nih.gov",
        description: "Methods resources from NIH",
      },
      { label: "IBM SPSS Statistics", href: "https://www.ibm.com/products/spss-statistics", description: "Statistical software" },
      { label: "CRAN", href: "https://cran.r-project.org", description: "R packages" },
      { label: "The R Project", href: "https://www.r-project.org", description: "R language for statistics" },
    ],
  },
];

/** Flat list (e.g. tests or exports). */
export const USEFUL_SCIENCE_LINKS: UsefulLink[] = USEFUL_LINK_GROUPS.flatMap((g) => g.links);
