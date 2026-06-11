from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Any, Optional

class AgentConfig(BaseModel):
    id: str
    name: str
    system_prompt: str = Field(..., alias="systemPrompt")
    llm_provider: Literal["openai-compatible", "anthropic", "google", "openai", "local", "groq", "gemini"] = Field(..., alias="llmProvider")
    model_id: str = Field(..., alias="modelId")
    tools: List[dict] = Field(default_factory=list)
    agent_note: Optional[str] = Field(None, alias="agentNote")
    credentials: Optional[Dict[str, Optional[str]]] = Field(default_factory=dict)
    
    class Config:
        populate_by_name = True

class NodeConfig(BaseModel):
    id: str
    type: Literal["agent", "condition", "tool", "io_node"]
    data: Dict[str, Any]

class EdgeConfig(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    mode: Literal["sequential", "delegate"] = "delegate"
    data: Optional[Dict[str, Any]] = Field(default_factory=dict)

class AgentBlueprint(BaseModel):
    id: str
    version: str
    agents: List[AgentConfig] = Field(default_factory=list)
    nodes: List[NodeConfig] = Field(default_factory=list)
    edges: List[EdgeConfig] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    api_keys: Optional[Dict[str, str]] = Field(default_factory=dict)

class ChatMessage(BaseModel):
    role: Literal["user", "agent", "system"]
    content: str

class ChatRequest(BaseModel):
    blueprint: AgentBlueprint
    messages: List[ChatMessage]

