import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_chat_api_validation():
    payload = {
      "blueprint": {
        "id": "1",
        "version": "1",
        "name": "Test",
        "agents": [] # Empty agents should trigger 400 Bad Request
      },
      "messages": [
        {"role": "user", "content": "hello"}
      ]
    }
    
    response = client.post("/api/agent/chat", json=payload)
    assert response.status_code == 400
    assert "Blueprint must contain at least one agent" in response.json()["detail"]
