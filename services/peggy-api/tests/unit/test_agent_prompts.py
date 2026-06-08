from core.rag.prompts import build_agent_system_prompt


def test_build_agent_system_prompt_includes_mode():
    tools = [{"type": "function", "function": {"name": "search_corpus", "parameters": {}}}]
    prompt = build_agent_system_prompt("chat", tools)
    assert "search_corpus" in prompt
    assert "chat" in prompt.lower() or "Mode: chat" in prompt
