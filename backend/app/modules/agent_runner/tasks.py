import json
import asyncio
import redis
import os
from langchain_core.messages import HumanMessage
from app.core.celery_app import celery_app
from app.modules.agent_runner.domain.models import AgentBlueprint
from app.modules.agent_runner.domain.graph import build_agent_graph
from app.modules.agent_runner.domain.state import AgentState

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)

def publish_event(task_id: str, status: str, message: str, data: dict = None):
    payload = {
        "status": status,
        "message": message,
        "data": data or {}
    }
    redis_client.publish(f"agent_stream_{task_id}", json.dumps(payload))

async def async_run_agent(blueprint_data: dict, task_id: str):
    publish_event(task_id, "PROCESSING", "Initializing AI Agent workflow...")
    
    try:
        blueprint = AgentBlueprint(**blueprint_data)
        
        workflow = build_agent_graph(blueprint)
        
        initial_state = {
            "messages": [HumanMessage(content="Please start the task.")],
            "blueprint_id": blueprint.id
        }
        
        publish_event(task_id, "PROCESSING", "Multi-Agent Team is thinking...")
        
        result = await workflow.ainvoke(initial_state)
        
        # Extract content from the final message
        final_message = result["messages"][-1].content if result.get("messages") else "No response."
        publish_event(task_id, "COMPLETED", "Team finished processing successfully.", {"reply": final_message})
        
        return {"status": "success", "reply": final_message}
    except Exception as e:
        error_msg = str(e)
        publish_event(task_id, "ERROR", f"Error occurred: {error_msg}")
        return {"status": "error", "message": error_msg}

@celery_app.task(bind=True, name="app.modules.agent_runner.tasks.run_agent_pipeline")
def run_agent_pipeline(self, blueprint_data: dict):
    task_id = self.request.id
    result = asyncio.run(async_run_agent(blueprint_data, task_id))
    return result
