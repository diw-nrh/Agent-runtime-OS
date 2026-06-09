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
    async def event_generator():
        pubsub = redis_client.pubsub()
        pubsub.subscribe(f"agent_stream_{task_id}")
        
        while True:
            if await request.is_disconnected():
                break
                
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                data_str = message['data'].decode('utf-8')
                yield {"data": data_str}
                
                try:
                    data_json = json.loads(data_str)
                    if data_json.get("status") in ["COMPLETED", "ERROR"]:
                        break
                except:
                    pass
            
            await asyncio.sleep(0.5)
            
    return EventSourceResponse(event_generator())
