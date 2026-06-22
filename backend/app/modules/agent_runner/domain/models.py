from pydantic import BaseModel, Field
from typing import List, Literal, Dict, Optional, Union

class AgentConfig(BaseModel):
    id: str
    name: str
    system_prompt: str = Field(..., alias="systemPrompt")
    llm_provider: Literal["openai-compatible", "anthropic", "google", "openai", "local", "groq", "gemini"] = Field(..., alias="llmProvider")
    model_id: str = Field(..., alias="modelId")
    tools: List[Union[dict, str]] = Field(default_factory=list)
    agent_note: Optional[str] = Field(None, alias="agentNote")
    credentials: Optional[Dict[str, Optional[str]]] = Field(default_factory=dict)
    max_tool_calls: int = Field(1, alias="maxToolCalls")  # -1 = unlimited
    max_handoff_bounces: int = Field(1, alias="maxHandoffBounces")  # -1 = unlimited
    max_memory_messages: int = Field(10, alias="maxMemoryMessages")  # -1 = unlimited
    
    class Config:
        populate_by_name = True

class NodeConfig(BaseModel):
    id: str
    type: Literal["agent", "condition", "tool", "io_node"]
    data: Dict[str, object]

class EdgeConfig(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    mode: Literal["sequential", "delegate"] = "delegate"
    data: Optional[Dict[str, object]] = Field(default_factory=dict)

class AgentBlueprint(BaseModel):
    id: str
    version: str
    agents: List[AgentConfig] = Field(default_factory=list)
    nodes: List[NodeConfig] = Field(default_factory=list)
    edges: List[EdgeConfig] = Field(default_factory=list)
    metadata: Optional[Dict[str, object]] = Field(default_factory=dict)
    
    # Langfuse Configurations
    langfuse_public_key: Optional[str] = Field(None, alias="langfusePublicKey")
    langfuse_secret_key: Optional[str] = Field(None, alias="langfuseSecretKey")
    langfuse_host: Optional[str] = Field(None, alias="langfuseHost")
    api_keys: Optional[Dict[str, str]] = Field(default_factory=dict)
    
    class Config:
        populate_by_name = True

class ChatMessage(BaseModel):
    role: Literal["user", "agent", "system"]
    content: str

class ChatRequest(BaseModel):
    blueprint: AgentBlueprint
    messages: List[ChatMessage]

