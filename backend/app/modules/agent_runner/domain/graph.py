from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent
from app.modules.agent_runner.domain.state import AgentState
from app.modules.agent_runner.domain.models import AgentBlueprint
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from app.modules.mcp_gateway.tools import TOOL_REGISTRY_MAP

from langgraph.types import Command
from langchain_core.messages import SystemMessage

def create_handoff_tool(target_agent_id: str, target_agent_name: str, target_agent_system: str):
    safe_id = target_agent_id.replace("-", "_")
    tool_name = f"transfer_to_{safe_id}"
    
    @tool(tool_name)
    def handoff_tool(task_instruction: str):
        f"""
        Call this tool to hand off the task to {target_agent_name}.
        Their system prompt / role is: {target_agent_system[:200]}...
        Provide a clear `task_instruction` of what they need to do.
        """
        return Command(
            goto=target_agent_id,
            update={
                "messages": [
                    SystemMessage(content=f"You have been handed control of the task by the previous agent. Instructions: {task_instruction}")
                ],
                "active_agent": target_agent_id
            }
        )
    
    return handoff_tool

def build_agent_graph(blueprint: AgentBlueprint, mcp_tool_map: dict = None):
    """
    Dynamically builds a LangGraph StateGraph connecting multiple Agents using a Swarm Architecture.
    """
    mcp_tool_map = mcp_tool_map or {}
    workflow = StateGraph(AgentState)

    if not blueprint.agents:
        raise ValueError("Blueprint must contain at least one agent.")

    # Pre-calculate connections to generate handoff tools or direct edges
    agent_map = {a.id: a for a in blueprint.agents}
    
    delegate_edges = {a.id: [] for a in blueprint.agents}
    sequential_edges = {a.id: [] for a in blueprint.agents}
    
    for edge in blueprint.edges:
        mode = edge.data.get("mode", edge.mode) if edge.data else edge.mode
        if mode == "delegate":
            if edge.source in delegate_edges:
                delegate_edges[edge.source].append(edge.target)
        elif mode == "sequential":
            if edge.source in sequential_edges:
                sequential_edges[edge.source].append(edge.target)

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
        for tool_obj in agent.tools:
            if isinstance(tool_obj, dict):
                tool_id = tool_obj.get("id")
                if tool_id in mcp_tool_map:
                    requested_tools.extend(mcp_tool_map[tool_id])
            elif isinstance(tool_obj, str):
                tool_id = tool_obj
                
            if tool_id in TOOL_REGISTRY_MAP:
                requested_tools.append(TOOL_REGISTRY_MAP[tool_id])
                
        # Inject Handoff Tools based on delegate edges
        for target_id in delegate_edges[agent.id]:
            if target_id in agent_map:
                target_agent = agent_map[target_id]
                        
                handoff = create_handoff_tool(
                    target_agent.id, 
                    target_agent.name, 
                    target_agent.system_prompt or "Helpful Assistant"
                )
                requested_tools.append(handoff)
        
        # Append agent note and edge instructions to the system prompt
        final_system_prompt = agent.system_prompt
        
        # Backward compatibility for old agent_note
        if getattr(agent, "agent_note", None) and str(agent.agent_note).strip():
            final_system_prompt += "\n\n## Agent Note\n" + str(agent.agent_note).strip()
            
        # Append edge connections (Swarm Routing Logic)
        outgoing_edges = [e for e in blueprint.edges if e.source == agent.id]
        if outgoing_edges:
            final_system_prompt += "\n\n## Available Agents (Outgoing Connections)\n"
            final_system_prompt += "You have connections to the following agents. You can delegate tasks to them based on their capabilities:\n"
            for edge in outgoing_edges:
                target_agent = agent_map.get(edge.target)
                if target_agent:
                    mode = edge.data.get("mode", edge.mode) if edge.data else edge.mode
                    mode_str = mode.capitalize()
                    
                    # Extract a short summary of the target agent's capability
                    sys_desc = target_agent.system_prompt.strip() if target_agent.system_prompt else "General Assistant"
                    sys_snippet = (sys_desc[:150] + "...") if len(sys_desc) > 150 else sys_desc
                    sys_snippet = sys_snippet.replace('\n', ' ')
                    
                    if mode == "delegate":
                        safe_id = target_agent.id.replace("-", "_")
                        final_system_prompt += f"\n- **{target_agent.name}** (Tool: `transfer_to_{safe_id}`): {sys_snippet}"
                    else:
                        final_system_prompt += f"\n- **{target_agent.name}** (Sequential Handoff): {sys_snippet}"
        
        # create_react_agent returns a compiled graph that acts as a Node
        agent_node = create_react_agent(
            model=llm, 
            tools=requested_tools,
            prompt=final_system_prompt
        )
        workflow.add_node(agent.id, agent_node)

    # 2. Connect all nodes
    # If they want to delegate, they will call a handoff tool which returns a Command(goto=...) to intercept.
    # Otherwise, they follow sequential edges or go to END.
    for agent in blueprint.agents:
        seq_targets = sequential_edges.get(agent.id, [])
        if not seq_targets:
            workflow.add_edge(agent.id, END)
        else:
            for target in seq_targets:
                workflow.add_edge(agent.id, target)

    # 3. Find the Entry Point (Nodes with no incoming edges)
    target_ids = {e.target for e in blueprint.edges}
    start_nodes = [a.id for a in blueprint.agents if a.id not in target_ids]
    
    if not start_nodes:
        # Fallback to the first agent if circular or missing
        start_nodes = [blueprint.agents[0].id]
        
    workflow.set_entry_point(start_nodes[0])
    
    return workflow.compile()
