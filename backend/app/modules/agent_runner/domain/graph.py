from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent
from app.modules.agent_runner.domain.state import AgentState
from app.modules.agent_runner.domain.models import AgentBlueprint
from app.modules.agent_runner.adapters.llm.openrouter_adapter import OpenRouterAdapter
from app.modules.mcp_gateway.tools import mcp_tools

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
        
        target_key = creds.get("apiKey", "")
        base_url = creds.get("baseUrl", "")
        
        if not base_url:
            if provider == "groq":
                base_url = "https://api.groq.com/openai/v1"
            elif provider == "openai":
                base_url = "https://api.openai.com/v1"
            elif provider == "local":
                base_url = "http://localhost:11434/v1"
            else:
                base_url = "https://openrouter.ai/api/v1"
        
        if provider == "local" and not target_key:
            target_key = "dummy" # Local models often don't need a key
            
        llm = OpenRouterAdapter(
            model_id=agent.model_id, 
            api_key=target_key,
            base_url=base_url
        ).get_model()
        
        # create_react_agent returns a compiled graph that acts as a Node
        agent_node = create_react_agent(
            model=llm, 
            tools=[], # Pass empty tools for now until MCP Tool UI is built
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
