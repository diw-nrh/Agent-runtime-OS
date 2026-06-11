import json
import asyncio
import redis
import os
from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import Literal
from app.modules.agent_runner.domain.models import AgentBlueprint
from app.modules.agent_runner.tasks import run_agent_pipeline
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
            
from app.modules.agent_runner.domain.models import AgentBlueprint, ChatRequest

@router.post("/chat")
async def chat_with_agent(chat_request: ChatRequest, request: Request):
    try:
        # Extract BYOK headers
        api_keys = {
            "groq": request.headers.get("x-groq-api-key", ""),
            "openai": request.headers.get("x-openai-api-key", ""),
            "local": request.headers.get("x-local-ai-url", "http://localhost:11434")
        }
        
        # Inject into blueprint payload
        chat_request.blueprint.api_keys = api_keys
        
        # Serialize ChatRequest into dict
        payload = {
            "blueprint": chat_request.blueprint.dict(),
            "messages": [m.dict() for m in chat_request.messages]
        }

        # Kick off background job
        from app.modules.agent_runner.tasks import run_agent_pipeline
        task = run_agent_pipeline.delay(payload)
        
        return {
            "message": "Chat task submitted successfully.",
            "blueprint_id": chat_request.blueprint.id,
            "task_id": task.id,
            "status": "Processing"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class ApprovalRequest(BaseModel):
    task_id: str
    tool_name: str
    action: Literal["approve", "reject"]

@router.post("/approve")
async def approve_tool(req: ApprovalRequest):
    try:
        channel = f"agent_approval_{req.task_id}_{req.tool_name}"
        redis_client.publish(channel, json.dumps({"action": req.action}))
        return {"status": "success", "message": f"Tool {req.tool_name} {req.action}d"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
