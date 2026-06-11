from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class LLMFactoryPort(ABC):
    @abstractmethod
    def create_llm(self, provider: str, model_id: str, api_key: str, base_url: str, default_headers: Optional[Dict[str, str]] = None) -> Any:
        """Create and return an LLM instance based on the provider and configuration."""
        pass
