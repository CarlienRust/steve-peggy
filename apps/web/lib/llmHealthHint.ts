export type HealthResponse = {
  qdrant?: boolean;
  llm_provider?: string;
  llm_configured?: boolean;
  llm_reachable?: boolean;
  embeddings?: string;
};

/** User-facing hint when synthesis is not ready. */
export function llmHealthHint(health: HealthResponse | undefined): string | undefined {
  if (!health) return undefined;
  if (!health.qdrant) return "Start Qdrant: ./scripts/start-qdrant.sh";
  if (health.embeddings === "hash-fallback") {
    return "Install sentence-transformers in the API venv for semantic search";
  }
  const ready = health.llm_reachable ?? health.llm_configured;
  if (ready) return undefined;

  switch (health.llm_provider) {
    case "ollama":
      return "Start Ollama (ollama serve) and pull your model";
    case "gemini":
      return "Set GEMINI_API_KEY in Render (Google AI Studio → API key)";
    default:
      return "Configure LLM_PROVIDER and API credentials in services/peggy-api/.env";
  }
}
