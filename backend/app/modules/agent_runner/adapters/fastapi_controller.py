import json
import asyncio
import redis
import os
from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from app.modules.agent_runner.domain.models import AgentBlueprint
from app.modules.agent_runner.tasks import run_agent_pipeline

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

@router.get("/stream/{task_id}")
async def stream_agent_events(task_id: str, request: Request):
    """SSE endpoint to stream real-time events from Redis Pub/Sub."""
    from celery.result import AsyncResult
    
    async def event_generator():
        task_result = AsyncResult(task_id)
        if task_result.ready():
            if task_result.state == 'SUCCESS':
                yield {"data": json.dumps({
                    "status": "COMPLETED", 
                    "message": "Task was already completed.", 
                    "data": {"reply": task_result.result.get("reply", "") if isinstance(task_result.result, dict) else str(task_result.result)}
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
                
            # Double check if task finished while we were waiting (in case we missed the pubsub message)
            if AsyncResult(task_id).ready():
                res = AsyncResult(task_id)
                if res.state == 'SUCCESS':
                    yield {"data": json.dumps({"status": "COMPLETED", "message": "Task finished.", "data": {"reply": res.result.get("reply", "") if isinstance(res.result, dict) else str(res.result)}})}
                else:
                    yield {"data": json.dumps({"status": "ERROR", "message": "Task failed."})}
                await asyncio.sleep(1.0)
                break

            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data_str = message['data'].decode('utf-8')
                yield {"data": data_str}
                
                try:
                    data_json = json.loads(data_str)
                    if data_json.get("status") in ["COMPLETED", "ERROR"]:
                        await asyncio.sleep(1.0) # Give client time to receive and close
                        break
                except:
                    pass
            
            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())
            
from app.modules.agent_runner.domain.models import AgentBlueprint, ChatRequest
from app.modules.agent_runner.chat_streamer import stream_agent_chat

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

        return EventSourceResponse(stream_agent_chat(chat_request))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
