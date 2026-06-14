import pytest
import os
from unittest.mock import Mock
from app.modules.agent_runner.domain.models import AgentBlueprint, AgentConfig, EdgeConfig, NodeConfig
from app.modules.agent_runner.application.builder import build_agent_graph

def test_build_agent_graph_success(monkeypatch):
    """Test that a valid blueprint can successfully build a LangGraph workflow."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "dummy-key")
    blueprint = AgentBlueprint(
        id="test-bp-1",
        version="1.0",
        agents=[
            AgentConfig(
                id="agent_1",
                name="Researcher",
                systemPrompt="You are a researcher.",
                llmProvider="openai",
                modelId="openai/gpt-4o-mini",
                tools=[],
                credentials={"apiKey": "dummy"},
                maxToolCalls=1,
                maxHandoffBounces=1,
                maxMemoryMessages=10,
                agentNote=None
            ),
            AgentConfig(
                id="agent_2",
                name="Writer",
                systemPrompt="You are a writer.",
                llmProvider="openai",
                modelId="openai/gpt-4o-mini",
                tools=[],
                credentials={"apiKey": "dummy"},
                maxToolCalls=1,
                maxHandoffBounces=1,
                maxMemoryMessages=10,
                agentNote=None
            )
        ],
        nodes=[],
        edges=[
            EdgeConfig(
                id="edge_1",
                source="agent_1",
                target="agent_2"
            )
        ]
    )

    llm_factory_mock = Mock()
    llm_factory_mock.create_llm.return_value = Mock()
    app = build_agent_graph(blueprint, llm_factory_mock, None, None, "test") # type: ignore[arg-type]
    
    assert app is not None
    assert hasattr(app, "invoke")
    assert app.name == "LangGraph"

def test_build_agent_graph_no_agents():
    """Test that building a graph with no agents raises a ValueError."""
    blueprint = AgentBlueprint(
        id="empty-bp",
        version="1.0",
        agents=[],
        nodes=[],
        edges=[]
    )

    with pytest.raises(ValueError, match="Blueprint must contain at least one agent."):
        build_agent_graph(blueprint, None, None, None, "test") # type: ignore[arg-type]
