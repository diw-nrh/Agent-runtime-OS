import json
import asyncio
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from app.modules.agent_runner.domain.models import ChatRequest
import os
from app.modules.agent_runner.application.builder import build_agent_graph
from app.modules.agent_runner.infrastructure.adapters.langchain_llm_factory import LangchainLLMFactory
from app.modules.agent_runner.infrastructure.adapters.redis_telemetry import RedisTelemetry
from app.core.config import settings

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

async def stream_agent_chat(chat_request: ChatRequest):
    try:
        # Build graph
        llm_factory = LangchainLLMFactory()
        telemetry = RedisTelemetry(REDIS_URL)
        workflow = build_agent_graph(chat_request.blueprint, llm_factory=llm_factory, telemetry=telemetry)

        # Convert simple chat messages to Langchain messages
        lc_messages = []
        for msg in chat_request.messages:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "agent":
                lc_messages.append(AIMessage(content=msg.content))
            else:
                lc_messages.append(SystemMessage(content=msg.content))

        # Langfuse Tracing
        callbacks = []
        if chat_request.blueprint.langfuse_public_key and chat_request.blueprint.langfuse_secret_key:
            try:
                from langfuse.callback import CallbackHandler
                langfuse_handler = CallbackHandler(
                    secret_key=chat_request.blueprint.langfuse_secret_key,
                    public_key=chat_request.blueprint.langfuse_public_key,
                    host=chat_request.blueprint.langfuse_host or "https://cloud.langfuse.com"
                )
                callbacks.append(langfuse_handler)
            except ImportError:
                print("Langfuse is not installed. Tracing disabled.")

        # Stream response
        # Using stream_mode="messages" yields chunks of the LLM response
        async for chunk, metadata in workflow.astream({"messages": lc_messages}, config={"callbacks": callbacks}, stream_mode="messages"):
            # LangGraph chunk will be an AIMessageChunk
            if hasattr(chunk, "content") and chunk.content:
                yield {"data": json.dumps({
                    "status": "PROCESSING",
                    "chunk": chunk.content
                })}
                
            # Optional small delay to yield to event loop
            await asyncio.sleep(0.01)

        # Flush Langfuse traces
        if 'langfuse_handler' in locals():
            langfuse_handler.flush()
            
        yield {"data": json.dumps({"status": "COMPLETED"})}
    except Exception as e:
        yield {"data": json.dumps({"status": "ERROR", "message": str(e)})}
