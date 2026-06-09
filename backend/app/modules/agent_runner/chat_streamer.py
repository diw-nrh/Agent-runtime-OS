import json
import asyncio
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from app.modules.agent_runner.domain.models import ChatRequest
from app.modules.agent_runner.domain.graph import build_agent_graph

async def stream_agent_chat(chat_request: ChatRequest):
    try:
        # Build graph
        workflow = build_agent_graph(chat_request.blueprint)

        # Convert simple chat messages to Langchain messages
        lc_messages = []
        for msg in chat_request.messages:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "agent":
                lc_messages.append(AIMessage(content=msg.content))
            else:
                lc_messages.append(SystemMessage(content=msg.content))

        # Stream response
        # Using stream_mode="messages" yields chunks of the LLM response
        async for chunk, metadata in workflow.astream({"messages": lc_messages}, stream_mode="messages"):
            # LangGraph chunk will be an AIMessageChunk
            if hasattr(chunk, "content") and chunk.content:
                yield {"data": json.dumps({
                    "status": "PROCESSING",
                    "chunk": chunk.content
                })}
                
            # Optional small delay to yield to event loop
            await asyncio.sleep(0.01)

        yield {"data": json.dumps({"status": "COMPLETED"})}
    except Exception as e:
        yield {"data": json.dumps({"status": "ERROR", "message": str(e)})}
