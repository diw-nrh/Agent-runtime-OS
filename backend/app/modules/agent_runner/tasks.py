import json
import asyncio
import redis
import os
from langchain_core.messages import HumanMessage
from app.core.celery_app import celery_app
from contextlib import AsyncExitStack
from app.modules.agent_runner.domain.models import AgentBlueprint
from app.modules.agent_runner.domain.graph import build_agent_graph
from app.modules.agent_runner.domain.state import AgentState
from app.modules.mcp_gateway.mcp_client import load_mcp_tools_for_blueprint

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)

def publish_event(task_id: str, status: str, message: str, data: dict = None):
    payload = {
        "status": status,
        "message": message,
        "data": data or {}
    }
    try:
        redis_client.publish(f"agent_stream_{task_id}", json.dumps(payload))
    except Exception as e:
        print(f"Failed to publish event to Redis: {e}")

async def async_run_agent(blueprint_data: dict, task_id: str):
    publish_event(task_id, "PROCESSING", "Initializing AI Agent workflow...")
    
    try:
        blueprint = AgentBlueprint(**blueprint_data)
        
        async with AsyncExitStack() as stack:
            # 1. Connect to any MCP tools requested by the agents
            publish_event(task_id, "PROCESSING", "Connecting to MCP Tools...")
            mcp_tool_map = await load_mcp_tools_for_blueprint(blueprint, stack)
            
            # 2. Build the workflow with the loaded tools
            workflow = build_agent_graph(blueprint, mcp_tool_map)
            
            initial_state = {
                "messages": [HumanMessage(content="Please start the task.")],
                "blueprint_id": blueprint.id
            }
            
            publish_event(task_id, "PROCESSING", "Multi-Agent Team is thinking...")
            
            result = await workflow.ainvoke(initial_state)
            
            messages = result.get("messages", [])
            if messages:
                final_msg = messages[-1]
                if getattr(final_msg, "content", None):
                    final_text = str(final_msg.content)
                elif getattr(final_msg, "tool_calls", None):
                    final_text = f"Action: Called tools {', '.join([t['name'] for t in final_msg.tool_calls])}"
                else:
                    final_text = str(final_msg.dict() if hasattr(final_msg, "dict") else final_msg)
            else:
                final_text = "No response."
                
            publish_event(task_id, "COMPLETED", "Team finished processing successfully.", {"reply": final_text})
            
            return {"status": "success", "reply": final_text}
    except Exception as e:
        error_msg = str(e)
        publish_event(task_id, "ERROR", f"Error occurred: {error_msg}")
        return {"status": "error", "message": error_msg}

@celery_app.task(bind=True)
def run_agent_pipeline(self, blueprint_data: dict):
    task_id = self.request.id
    try:
        return asyncio.run(async_run_agent(blueprint_data, task_id))
    except Exception as e:
        error_msg = str(e)
        publish_event(task_id, "ERROR", f"Fatal Pipeline Error: {error_msg}")
        return {"status": "error", "message": error_msg}
