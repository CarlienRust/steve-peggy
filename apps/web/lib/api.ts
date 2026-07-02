export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let accessTokenProvider: (() => Promise<string | null>) | null = null;

export function setAccessTokenProvider(fn: () => Promise<string | null>) {
  accessTokenProvider = fn;
}

async function authHeaders(contentType = "application/json"): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (accessTokenProvider) {
    const token = await accessTokenProvider();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

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

export type ResearcherProfile = {
  user_id?: string;
  researcher_id: string;
  title: string;
  name: string;
  surname: string;
  email: string;
  research_focus: string;
  research_type: string;
  display_name: string;
};

export type Workspace = {
  id: string;
  user_id?: string;
  title: string;
  aim: string;
  objectives: string[];
};

export type TierLimits = {
  embedding_backend: string;
  max_papers_per_user: number;
  max_workspaces_per_user: number;
  max_pmids_per_ingest: number;
  max_discover_results: number;
  max_upload_bytes: number;
  max_text_query_len: number;
  max_agent_steps: number;
  rate_limits_per_hour: {
    chat: number;
    agent: number;
    ingest: number;
    discover: number;
    workflow: number;
  };
};

export type RateLimitBucket = {
  action: string;
  used: number;
  limit: number;
  remaining: number;
  resets_at: string;
  window_sec: number;
};

export type UserUsage = {
  chat: RateLimitBucket;
  agent: RateLimitBucket;
  max_text_query_len: number;
};

type ApiErrorDetail = {
  code?: string;
  action?: string;
  limit?: number;
  used?: number;
  remaining?: number;
  resets_at?: string;
  length?: number;
  message?: string;
};

export class PeggyApiError extends Error {
  status: number;
  code?: string;
  resetsAt?: string;
  retryAfter?: number;

  constructor(status: number, message: string, detail?: ApiErrorDetail, retryAfter?: number) {
    super(message);
    this.name = "PeggyApiError";
    this.status = status;
    this.code = detail?.code;
    this.resetsAt = detail?.resets_at;
    this.retryAfter = retryAfter;
  }
}

function parseApiErrorDetail(raw: string): ApiErrorDetail | undefined {
  try {
    const parsed = JSON.parse(raw) as { detail?: ApiErrorDetail | string };
    if (parsed.detail && typeof parsed.detail === "object") {
      return parsed.detail;
    }
  } catch {
    /* plain text error */
  }
  return undefined;
}

async function throwApiError(res: Response, text: string): Promise<never> {
  const detail = parseApiErrorDetail(text);
  const retryAfterHeader = res.headers.get("Retry-After");
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  let message = text || res.statusText;
  if (detail?.message) {
    message = detail.message;
  } else {
    try {
      const parsed = JSON.parse(text) as { detail?: string };
      if (typeof parsed.detail === "string") {
        message = parsed.detail;
      }
    } catch {
      /* keep text */
    }
  }
  throw new PeggyApiError(res.status, message, detail, Number.isFinite(retryAfter) ? retryAfter : undefined);
}

export function formatResetsAt(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatApiError(err: unknown): string {
  if (err instanceof PeggyApiError) {
    if (err.resetsAt) {
      return `${err.message} Resets ${formatResetsAt(err.resetsAt)}.`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    await throwApiError(res, text);
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
      limits?: TierLimits;
    }>("/health"),

  limits: () => apiFetch<TierLimits>("/limits"),

  usage: () => apiFetch<UserUsage>("/usage"),

  ingestPubmed: (body: {
    pmids?: string[];
    dois?: string[];
    search_query?: string;
    source_type?: string;
  }) => apiFetch<{ job_id: string; status: string }>("/ingest/pubmed", { method: "POST", body: JSON.stringify(body) }),

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
        mode: options.mode ?? "auto",
        source_types: options.sourceTypes,
      }),
    }),

  agentStream: async function* (
    query: string,
    options: { sessionId: string; sourceTypes?: string[]; mode?: ChatMode }
  ): AsyncGenerator<AgentStreamEvent> {
    const headers = await authHeaders();
    const res = await fetch(`${API_URL}/agent/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        session_id: options.sessionId,
        mode: options.mode ?? "auto",
        source_types: options.sourceTypes,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      await throwApiError(res, text);
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
    const headers = await authHeaders("");
    delete (headers as Record<string, string>)["Content-Type"];
    const res = await fetch(`${API_URL}/ingest/upload`, { method: "POST", headers, body: form });
    if (!res.ok) {
      const text = await res.text();
      await throwApiError(res, text);
    }
    return res.json() as Promise<UploadResponse>;
  },

  getProfile: () => apiFetch<ResearcherProfile>("/profile"),

  upsertProfile: (body: {
    title: string;
    name: string;
    surname: string;
    email: string;
    research_focus: string;
    research_type: string;
  }) => apiFetch<ResearcherProfile>("/profile", { method: "PUT", body: JSON.stringify(body) }),

  listWorkspaces: () =>
    apiFetch<{ workspaces: Workspace[]; count: number }>("/workspaces"),

  createWorkspace: (body: { title: string; aim?: string; objectives?: string[] }) =>
    apiFetch<Workspace>("/workspaces", { method: "POST", body: JSON.stringify(body) }),

  updateWorkspace: (id: string, body: Partial<{ title: string; aim: string; objectives: string[] }>) =>
    apiFetch<Workspace>(`/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteWorkspace: (id: string) =>
    apiFetch<{ status: string; id: string }>(`/workspaces/${id}`, { method: "DELETE" }),
};

export const queryKeys = {
  health: ["health"] as const,
  limits: ["limits"] as const,
  usage: ["usage"] as const,
  corpus: (sourceType?: string) => ["corpus", sourceType] as const,
  job: (id: string) => ["job", id] as const,
  profile: (userId?: string) => (userId ? (["profile", userId] as const) : (["profile"] as const)),
  workspaces: (userId?: string) => (userId ? (["workspaces", userId] as const) : (["workspaces"] as const)),
};
