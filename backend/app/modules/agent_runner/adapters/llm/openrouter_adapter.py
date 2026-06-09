import os
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

class OpenRouterAdapter:
    """
    LLM Adapter using OpenRouter (unified API for OpenAI, Anthropic, Google, Meta, etc.).
    This utilizes the OpenAI SDK format provided by langchain-openai.
    """
    def __init__(self, model_id: str = "openai/gpt-4o-mini", api_key: str = None, base_url: str = None):
        self.api_key = api_key
        if not self.api_key:
            raise ValueError("API Key is missing for this provider. Please configure it in your Settings (BYOK).")
            
        self.model_id = model_id
        self.base_url = base_url or "https://api.openai.com/v1"
        
        self.llm = ChatOpenAI(
            model=self.model_id,
            api_key=self.api_key,
            base_url=self.base_url,
            default_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Nodebook OS",
            }
        )

    def get_model(self, tools: list = None):
        """Returns the configured ChatOpenAI instance, optionally with tools bound."""
        if tools:
            return self.llm.bind_tools(tools)
        return self.llm

    def generate(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> str:
        """
        Convert list of dicts to LangChain Message objects and generate response.
        """
        lc_messages = []
        if system_prompt:
            lc_messages.append(SystemMessage(content=system_prompt))
            
        for msg in messages:
            if msg["role"] == "user":
                lc_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                lc_messages.append(AIMessage(content=msg["content"]))
            elif msg["role"] == "system":
                lc_messages.append(SystemMessage(content=msg["content"]))
                
        response = self.llm.invoke(lc_messages)
        return response.content

    async def agenerate(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> str:
        """
        Async version of generation
        """
        lc_messages = []
        if system_prompt:
            lc_messages.append(SystemMessage(content=system_prompt))
            
        for msg in messages:
            if msg["role"] == "user":
                lc_messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                lc_messages.append(AIMessage(content=msg["content"]))
            elif msg["role"] == "system":
                lc_messages.append(SystemMessage(content=msg["content"]))
                
        response = await self.llm.ainvoke(lc_messages)
        return response.content
