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
    case "groq":
      return "Set GROQ_API_KEY in services/peggy-api/.env";
    case "anthropic":
      return "Set ANTHROPIC_API_KEY in .env";
    case "openai":
    default:
      return "Set OPENAI_API_KEY in .env";
  }
}
