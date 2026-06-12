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

export type ChatMode = "auto" | "chat" | "gap_analysis" | "compare";

export type ChatResponse = {
  mode: string;
  response: string;
  body?: Record<string, unknown> | null;
  sources: SourceCitation[];
  confidence: string;
  limitations: string[];
};

export type AgentStep = {
  step: number;
  type: string;
  tool?: string | null;
  summary: string;
};

export type AgentResponse = {
  answer: string;
  body?: Record<string, unknown> | null;
  sources: SourceCitation[];
  steps: AgentStep[];
  tools_used: string[];
  confidence: string;
  limitations: string[];
  truncated: boolean;
  session_id: string;
};

export type AgentStreamEvent = {
  type: "step_start" | "tool_call" | "tool_result" | "final";
  step?: number;
  tool?: string;
  summary?: string;
  arguments?: Record<string, unknown>;
  error?: string | null;
  response?: AgentResponse;
};

export type UploadResponse = {
  status: string;
  chunks?: number;
  paper_id?: number;
  message?: string;
  filename?: string;
  title?: string;
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
  id?: number;
  title?: string;
  source_type?: string;
  pmid?: string;
  doi?: string;
  authors?: string;
  year?: string;
  ingested_at?: string;
};

export type DiscoveryCandidate = {
  title: string;
  abstract: string;
  doi?: string | null;
  pmid?: string | null;
  year?: number | null;
  source: "pubmed" | "europe_pmc";
  relevance_score?: number | null;
  already_in_corpus: boolean;
};

export type DiscoveryResponse = {
  query_used: string;
  candidates: DiscoveryCandidate[];
  total_found: number;
  total_after_dedup: number;
};

export const peggyApi = {
  health: () =>
    apiFetch<{
      status: string;
      qdrant: boolean;
      llm_provider: string;
      llm_configured: boolean;
      llm_reachable?: boolean;
      ollama_reachable?: boolean | null;
      embeddings?: string;
    }>("/health"),

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

  getPaper: (id: number) => apiFetch<PaperRecord>(`/corpus/${id}`),

  getPaperText: (id: number) =>
    apiFetch<{ paper_id: number; title: string; text: string }>(`/corpus/${id}/text`),

  discover: (topic?: string, maxResults = 20) =>
    apiFetch<DiscoveryResponse>("/discover", {
      method: "POST",
      body: JSON.stringify({ topic: topic ?? null, max_results: maxResults }),
    }),

  updatePaper: (id: number, data: Partial<PaperRecord>) =>
    apiFetch<PaperRecord>(`/corpus/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deletePaper: (id: number) =>
    apiFetch<{ status: string; paper_id: number; vectors_purged: boolean }>(`/corpus/${id}`, {
      method: "DELETE",
    }),

  chat: (query: string, options?: { sourceTypes?: string[]; mode?: ChatMode }) =>
    apiFetch<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({
        query,
        client_id: "web",
        mode: options?.mode ?? "auto",
        source_types: options?.sourceTypes,
      }),
    }),

  agentRun: (
    query: string,
    options: { sessionId: string; sourceTypes?: string[]; mode?: ChatMode }
  ) =>
    apiFetch<AgentResponse>("/agent/run", {
      method: "POST",
      body: JSON.stringify({
        query,
        session_id: options.sessionId,
        client_id: "web",
        mode: options.mode ?? "auto",
        source_types: options.sourceTypes,
      }),
    }),

  agentStream: async function* (
    query: string,
    options: { sessionId: string; sourceTypes?: string[]; mode?: ChatMode }
  ): AsyncGenerator<AgentStreamEvent> {
    const res = await fetch(`${API_URL}/agent/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        session_id: options.sessionId,
        client_id: "web",
        mode: options.mode ?? "auto",
        source_types: options.sourceTypes,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6)) as AgentStreamEvent;
          } catch {
            /* skip malformed */
          }
        }
      }
    }
  },

  gapAnalysis: (query: string, sourceTypes?: string[]) =>
    apiFetch<WorkflowResponse>("/workflows/gap-analysis", {
      method: "POST",
      body: JSON.stringify({ query, source_types: sourceTypes }),
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
    apiFetch<UploadResponse>("/ingest/findings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  uploadDocument: async (
    file: File,
    options?: { title?: string; sourceType?: "literature" | "own_findings" }
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", options?.title ?? file.name.replace(/\.pdf$/i, ""));
    form.append("source_type", options?.sourceType ?? "literature");
    const res = await fetch(`${API_URL}/ingest/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    return res.json() as Promise<UploadResponse>;
  },
};

export const queryKeys = {
  health: ["health"] as const,
  corpus: (sourceType?: string) => ["corpus", sourceType] as const,
  job: (id: string) => ["job", id] as const,
};
