export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type SourceCitation = {
  chunk_id: string;
  title: string;
  authors: string;
  year: string;
  excerpt: string;
  relevance_score: number;
  source_type: string;
  pmid?: string | null;
};

export type ChatResponse = {
  response: string;
  sources: SourceCitation[];
  confidence: string;
  limitations: string[];
};

export type WorkflowResponse = {
  body: Record<string, unknown>;
  sources: SourceCitation[];
  confidence: string;
  limitations: string[];
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type PaperRecord = {
  title?: string;
  source_type?: string;
  pmid?: string;
};

export const peggyApi = {
  health: () => apiFetch<{ status: string; qdrant: boolean; llm_provider: string; llm_configured: boolean; embeddings?: string }>("/health"),

  ingestPubmed: (body: {
    pmids?: string[];
    dois?: string[];
    search_query?: string;
    source_type?: string;
  }) => apiFetch<{ job_id: string; status: string }>("/ingest/pubmed", { method: "POST", body: JSON.stringify({ client_id: "web", ...body }) }),

  getJob: (jobId: string) => apiFetch<{ job_id: string; status: string; result?: unknown; error?: string }>(`/ingest/jobs/${jobId}`),

  listCorpus: (sourceType?: string) => {
    const q = sourceType ? `?source_type=${sourceType}` : "";
    return apiFetch<{ papers: PaperRecord[]; count: number }>(`/corpus${q}`);
  },

  chat: (query: string, sourceTypes?: string[]) =>
    apiFetch<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ query, client_id: "web", source_types: sourceTypes }),
    }),

  gapAnalysis: (query: string) =>
    apiFetch<WorkflowResponse>("/workflows/gap-analysis", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),

  compare: (finding: string, sourceTypes = ["literature", "own_findings"]) =>
    apiFetch<WorkflowResponse>("/workflows/compare", {
      method: "POST",
      body: JSON.stringify({ finding, source_types: sourceTypes }),
    }),

  futureDesign: (gapSummary: string, constraints: string) =>
    apiFetch<WorkflowResponse>("/workflows/future-design", {
      method: "POST",
      body: JSON.stringify({ gap_summary: gapSummary, constraints }),
    }),

  uploadFindings: (data: { title: string; narrative?: string; findings?: unknown[]; cohort?: string }) =>
    apiFetch<{ status: string; chunks: number }>("/ingest/findings", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const queryKeys = {
  health: ["health"] as const,
  corpus: (sourceType?: string) => ["corpus", sourceType] as const,
  job: (id: string) => ["job", id] as const,
};
