export const FMHS_ETHICS_URL =
  "https://www.su.ac.za/en/faculties/medicine/research/ethics/health-research-ethics-office";

export const FMHS_COMMITTEES = [
  {
    id: "hrec",
    label: "HREC",
    description: "General human health research ethics review at FMHS.",
  },
  {
    id: "hrec_g",
    label: "HREC-G",
    description: "Research involving genetic or omics data — required when genetics is central.",
  },
] as const;

export const FMHS_STEPS = [
  "Complete the pre-submission checklist (protocol, consent, CVs, data management plan).",
  "Submit via the SU research ethics portal — verify the current portal URL on the official site.",
  "Do not begin primary data collection until ethics approval is granted.",
  "Check current academic year submission deadlines on the FMHS ethics website.",
];
