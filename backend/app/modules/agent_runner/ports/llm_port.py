from abc import ABC, abstractmethod
from typing import List, AsyncGenerator
from langchain_core.messages import BaseMessage

class LLMPort(ABC):
    """
    Port (Interface) for communicating with an LLM Provider.
    Following Hexagonal Architecture, the core domain depends on this port, not the real implementation.
    """
    
    @abstractmethod
    async def generate_reply(self, messages: List[BaseMessage], system_prompt: str, model_id: str) -> BaseMessage:
        pass
        
    @abstractmethod
    async def stream_reply(self, messages: List[BaseMessage], system_prompt: str, model_id: str) -> AsyncGenerator[str, None]:
        pass
