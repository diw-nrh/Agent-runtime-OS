import json
import asyncio
import redis
import os
from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import Literal, Optional
from app.modules.agent_runner.domain.models import AgentBlueprint
from app.modules.agent_runner.tasks import run_agent_pipeline
from app.core.celery_app import celery_app
from app.modules.agent_runner.infrastructure.adapters.langchain_llm_factory import LangchainLLMFactory
from app.core.celery_app import celery_app

router = APIRouter()
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)

@router.post("/compile")
async def compile_blueprint(blueprint: AgentBlueprint, request: Request):
    try:
        # Extract BYOK headers
        api_keys = {
            "groq": request.headers.get("x-groq-api-key", ""),
            "openai": request.headers.get("x-openai-api-key", ""),
            "local": request.headers.get("x-local-ai-url", "http://localhost:11434")
        }
        
        # Inject into blueprint payload
        blueprint_data = blueprint.dict()
        blueprint_data["api_keys"] = api_keys

        # Instead of just compiling, kick off the background job in Celery
        task = run_agent_pipeline.delay(blueprint_data)
        
        return {
            "message": "Job submitted successfully.",
            "blueprint_id": blueprint.id,
            "task_id": task.id,
            "status": "Processing"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/stop/{task_id}")
async def stop_agent_task(task_id: str):
    """Forcefully stop a running agent task."""
    try:
        # Terminate the task using Celery. Omit signal="SIGKILL" because Windows doesn't support it.
        celery_app.control.revoke(task_id, terminate=True)
        
        # Publish an error/stop message to close the SSE stream on the client
        redis_client.publish(f"agent_stream_{task_id}", json.dumps({
            "status": "ERROR",
            "message": "Task was manually stopped by the user."
        }))
        
        return {"status": "success", "message": "Task stopped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stream/{task_id}")
async def stream_agent_events(task_id: str, request: Request):
    """SSE endpoint to stream real-time events from Redis Pub/Sub."""
    from celery.result import AsyncResult
    
    async def event_generator():
        import httpx
        import os
        NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")
        INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "nodebook-secret-dev")

        task_result = AsyncResult(task_id)
        if task_result.ready():
            # Fetch historical traces in case client missed them
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(f"{NEXTJS_URL}/api/internal/traces?runId={task_id}", headers={"Authorization": f"Bearer {INTERNAL_SECRET}"})
                    if resp.status_code == 200:
                        traces = resp.json().get("traces", [])
                        for t in traces:
                            yield {"data": json.dumps({
                                "status": "TRACE_STEP",
                                "message": "Historical trace",
                                "data": {
                                    "stepIndex": t["stepIndex"],
                                    "agentId": t["agentId"],
                                    "type": t["type"],
                                    "content": t["content"]
                                }
                            })}
            except Exception as e:
                pass
                
            if task_result.state == 'SUCCESS':
                result_data = task_result.result if isinstance(task_result.result, dict) else {"reply": str(task_result.result)}
                if result_data.get("status") == "error":
                    yield {"data": json.dumps({"status": "ERROR", "message": result_data.get("message", "Unknown error")})}
                else:
                    yield {"data": json.dumps({
                        "status": "COMPLETED", 
                        "message": "Task was already completed.", 
                        "data": {"reply": result_data.get("reply", "")}
                    })}
            else:
                yield {"data": json.dumps({"status": "ERROR", "message": f"Task failed with state {task_result.state}"})}
            await asyncio.sleep(1.0)
            return

        pubsub = redis_client.pubsub()
        pubsub.subscribe(f"agent_stream_{task_id}")
        
        while True:
            if await request.is_disconnected():
                break
                
            # Exhaust all messages currently in the pubsub queue without sleeping
            got_message = False
            while True:
                message = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
                if not message:
                    break
                    
                got_message = True
                data_str = message['data'].decode('utf-8')
                yield {"data": data_str}
                
                try:
                    data_json = json.loads(data_str)
                    if data_json.get("status") in ["COMPLETED", "ERROR"]:
                        await asyncio.sleep(1.0) # Give client time to receive and close
                        return
                except:
                    pass
            
            # If task finished while we were waiting but we missed pubsub COMPLETED signal
            if AsyncResult(task_id).ready():
                res = AsyncResult(task_id)
                
                # Fetch any missed historical traces before sending COMPLETED
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(f"{NEXTJS_URL}/api/internal/traces?runId={task_id}", headers={"Authorization": f"Bearer {INTERNAL_SECRET}"})
                        if resp.status_code == 200:
                            traces = resp.json().get("traces", [])
                            for t in traces:
                                yield {"data": json.dumps({
                                    "status": "TRACE_STEP",
                                    "message": "Historical trace",
                                    "data": {"stepIndex": t["stepIndex"], "agentId": t["agentId"], "type": t["type"], "content": t["content"]}
                                })}
                except:
                    pass
                
                if res.state == 'SUCCESS':
                    res_data = res.result if isinstance(res.result, dict) else {}
                    if res_data.get("status") == "error":
                        yield {"data": json.dumps({"status": "ERROR", "message": res_data.get("message", "Unknown error")})}
                    else:
                        yield {"data": json.dumps({"status": "COMPLETED", "message": "Task finished.", "data": {"reply": res_data.get("reply", "") if isinstance(res.result, dict) else str(res.result)}})}
                else:
                    yield {"data": json.dumps({"status": "ERROR", "message": "Task failed."})}
                await asyncio.sleep(1.0)
                return
            
            if not got_message:
                await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())
            
