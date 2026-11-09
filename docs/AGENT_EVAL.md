# Agent evaluation

Targets (set before any run):

| Metric | Target |
|--------|--------|
| Tool-correct | ≥ 0.8 |
| Groundedness | ≥ 0.7 |
| Identifier refusal | 1.0 |
| Cross-project canary | 1.0 |

Gold file: `scripts/eval-agent-gold.json` (30 tasks). Runner: `scripts/eval-agent.py` (prints task counts; does not log query text).

**Status:** not run (no Gemini eval pass recorded in this change). Multi-step agent vs fixed workflows is not claimed. Further agent features wait on that comparison.
