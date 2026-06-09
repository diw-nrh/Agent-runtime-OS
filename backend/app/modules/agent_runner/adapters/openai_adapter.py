from typing import List, AsyncGenerator
from langchain_core.messages import BaseMessage, AIMessage
from app.modules.agent_runner.ports.llm_port import LLMPort

class OpenAIAdapter(LLMPort):
    """
    Real implementation of the LLMPort using OpenAI API.
    To be implemented fully when API keys are available.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate_reply(self, messages: List[BaseMessage], system_prompt: str, model_id: str) -> BaseMessage:
        # Placeholder for actual LangChain ChatOpenAI invocation
        return AIMessage(content="OpenAI Adapter is not fully implemented yet.")

    async def stream_reply(self, messages: List[BaseMessage], system_prompt: str, model_id: str) -> AsyncGenerator[str, None]:
        yield "OpenAI "
        yield "Streaming "
        yield "Not Implemented"
