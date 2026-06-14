import pytest
import os
import sys

# Add the backend directory to sys.path so app modules can be imported correctly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

@pytest.fixture
def mock_blueprint_payload():
    return {
        "id": "test-id",
        "version": "1.0",
        "name": "Test Blueprint",
        "agents": [
            {
                "id": "agent-1",
                "name": "Agent 1",
                "systemPrompt": "hello",
                "llmProvider": "openai-compatible",
                "modelId": "llama-3.3",
                "tools": [],
                "credentials": {},
            }
        ],
        "nodes": [],
        "edges": []
    }
