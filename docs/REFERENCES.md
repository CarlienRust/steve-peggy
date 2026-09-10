# Research references — grounding Peggy in evidence

Peggy is a **research assistant**, not a substitute for ethics committees, biostatisticians, or peer review. This document lists the standards and literature we use when designing features, writing prompts, and deciding what the product may claim.

**How to use this file**

| When you… | Check… |
|-----------|--------|
| Add or change a Study Design field (samples, ethics, budget, plans) | [Study design & methodology](#study-design--methodology) + [Reporting guidelines](#reporting-guidelines) |
| Change gap analysis, compare, or corpus workflows | [Evidence synthesis](#evidence-synthesis--gap-analysis) + [RAG & citations](#rag-citations--ai-limitations) |
| Change ethics guidance or PHI rules | [Research ethics](#research-ethics--data-protection) |
| Change analysis-plan AI behaviour | [Statistics & analysis plans](#statistics--analysis-plans) |
| Ship marketing or UI copy that implies certainty | [What Peggy must not claim](#what-peggy-must-not-claim) |

Update this file when a feature rests on a new standard or paper. Link the PR to the row you added in the [feature map](#feature-to-reference-map) below.

---

## Feature-to-reference map

| Peggy feature | Design intent (truth we aim for) | Primary references |
|---------------|----------------------------------|--------------------|
| **Samples** — study type, N, recruitment, inclusion/exclusion | Match design to the research question; document cohort before analysis | [Musa & Nissen 2018](#musa-nissen-2018); [Thiese 2014](#thiese-2014); [Creswell 2018](#creswell-2018) |
| **Gap analysis** | Surface understudied topics and contradictions from *ingested* literature — not exhaustive systematic review | [PRISMA 2020](#prisma-2020); [Cochrane Handbook](#cochrane-handbook) |
| **Comparison** (finding vs field) | Contrast own findings with corpus evidence; state limitations and citation gaps | [SAMPL](#sampl); [Simpson 2015](#simpson-2015) |
| **Ethics** tab + FMHS copy | Point researchers to official SU/FMHS process; never approve studies | [FMHS HREC](#fmhs-hrec); [Declaration of Helsinki](#helsinki) |
| **Methods / Analysis plans** | Encourage pre-specified plans aligned with design; covariates and methods optional but explicit | [Simpson 2015](#simpson-2015); [Discrepancy paper](#discrepancy-design-analysis); [SAMPL](#sampl) |
| **Budget** tab | Capture funding constraints that affect feasible methods — not financial audit | [KI research plan guide](#ki-research-plan) |
| **Proposal** draft | Synthesise *project context + corpus* into a short protocol-style draft for human edit | [SPIRIT](#spirit); [Creswell 2018](#creswell-2018) |
| **Ask Peggy / RAG** | Answers grounded in retrieved chunks with citations; confidence and limitations shown | [Lewis et al. 2020](#lewis-rag); [Ji et al. 2023](#ji-hallucination-survey) |
| **PHI guardrails** | Block obvious identifiers in free text; de-identified default | [HIPAA Safe Harbor concept](#phi-de-identification); [POPIA](#popia) |

---

## Study design & methodology

### FMHS / Stellenbosch

- **SU Library — Research methodology (Health Sciences)**  
  https://libguides.sun.ac.za/c.php?g=1038354&p=7533117  
  Starting point for FMHS students on design, ethics links, and methodology resources.

### Core texts

<a id="creswell-2018"></a>

- **Creswell, J.W. & Creswell, J.D. (2018).** *Research design: qualitative, quantitative, and mixed methods approaches* (5th ed.). SAGE.  
  Mixed-methods framing; useful for Proposal and Methods plan prompts.

- **Mitchell, M.L. & Jolley, J.M. (2001).** *Research design explained* (4th ed.). Harcourt.  
  Introductory design vocabulary aligned with undergraduate/postgraduate health research.

### Open-access reviews (PMC)

<a id="musa-nissen-2018"></a>

- **Musa, S.S. & Nissen, T. (2018).** Study designs: Part 1 — An overview and classification. *International Journal of Orthopaedic and Trauma Nursing*, PMC6176693. PMID [30319950](https://pubmed.ncbi.nlm.nih.gov/30319950/).  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC6176693/  
  **Use in Peggy:** Study type options (observational vs experimental; cohort, case–control, cross-sectional); classification logic for Samples.

<a id="thiese-2014"></a>

- **Thiese, M.S. (2014).** Matching research design to clinical research questions. *Indian Journal of Respiratory Care*, PMC3326852.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3326852/  
  **Use in Peggy:** Design must follow question domain (therapy, prognosis, diagnosis) — not every question suits an RCT.

- **Purna Singh, A., Vadakedath, S., & Kandi, V. (2023).** Clinical research: study designs, hypotheses, errors, sampling, ethics, informed consent. *Cureus*, PMC9898800.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC9898800/  
  **Use in Peggy:** Recruitment, inclusion/exclusion, and ethics checklist language.

- **Grimes, D.A. & Schulz, K.F. (2002).** An overview of clinical research: the lay of the land. *The Lancet*, 359(9300), 57–61.  
  Classic overview cited in Karolinska research-plan materials; good sanity check for nav ordering (design → ethics → plans).

---

## Reporting guidelines

Standard checklists define what a *complete* write-up looks like. Peggy's planners and proposal draft should **not** claim compliance unless the user verifies against the official checklist.

<a id="prisma-2020"></a>

- **PRISMA 2020** — systematic reviews and meta-analyses  
  http://www.prisma-statement.org/  
  **Peggy study types:** Systematic review, Meta-analysis.

- **PRISMA-ScR** — scoping reviews  
  https://www.equator-network.org/reporting-guidelines/prisma-scr/  
  **Peggy study type:** Scoping review.

- **CONSORT** — randomised trials  
  https://www.consort-statement.org/  
  **Peggy study type:** RCT.

- **STROBE** — observational studies (cohort, case–control, cross-sectional)  
  https://www.strobe-statement.org/  
  **Peggy study types:** Cohort study, Case-control study, Cross-sectional study.

<a id="spirit"></a>

- **SPIRIT** — protocol content for clinical trials  
  https://www.spirit-statement.org/  
  **Use in Peggy:** Proposal and Methods plan section headings.

---

## Evidence synthesis & gap analysis

<a id="cochrane-handbook"></a>

- **Cochrane Handbook for Systematic Reviews of Interventions**  
  https://training.cochrane.org/handbook  
  **Use in Peggy:** Gap analysis is a *corpus-assisted* scan, not a full Cochrane review — UI and `limitations` must say so.

- **PICO / PICo** (Population, Intervention/Interest, Comparison, Outcome)  
  Cochrane Handbook, Chapter 2.  
  **Use in Peggy:** Workspace aim + samples fields approximate PICO elements for retrieval and gap prompts.

- **Schünemann, H.J. et al. (2011).** Development of an algorithm to choose study designs for inclusion in systematic reviews. *BMJ Open*, PMC4550722.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4550722/  
  **Use in Peggy:** When gap analysis spans multiple design types, avoid forcing a single design label.

---

## Statistics & analysis plans

<a id="simpson-2015"></a>

- **Simpson, S.H. (2015).** Creating a data analysis plan: what to consider when choosing statistics for a study. *Canadian Journal of Hospital Pharmacy*, PMC4552232. PMID [26327705](https://pubmed.ncbi.nlm.nih.gov/26327705/).  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4552232/  
  **Use in Peggy:** Analysis plan tab — research question, design, and measurement level drive method choice; plan before data collection.

<a id="discrepancy-design-analysis"></a>

- **Discrepancy between statistical analysis method and study design** (2017). *Journal of Clinical and Diagnostic Research*, PMC5442496.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5442496/  
  **Use in Peggy:** Methods and analysis plans should be written together; involve a statistician early (stated in limitations, not automated).

<a id="sampl"></a>

- **Lang, T.A. & Altman, D.G. (2015).** Basic statistical reporting for articles published in biomedical journals: the SAMPL guidelines. *Medical Writing*, 24(1), 14–21.  
  https://journal.emwa.org/media/1612/sampl-guidelines.pdf  
  **Use in Peggy:** Comparison and results wording; avoid over-claiming precision.

<a id="ki-research-plan"></a>

- **Karolinska Institutet — How to make a research plan** (2023 PDF)  
  https://ki.se/media/262035/download  
  **Use in Peggy:** Budget + timeline + analysis plan belong in one coherent protocol story.

---

## Research ethics & data protection

<a id="fmhs-hrec"></a>

- **FMHS Health Research Ethics Office (Stellenbosch University)**  
  https://www.su.ac.za/en/faculties/medicine/research/ethics/health-research-ethics-office  
  **Use in Peggy:** Static ethics steps and links in `EthicsFeature`; verify deadlines on the live site.

- **South African National Health Act** — research ethics (HREC requirements).  
  Official government gazette and university policy pages.  
  **Use in Peggy:** Approval letter upload is storage only — not ethics approval.

<a id="helsinki"></a>

- **WMA Declaration of Helsinki** — ethical principles for medical research.  
  https://www.wma.net/policies-post/wma-declaration-of-helsinki-ethical-principles-for-medical-research-involving-human-subjects/  

<a id="popia"></a>

- **POPIA (South Africa)** — Protection of Personal Information Act.  
  https://popia.co.za/  
  **Use in Peggy:** DataSafetyBanner on Samples & datasets, PHI heuristics, private corpus per account.

<a id="phi-de-identification"></a>

- **De-identification (general principle)** — US HIPAA Safe Harbor is a useful pattern for field-level identifier avoidance (names, dates, MRNs). Peggy's `phi_guard` implements lightweight heuristics, not certified de-identification.

---

## RAG, citations & AI limitations

Peggy retrieves chunks and asks an LLM to answer **from those chunks**. That reduces but does not eliminate fabrication.

<a id="lewis-rag"></a>

- **Lewis, P. et al. (2020).** Retrieval-augmented generation for knowledge-intensive NLP tasks. *NeurIPS*.  
  https://arxiv.org/abs/2005.11401  
  **Use in Peggy:** Architecture rationale for corpus search + cited answers.

<a id="ji-hallucination-survey"></a>

- **Ji, Z. et al. (2023).** Survey of hallucination in natural language generation. *ACM Computing Surveys*.  
  https://doi.org/10.1145/3571730  
  **Use in Peggy:** Always surface `limitations` and `confidence`; never present AI output as verified fact.

- **NIH — Use of generative AI in NIH peer review and research** (policy notices, updated periodically).  
  https://grants.nih.gov/  
  **Use in Peggy:** Cloud LLM noted in docs/ENV; researchers must follow funder/institution rules.

---

## What Peggy must not claim

| Do not imply… | Because… | Say instead… |
|---------------|----------|--------------|
| Ethics approval granted | Only an HREC can approve | "Upload your letter" / link to FMHS |
| PRISMA-compliant review | Gap analysis is corpus-limited | "Structured gap table from your ingested literature" |
| Correct statistical method | No substitute for biostatistician | "Draft plan — review with a statistician" |
| Complete literature coverage | Corpus ≠ all PubMed | "Based on N papers in your corpus" |
| PHI-safe upload by default | Heuristics miss re-identification risk | De-identified default + confirm dialog for datasets |

---

## Backlog — references to add

| Topic | Why | Candidate source |
|-------|-----|------------------|
| Omics / HREC-G | Genetics committee routing | FMHS HREC-G guidance on SU site |
| Meta-analysis methods | Effect size, heterogeneity | Cochrane Handbook Ch. 10 |
| Scoping review methods | Charting vs synthesis | Arksey & O'Malley 2005; PRISMA-ScR |
| Sample size / power | `expectedN` field | Cohen statistical power; CONSORT sample size extension |
| FAIR research data | Dataset uploads | Wilkinson et al. 2016 FAIR Guiding Principles |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03 | Expanded from seed list; added feature map, reporting guidelines, RAG/ethics sections, and "must not claim" table. |
