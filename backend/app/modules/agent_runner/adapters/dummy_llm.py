import asyncio
from typing import List, AsyncGenerator
from langchain_core.messages import BaseMessage, AIMessage
from app.modules.agent_runner.ports.llm_port import LLMPort

class DummyLLMAdapter(LLMPort):
    """
    A mock adapter to test the LangGraph state machine without incurring API costs.
    """
    async def generate_reply(self, messages: List[BaseMessage], system_prompt: str, model_id: str) -> BaseMessage:
        # Simulate processing time
        await asyncio.sleep(1)
        last_msg = messages[-1].content if messages else "No input"
        return AIMessage(content=f"[DUMMY {model_id}] Received: {last_msg}. System: {system_prompt[:20]}...")

    async def stream_reply(self, messages: List[BaseMessage], system_prompt: str, model_id: str) -> AsyncGenerator[str, None]:
        reply = f"[DUMMY {model_id}] Streaming response based on system prompt..."
        for word in reply.split(" "):
            yield word + " "
            await asyncio.sleep(0.1)
