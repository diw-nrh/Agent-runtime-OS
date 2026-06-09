from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent
from app.modules.agent_runner.domain.state import AgentState
from app.modules.agent_runner.domain.models import AgentBlueprint
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from app.modules.mcp_gateway.tools import TOOL_REGISTRY_MAP

def build_agent_graph(blueprint: AgentBlueprint):
    """
    Dynamically builds a LangGraph StateGraph connecting multiple Agents.
    """
    workflow = StateGraph(AgentState)

    if not blueprint.agents:
        raise ValueError("Blueprint must contain at least one agent.")

    # 1. Create a ReAct Sub-Graph for each Agent on the canvas
    for agent in blueprint.agents:
        # Determine the key and base_url based on provider
        provider = agent.llm_provider
        creds = agent.credentials or {}
        
        # Fallback to blueprint level API keys if agent doesn't have it
        target_key = creds.get("apiKey", "")
        base_url = creds.get("baseUrl", "")
        
        if not target_key and blueprint.api_keys:
            if provider == "groq":
                target_key = blueprint.api_keys.get("groq", "")
            elif provider in ["openai", "openai-compatible"]:
                target_key = blueprint.api_keys.get("openai", "")
            elif provider == "anthropic":
                target_key = blueprint.api_keys.get("anthropic", "")
            elif provider in ["google", "gemini"]:
                target_key = blueprint.api_keys.get("google", "")
                
        if not base_url and blueprint.api_keys and provider in ["local", "openai-compatible"]:
            base_url = blueprint.api_keys.get("local", "")
        
        if provider == "anthropic":
            if not target_key:
                raise ValueError(f"API Key is missing for Anthropic (Agent: {agent.name})")
            llm = ChatAnthropic(
                model=agent.model_id,
                api_key=target_key,
                default_headers={"X-Title": "Nodebook OS"}
            )
        elif provider == "google" or provider == "gemini":
            if not target_key:
                raise ValueError(f"API Key is missing for Google Gemini (Agent: {agent.name})")
            llm = ChatGoogleGenerativeAI(
                model=agent.model_id,
                api_key=target_key
            )
        else: # openai-compatible, openai, local, groq
            if not base_url:
                if provider == "groq":
                    base_url = "https://api.groq.com/openai/v1"
                elif provider == "openai":
                    base_url = "https://api.openai.com/v1"
                elif provider == "local":
                    base_url = "http://localhost:11434/v1"
                else: # openai-compatible defaults to openai if empty
                    base_url = "https://api.openai.com/v1"
            
            if (provider == "local" or provider == "openai-compatible") and not target_key:
                target_key = "dummy"
                
            if not target_key:
                raise ValueError(f"API Key is missing for OpenAI-Compatible Provider (Agent: {agent.name})")

            llm = ChatOpenAI(
                model=agent.model_id,
                api_key=target_key,
                base_url=base_url,
                default_headers={
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Nodebook OS",
                }
            )
            
        # Map requested tools from blueprint
        requested_tools = []
        for tool_id in agent.tools:
            if tool_id in TOOL_REGISTRY_MAP:
                requested_tools.append(TOOL_REGISTRY_MAP[tool_id])
        
        # create_react_agent returns a compiled graph that acts as a Node
        agent_node = create_react_agent(
            model=llm, 
            tools=requested_tools,
            prompt=agent.system_prompt
        )
        workflow.add_node(agent.id, agent_node)

    # 2. Connect the nodes according to the edges
    # If no edges, it's just a single node, which is fine
    for edge in blueprint.edges:
        workflow.add_edge(edge.source, edge.target)
        
    # All nodes that don't have outgoing edges should go to END
    source_ids = {e.source for e in blueprint.edges}
    for agent in blueprint.agents:
        if agent.id not in source_ids:
            workflow.add_edge(agent.id, END)

    # 3. Find the Entry Point (Nodes with no incoming edges)
    target_ids = {e.target for e in blueprint.edges}
    start_nodes = [a.id for a in blueprint.agents if a.id not in target_ids]
    
    if not start_nodes:
        # Fallback to the first agent if circular or missing
        start_nodes = [blueprint.agents[0].id]
        
    workflow.set_entry_point(start_nodes[0])
    
    return workflow.compile()
