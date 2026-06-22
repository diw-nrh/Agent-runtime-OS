import json
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import redis
import os
from langchain_core.messages import HumanMessage
from app.core.celery_app import celery_app
from contextlib import AsyncExitStack
from app.modules.agent_runner.domain.models import AgentBlueprint
from app.core.config import settings
from app.modules.agent_runner.application.builder import build_agent_graph
from app.modules.agent_runner.infrastructure.adapters.langchain_llm_factory import LangchainLLMFactory
from app.modules.agent_runner.infrastructure.adapters.redis_telemetry import RedisTelemetry
from app.modules.agent_runner.domain.state import AgentState
from app.modules.mcp_gateway.mcp_client import load_mcp_tools_for_blueprint

from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import Command

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/agent_runtime")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)

def publish_event(task_id: str, status: str, message: str, data: dict | None = None):
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
    
    is_resume = payload.get("resume", False)
    resume_action = payload.get("action")
    
    if is_resume:
        run_id = payload.get("run_id", task_id)
        # Restore original payload from Redis
        cached_payload = redis_client.get(f"agent_payload_{run_id}")
        if not cached_payload:
            publish_event(task_id, "ERROR", "Cannot resume: Missing original payload.")
            return {"status": "error"}
        
        original_payload = json.loads(cached_payload)
        blueprint_data = original_payload.get("blueprint", {})
        chat_messages = original_payload.get("messages", [])
        task_id = run_id # Keep the same thread ID
    else:
        # Cache payload for potential future resumes
        redis_client.set(f"agent_payload_{task_id}", json.dumps(payload))
        
        # Check if payload is ChatRequest (has blueprint and messages) or just blueprint
        if "blueprint" in payload and "messages" in payload:
            blueprint_data = payload["blueprint"]
            chat_messages = payload["messages"]
        else:
            blueprint_data = payload
            chat_messages = [{"role": "user", "content": "Please start the task."}]

    try:


        try:
            blueprint = AgentBlueprint(**blueprint_data)
        except Exception as e:
            raise ValueError(f"AgentBlueprint validation failed. blueprint_data: {blueprint_data}. Error: {e}")
        
        async with AsyncExitStack() as stack:
            # 1. Connect to any MCP tools requested by the agents
            publish_event(task_id, "PROCESSING", "Connecting to MCP Tools...")
            mcp_tool_map = await load_mcp_tools_for_blueprint(blueprint, stack, task_id=task_id)
            
            # 2. Build the workflow with the loaded tools
            llm_factory = LangchainLLMFactory()
            telemetry = RedisTelemetry(REDIS_URL)
            
            pool = await stack.enter_async_context(AsyncConnectionPool(
                conninfo=DATABASE_URL,
                max_size=20,
                kwargs={"autocommit": True, "prepare_threshold": 0},
            ))
            checkpointer = AsyncPostgresSaver(pool) # type: ignore[arg-type]
            await checkpointer.setup()
            
            workflow = build_agent_graph(
                blueprint, 
                llm_factory=llm_factory, 
                telemetry=telemetry, 
                mcp_tool_map=mcp_tool_map, 
                task_id=task_id,
                checkpointer=checkpointer
            )
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

            if is_resume:
                initial_state = Command(resume={"action": resume_action})
            else:
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
                
                # Langfuse Tracing
                callbacks = []
                if blueprint.langfuse_public_key and blueprint.langfuse_secret_key:
                    try:
                        print(f"[LANGFUSE DEBUG] Initializing with PK={blueprint.langfuse_public_key}, HOST={blueprint.langfuse_host}")
                        
                        from langfuse import Langfuse
                        from langfuse.langchain import CallbackHandler
                        
                        langfuse_client = Langfuse(
                            public_key=blueprint.langfuse_public_key,
                            secret_key=blueprint.langfuse_secret_key,
                            host=blueprint.langfuse_host or "https://cloud.langfuse.com"
                        )
                        
                        langfuse_handler = CallbackHandler(public_key=blueprint.langfuse_public_key)
                        callbacks.append(langfuse_handler)
                        print("[LANGFUSE DEBUG] CallbackHandler successfully added to callbacks list.")
                    except ImportError as e:
                        print(f"[LANGFUSE DEBUG] langfuse package not installed or import error: {e}")
                
                config = {"configurable": {"thread_id": task_id}, "callbacks": callbacks}
                
                # Stream updates from the graph
                async for update in workflow.astream(initial_state, config=config, stream_mode="updates"): # type: ignore[arg-type]
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
                
                # Check if graph paused due to interrupt
                state = await workflow.aget_state(config) # type: ignore[arg-type]
                if state.next:
                    # Graph is paused!
                    interrupts = []
                    if hasattr(state, "tasks") and state.tasks:
                        for t in state.tasks:
                            if hasattr(t, "interrupts") and t.interrupts:
                                interrupts.extend(t.interrupts)
                    
                    interrupt_data = interrupts[0].value if interrupts else {"type": "WAITING_FOR_HUMAN"}
                    
                    try:
                        await client.post(f"{NEXTJS_URL}/api/internal/traces", json={
                            "action": "UPDATE_STATUS",
                            "runId": task_id,
                            "status": "WAITING"
                        }, headers=headers)
                    except:
                        pass
                    
                    publish_event(task_id, "WAITING_FOR_HUMAN", "Agent requires human approval to proceed.", interrupt_data)
                    return {"status": "paused", "interrupt": interrupt_data}
                
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
            
            # Flush Langfuse traces
            if 'langfuse_client' in locals():
                print("[LANGFUSE DEBUG] Flushing langfuse traces...")
                langfuse_client.flush()
                print("[LANGFUSE DEBUG] Flush complete.")
            else:
                print("[LANGFUSE DEBUG] langfuse_client not found in locals!")
                
            return {"status": "success", "reply": final_text}
    except BaseException as e:
        import traceback
        # Unpack ExceptionGroup to find the real root cause
        error_parts = []
        if hasattr(e, 'exceptions'):  # type: ignore[attr-defined]
            for i, sub_exc in enumerate(e.exceptions): # type: ignore[attr-defined]
                tb = ''.join(traceback.format_exception(type(sub_exc), sub_exc, sub_exc.__traceback__))
                error_parts.append(f"Sub-exception {i+1}: {type(sub_exc).__name__}: {sub_exc}\n{tb}")
                print(f"\n[ERROR] Sub-exception {i+1}:\n{tb}")
        
        full_tb = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"\n[ERROR] Full traceback:\n{full_tb}")
        
        error_msg = '\n'.join(error_parts) if error_parts else str(e)
        
        # Intercept common OpenAI compatibility errors for better UX
        if "NotFoundError" in str(type(e)) or "404 page not found" in error_msg:
            error_msg = "Error 404 (Not Found): The requested AI provider endpoint or model could not be found. Please verify that the specified Base URL contains the correct API path prefix (e.g., '/v1' or '/api/v1' for OpenAI-compatible endpoints) and that the requested Model ID is actively served by your provider."
            
        publish_event(task_id, "ERROR", f"System Error: {error_msg}")
        
        # Update run status to FAILED
        import httpx
        NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")
        INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "nodebook-secret-dev")
        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"{NEXTJS_URL}/api/internal/traces", json={
                    "action": "UPDATE_STATUS",
                    "runId": task_id,
                    "status": "FAILED"
                }, headers={"Authorization": f"Bearer {INTERNAL_SECRET}"})
        except:
            pass
            
        return {"status": "error", "message": error_msg}

@celery_app.task(bind=True)
def run_agent_pipeline(self, payload: dict):
    task_id = self.request.id
    try:
        return asyncio.run(async_run_agent(payload, task_id))
    except BaseException as e:
        import traceback
        error_parts = []
        if hasattr(e, 'exceptions'): # type: ignore[attr-defined]
            for i, sub_exc in enumerate(e.exceptions): # type: ignore[attr-defined]
                tb = ''.join(traceback.format_exception(type(sub_exc), sub_exc, sub_exc.__traceback__))
                error_parts.append(f"Sub-exception {i+1}: {type(sub_exc).__name__}: {sub_exc}\n{tb}")
                print(f"\n[FATAL ERROR] Sub-exception {i+1}:\n{tb}")
        
        full_tb = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
        print(f"\n[FATAL ERROR] Full traceback:\n{full_tb}")
        
        error_msg = '\n'.join(error_parts) if error_parts else str(e)
        publish_event(task_id, "ERROR", f"Fatal Pipeline Error: {error_msg}")
        return {"status": "error", "message": error_msg}