import uuid
from fastapi import Depends
from app.modules.agent_runner.domain.models import AgentBlueprint, ChatRequest
from app.modules.agent_runner.ports.orchestrator_port import OrchestratorPort

def get_orchestrator() -> OrchestratorPort:
    from app.modules.agent_runner.infrastructure.adapters.celery_orchestrator import CeleryOrchestrator
    # Future: if os.getenv("ORCHESTRATOR_TYPE") == "temporal": return TemporalOrchestrator()
    return CeleryOrchestrator()

import httpx

@router.post("/chat")
async def chat_with_agent(chat_request: ChatRequest, request: Request, orchestrator: OrchestratorPort = Depends(get_orchestrator)):
    try:
        if not chat_request.blueprint.agents:
            raise HTTPException(status_code=400, detail="Blueprint must contain at least one agent. Please add an agent to the canvas.")

        # Extract BYOK headers
        api_keys = {
            "groq": request.headers.get("x-groq-api-key", ""),
            "openai": request.headers.get("x-openai-api-key", ""),
            "local": request.headers.get("x-local-ai-url", "http://localhost:11434")
        }
        
        # Inject into blueprint payload
        chat_request.blueprint.api_keys = api_keys
        
        # Fetch Langfuse keys from Internal API
        try:
            NEXTJS_URL = os.getenv("NEXTJS_URL", "http://localhost:3000")
            INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "nodebook-secret-dev")
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {"Authorization": f"Bearer {INTERNAL_SECRET}"}
                resp = await client.get(f"{NEXTJS_URL}/api/internal/blueprints/{chat_request.blueprint.id}/secrets", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("success"):
                        secrets = data.get("secrets", {})
                        chat_request.blueprint.langfuse_public_key = secrets.get("langfusePublicKey")
                        chat_request.blueprint.langfuse_secret_key = secrets.get("langfuseSecretKey")
                        chat_request.blueprint.langfuse_host = secrets.get("langfuseHost")
        except Exception as e:
            print(f"Failed to fetch langfuse secrets: {e}")
        
        # Serialize ChatRequest into dict
        payload = {
            "blueprint": chat_request.blueprint.dict(),
            "messages": [m.dict() for m in chat_request.messages]
        }

        # Inject trace_id into payload
        trace_id = request.headers.get("X-Trace-Id", str(uuid.uuid4()))
        payload["trace_id"] = trace_id

        # Submit task via OrchestratorPort
        task_id = orchestrator.submit_agent_run(chat_request.blueprint.id, payload)
        
        return {
            "message": "Chat task submitted successfully.",
            "blueprint_id": chat_request.blueprint.id,
            "task_id": task_id,
            "trace_id": trace_id,
            "status": "Processing"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class ApprovalRequest(BaseModel):
    task_id: str
    tool_name: str
    action: Literal["approve", "reject"]

@router.post("/approve")
async def approve_tool(req: ApprovalRequest, orchestrator: OrchestratorPort = Depends(get_orchestrator)):
    try:
        success = orchestrator.send_signal(req.task_id, req.tool_name, {"action": req.action})
        if not success:
            raise Exception("Failed to send approval signal")
        return {"status": "success", "message": f"Tool {req.tool_name} {req.action}d"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class TestConnectionRequest(BaseModel):
    provider: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: str

@router.post("/test-connection")
async def test_llm_connection(req: TestConnectionRequest):
    """
    Tests an LLM connection by instantiating the model and calling it with a simple prompt.
    """
    if not req.model:
        raise HTTPException(status_code=400, detail="Model name is required for testing.")
        
    try:
        factory = LangchainLLMFactory()
        llm = factory.create_llm(
            provider=req.provider,
            model_id=req.model,
            api_key=req.api_key,
            base_url=req.base_url or ""
        )
        
        # Send a simple hello message
        response = llm.invoke("Hello. Reply 'OK' if you receive this.")
        return {"status": "success", "message": str(response.content)}
        
    except Exception as e:
        # Return 400 so the client knows it's an error and can display the detail
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")
