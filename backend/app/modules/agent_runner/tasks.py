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

async def async_run_agent(payload: dict, task_id: str):
    publish_event(task_id, "PROCESSING", "Initializing AI Agent workflow...")
    
    try:
        # Check if payload is ChatRequest (has blueprint and messages) or just blueprint
        if "blueprint" in payload and "messages" in payload:
            blueprint_data = payload["blueprint"]
            chat_messages = payload["messages"]
        else:
            blueprint_data = payload
            chat_messages = [{"role": "user", "content": "Please start the task."}]

        try:
            blueprint = AgentBlueprint(**blueprint_data)
        except Exception as e:
            raise ValueError(f"AgentBlueprint validation failed. blueprint_data: {blueprint_data}. Error: {e}")
        
        async with AsyncExitStack() as stack:
            # 1. Connect to any MCP tools requested by the agents
            publish_event(task_id, "PROCESSING", "Connecting to MCP Tools...")
            mcp_tool_map = await load_mcp_tools_for_blueprint(blueprint, stack, task_id=task_id)
            
            # 2. Build the workflow with the loaded tools
            workflow = build_agent_graph(blueprint, mcp_tool_map, task_id=task_id)
            
            # 3. Prepare LangChain messages
            from langchain_core.messages import AIMessage, SystemMessage
            lc_messages = []
            for msg in chat_messages:
                if msg["role"] == "user":
                    lc_messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "agent":
                    lc_messages.append(AIMessage(content=msg["content"]))
                else:
                    lc_messages.append(SystemMessage(content=msg["content"]))

            initial_state = {
                "messages": lc_messages,
                "blueprint_id": blueprint.id
            }
            
            publish_event(task_id, "PROCESSING", "Multi-Agent Team is thinking...")
            
            import httpx
            NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")
            INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "nodebook-secret-dev")
            
            final_text = "No response."
            
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {INTERNAL_SECRET}"}
                
                # Create Run
                try:
                    await client.post(f"{NEXTJS_URL}/api/internal/traces", json={
                        "action": "CREATE_RUN",
                        "runId": task_id,
                        "blueprintId": blueprint.id,
                        "status": "RUNNING"
                    }, headers=headers)
                except Exception as e:
                    print(f"Failed to create run in Trace API: {e}")
                
                step_index = 0
                # Stream updates from the graph
                async for update in workflow.astream(initial_state, stream_mode="updates"):
                    for node_id, state_update in update.items():
                        if "messages" in state_update:
                            messages = state_update["messages"]
                            if not isinstance(messages, list):
                                messages = [messages]
                            
                            for msg in messages:
                                msg_dict = msg.dict() if hasattr(msg, "dict") else msg
                                
                                _type = "MESSAGE"
                                if getattr(msg, "type", "") == "ai" and getattr(msg, "tool_calls", None):
                                    _type = "TOOL_CALL"
                                    final_text = f"Action: Called tools {', '.join([t['name'] for t in msg.tool_calls])}"
                                elif getattr(msg, "type", "") == "tool":
                                    _type = "TOOL_RESULT"
                                elif getattr(msg, "type", "") == "ai":
                                    _type = "THOUGHT"
                                    if getattr(msg, "content", None):
                                        final_text = str(msg.content)
                                    
                                # Save trace to Next.js
                                try:
                                    await client.post(f"{NEXTJS_URL}/api/internal/traces", json={
                                        "action": "ADD_TRACE",
                                        "runId": task_id,
                                        "stepIndex": step_index,
                                        "agentId": node_id,
                                        "type": _type,
                                        "content": msg_dict
                                    }, headers=headers)
                                except Exception as e:
                                    print(f"Failed to save trace step: {e}")
                                    
                                # Publish trace step to Redis for real-time UI
                                publish_event(task_id, "TRACE_STEP", "New trace step", {
                                    "stepIndex": step_index,
                                    "agentId": node_id,
                                    "type": _type,
                                    "content": msg_dict
                                })
                                step_index += 1
                
                # Update status to COMPLETED
                try:
                    await client.post(f"{NEXTJS_URL}/api/internal/traces", json={
                        "action": "UPDATE_STATUS",
                        "runId": task_id,
                        "status": "COMPLETED"
                    }, headers=headers)
                except:
                    pass
                
            publish_event(task_id, "COMPLETED", "Team finished processing successfully.", {"reply": final_text})
            
            return {"status": "success", "reply": final_text}
    except BaseException as e:
        import traceback
        # Unpack ExceptionGroup to find the real root cause
        error_parts = []
        if hasattr(e, 'exceptions'):  # ExceptionGroup
            for i, sub_exc in enumerate(e.exceptions):
                tb = ''.join(traceback.format_exception(type(sub_exc), sub_exc, sub_exc.__traceback__))
                error_parts.append(f"Sub-exception {i+1}: {type(sub_exc).__name__}: {sub_exc}\n{tb}")
                print(f"\n[ERROR] Sub-exception {i+1}:\n{tb}")
        
        full_tb = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"\n[ERROR] Full traceback:\n{full_tb}")
        
        error_msg = '\n'.join(error_parts) if error_parts else str(e)
        publish_event(task_id, "ERROR", f"Error occurred: {error_msg}")
        return {"status": "error", "message": error_msg}

@celery_app.task(bind=True)
def run_agent_pipeline(self, payload: dict):
    task_id = self.request.id
    try:
        return asyncio.run(async_run_agent(payload, task_id))
    except BaseException as e:
        import traceback
        error_parts = []
        if hasattr(e, 'exceptions'):
            for i, sub_exc in enumerate(e.exceptions):
                tb = ''.join(traceback.format_exception(type(sub_exc), sub_exc, sub_exc.__traceback__))
                error_parts.append(f"Sub-exception {i+1}: {type(sub_exc).__name__}: {sub_exc}\n{tb}")
                print(f"\n[FATAL ERROR] Sub-exception {i+1}:\n{tb}")
        
        full_tb = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"\n[FATAL ERROR] Full traceback:\n{full_tb}")
        
        error_msg = '\n'.join(error_parts) if error_parts else str(e)
        publish_event(task_id, "ERROR", f"Fatal Pipeline Error: {error_msg}")
        return {"status": "error", "message": error_msg}
