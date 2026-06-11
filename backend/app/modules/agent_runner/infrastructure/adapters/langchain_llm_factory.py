from typing import Dict, Any, Optional
from app.modules.agent_runner.application.ports.llm_factory_port import LLMFactoryPort
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI

class LangchainLLMFactory(LLMFactoryPort):
    """
    Concrete implementation of LLMFactoryPort.
    Responsible for instantiating the correct Langchain Chat Model based on the provider.
    """
    def create_llm(self, provider: str, model_id: str, api_key: str, base_url: str, default_headers: Optional[Dict[str, str]] = None) -> Any:
        if not default_headers:
            default_headers = {
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Nodebook OS",
            }
            
        if provider == "anthropic":
            if not api_key:
                raise ValueError("API Key is missing for Anthropic")
            return ChatAnthropic(
                model=model_id,
                api_key=api_key,
                default_headers=default_headers
            )
        elif provider in ["google", "gemini"]:
            if not api_key:
                raise ValueError("API Key is missing for Google Gemini")
            return ChatGoogleGenerativeAI(
                model=model_id,
                api_key=api_key
            )
        else: # openai-compatible, openai, local, groq
            if not base_url:
                if provider == "groq":
                    base_url = "https://api.groq.com/openai/v1"
                elif provider == "openai":
                    base_url = "https://api.openai.com/v1"
                elif provider == "local":
                    base_url = "http://localhost:11434/v1"
                else:
                    base_url = "https://api.openai.com/v1"
            
            if provider in ["local", "openai-compatible"] and not api_key:
                api_key = "dummy"
                
            if not api_key:
                raise ValueError(f"API Key is missing for OpenAI-Compatible Provider ({provider})")

            return ChatOpenAI(
                model=model_id,
                api_key=api_key,
                base_url=base_url,
                default_headers=default_headers
            )
