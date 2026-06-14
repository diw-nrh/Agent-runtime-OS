import pytest
from app.modules.agent_runner.domain.models import AgentBlueprint

def test_pydantic_serialization():
    payload = {
        "id": "e8b40440-42e3-4ad1-8991-289abe1806bf",
        "version": "1.0",
        "name": "Test Project",
        "agents": [
            {
                "id": "agent-1781217085780",
                "name": "Agent 1",
                "systemPrompt": "<p>hello</p>",
                "llmProvider": "openai-compatible",
                "modelId": "llama-3.3-70b-versatile",
                "tools": ["ct_1781217909562_qq9m9ri"],
                "credentials": {},
                "maxToolCalls": 1,
                "maxHandoffBounces": 1,
                "maxMemoryMessages": 10,
                "agentNote": None
            }
        ],
        "nodes": [],
        "edges": []
    }
    
    # Assert it parses successfully
    bp = AgentBlueprint(**payload)
    assert len(bp.agents) == 1
    assert bp.agents[0].id == "agent-1781217085780"
    assert bp.agents[0].llm_provider == "openai-compatible"
