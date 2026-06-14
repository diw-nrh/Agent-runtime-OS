import sys
import os
import time
import json
from celery.result import AsyncResult

# Adjust path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.modules.agent_runner.domain.models import AgentBlueprint, ChatRequest, ChatMessage, AgentConfig
from app.modules.agent_runner.infrastructure.adapters.celery_orchestrator import CeleryOrchestrator

def main():
    print("Simulating e2e ChatRequest through Celery Orchestrator...")
    
    blueprint = AgentBlueprint(
        id="test-blueprint-123",
        version="1.0",
        agents=[
            AgentConfig(
                id="agent-1",
                name="TestAgent",
                systemPrompt="You are a helpful test assistant.",
                llmProvider="local",
                modelId="test",
                tools=[],
                agentNote="Test",
                credentials={},
                maxToolCalls=1,
                maxHandoffBounces=1,
                maxMemoryMessages=10
            )
        ],
        nodes=[],
        edges=[],
        api_keys={"local": "http://localhost:11434"}
    )
    
    chat_request = ChatRequest(
        blueprint=blueprint,
        messages=[
            ChatMessage(role="user", content="Hello, this is an e2e test.")
        ]
    )
    
    payload = {
        "blueprint": chat_request.blueprint.dict(),
        "messages": [m.dict() for m in chat_request.messages],
        "trace_id": "test-trace-123"
    }
    
    orchestrator = CeleryOrchestrator()
    try:
        print("Submitting task to celery...")
        task_id = orchestrator.submit_agent_run(chat_request.blueprint.id, payload)
        print(f"Task submitted successfully. Task ID: {task_id}")
        
        # Wait for the task to be picked up and processed
        result = AsyncResult(task_id)
        
        timeout = 30
        start_time = time.time()
        
        while not result.ready():
            if time.time() - start_time > timeout:
                print("Timeout waiting for celery worker to process the task.")
                sys.exit(1)
            time.sleep(1)
            
        if result.state == 'SUCCESS':
            print("Task completed successfully!")
            print("Result:", result.result)
            print("200 OK equivalent")
            sys.exit(0)
        else:
            print(f"Task failed with state: {result.state}")
            if result.info:
                print(f"Error info: {result.info}")
            sys.exit(1)
            
    except Exception as e:
        print(f"Failed to submit or process task: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
