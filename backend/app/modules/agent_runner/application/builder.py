from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent, ToolNode
from app.modules.agent_runner.domain.state import AgentState
from app.modules.agent_runner.domain.models import AgentBlueprint
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import SystemMessage, ToolMessage
from langgraph.types import Command
from typing import Annotated, Dict, Any, Optional

# Ports & Adapters
from app.modules.agent_runner.application.ports.llm_factory_port import LLMFactoryPort
from app.modules.agent_runner.application.ports.telemetry_port import TelemetryPort
from app.modules.agent_runner.infrastructure.wrappers.deterministic_tool_wrapper import DeterministicToolWrapper
from app.modules.mcp_gateway.tools import TOOL_REGISTRY_MAP

def create_handoff_tool(target_agent_id: str, target_agent_name: str, target_agent_system: str, target_agent_caps: str = ""):
    safe_id = target_agent_id.replace("-", "_")
    tool_name = f"transfer_to_{safe_id}"
    
    @tool(tool_name)
    def handoff_tool(task_instruction: str, tool_call_id: Annotated[str, InjectedToolCallId]):
        """Call this tool to hand off the task to another agent. Provide a clear task_instruction."""
        return Command(
            goto=target_agent_id,
            graph=Command.PARENT,
            update={
                "messages": [
                    ToolMessage(content=f"Successfully transferred to {target_agent_name}", tool_call_id=tool_call_id),
                    SystemMessage(content=f"You have been handed control of the task by the previous agent. Instructions: {task_instruction}")
                ],
                "active_agent": target_agent_id
            }
        )
    
    handoff_tool.description = f"Call this tool to hand off the task to {target_agent_name}. Their system prompt / role is: {target_agent_system[:200]}... {target_agent_caps} Provide a clear `task_instruction` of what they need to do."
    
    return handoff_tool

def build_agent_graph(
    blueprint: AgentBlueprint, 
    llm_factory: LLMFactoryPort,
    telemetry: Optional[TelemetryPort] = None,
    mcp_tool_map: dict = None, 
    task_id: str = None
):
    """
    Dynamically builds a LangGraph StateGraph connecting multiple Agents using a Swarm Architecture.
    Utilizes Hexagonal Architecture principles via Dependency Injection (LLMFactory and Telemetry).
    """
    mcp_tool_map = mcp_tool_map or {}
    workflow = StateGraph(AgentState)

    if not blueprint.agents:
        raise ValueError("Blueprint must contain at least one agent.")

    # Pre-calculate connections to generate handoff tools or direct edges
    agent_map = {a.id: a for a in blueprint.agents}
    
    delegate_edges = {a.id: [] for a in blueprint.agents}
    sequential_edges = {a.id: [] for a in blueprint.agents}
    
    io_node_ids = {n.id for n in blueprint.nodes if n.type == "io_node"}
    end_agents = set()
    output_agents = set()
    start_agents = set()
    
    for edge in blueprint.edges:
        # Handle IO Node specific edges
        if edge.target in io_node_ids:
            if getattr(edge, 'targetHandle', None) == "end":
                end_agents.add(edge.source)
            elif getattr(edge, 'targetHandle', None) == "output":
                output_agents.add(edge.source)
            continue
            
        if edge.source in io_node_ids:
            if getattr(edge, 'sourceHandle', None) == "input":
                start_agents.add(edge.target)
            continue

        mode = edge.data.get("mode", edge.mode) if edge.data else edge.mode
        if mode == "delegate":
            if edge.source in delegate_edges:
                delegate_edges[edge.source].append(edge.target)
        elif mode == "sequential":
            if edge.source in sequential_edges:
                sequential_edges[edge.source].append(edge.target)

    # Create a telemetry callback if telemetry port is provided
    telemetry_publisher = telemetry.publish_debug if telemetry else None

    # 1. Create a ReAct Sub-Graph for each Agent on the canvas
    for agent in blueprint.agents:
        # Determine the key and base_url based on provider
        provider = agent.llm_provider
        creds = agent.credentials or {}
        
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
            
        # Use Dependency Injection: Let the Factory instantiate the LLM
        llm = llm_factory.create_llm(
            provider=provider,
            model_id=agent.model_id,
            api_key=target_key,
            base_url=base_url
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
                        
                target_tool_names = []
                for t in target_agent.tools:
                    if isinstance(t, dict):
                        target_tool_names.append(t.get("name") or t.get("id"))
                    elif isinstance(t, str):
                        target_tool_names.append(t)
                        
                target_sub_agents = [agent_map[sub_id].name for sub_id in delegate_edges.get(target_agent.id, []) if sub_id in agent_map]
                
                caps = []
                if target_tool_names:
                    caps.append(f"Tools: {', '.join(target_tool_names)}")
                if target_sub_agents:
                    caps.append(f"Sub-agents: {', '.join(target_sub_agents)}")
                caps_str = f"Capabilities -> {'; '.join(caps)}" if caps else ""

                handoff = create_handoff_tool(
                    target_agent.id, 
                    target_agent.name, 
                    target_agent.system_prompt or "Helpful Assistant",
                    caps_str
                )
                requested_tools.append(handoff)
        
        # Append agent note and edge instructions to the system prompt
        final_system_prompt = agent.system_prompt
        
        final_system_prompt += "\n\n## Platform Web Syntax\nPress '/' for commands or type '@' to attach Tools. Use @alias [Agent] to hand off tasks to another Agent."
        
        if getattr(agent, "agent_note", None) and str(agent.agent_note).strip():
            final_system_prompt += "\n\n## Agent Note\n" + str(agent.agent_note).strip()
            
        outgoing_edges = [e for e in blueprint.edges if e.source == agent.id]
        if outgoing_edges:
            final_system_prompt += "\n\n## Available Agents (Outgoing Connections)\n"
            final_system_prompt += "You have connections to the following agents. You can delegate tasks to them based on their capabilities:\n"
            for edge in outgoing_edges:
                target_agent = agent_map.get(edge.target)
                if target_agent:
                    mode = edge.data.get("mode", edge.mode) if edge.data else edge.mode
                    
                    sys_desc = target_agent.system_prompt.strip() if target_agent.system_prompt else "General Assistant"
                    sys_snippet = (sys_desc[:150] + "...") if len(sys_desc) > 150 else sys_desc
                    sys_snippet = sys_snippet.replace('\n', ' ')
                    
                    target_tool_names = []
                    for t in target_agent.tools:
                        if isinstance(t, dict):
                            target_tool_names.append(t.get("name") or t.get("id"))
                        elif isinstance(t, str):
                            target_tool_names.append(t)
                            
                    target_sub_agents = [agent_map[sub_id].name for sub_id in delegate_edges.get(target_agent.id, []) if sub_id in agent_map]
                    
                    caps = []
                    if target_tool_names:
                        caps.append(f"Tools: {', '.join(target_tool_names)}")
                    if target_sub_agents:
                        caps.append(f"Sub-agents: {', '.join(target_sub_agents)}")
                    caps_str = f" [{'; '.join(caps)}]" if caps else ""

                    if mode == "delegate":
                        safe_id = target_agent.id.replace("-", "_")
                        final_system_prompt += f"\n- **{target_agent.name}**{caps_str} (Tool: `transfer_to_{safe_id}`): {sys_snippet}"
                    else:
                        final_system_prompt += f"\n- **{target_agent.name}**{caps_str} (Sequential Handoff): {sys_snippet}"
        
        # User prompt engineering logic: Force a hard prompt to prevent looping if a limit is set
        if agent.max_tool_calls != -1:
            times_word = "once" if agent.max_tool_calls == 1 else "twice" if agent.max_tool_calls == 2 else f"{agent.max_tool_calls} times"
            final_system_prompt += f"\n\n## Tool Usage Limit\nCall the tool just {times_word}, enough, and send the word 'thanks'."
        
        # Wrap llm with DeterministicToolWrapper (DI approach)
        wrapped_llm = DeterministicToolWrapper(
            llm, 
            task_id=task_id, 
            max_tool_calls=agent.max_tool_calls, 
            max_memory_messages=agent.max_memory_messages,
            telemetry_publisher=telemetry_publisher
        )
        
        tool_node = ToolNode(requested_tools, handle_tool_errors=True) if requested_tools else []
        
        agent_node = create_react_agent(
            model=wrapped_llm, 
            tools=tool_node,
            prompt=final_system_prompt
        )
        workflow.add_node(agent.id, agent_node)

    # 2. Connect all nodes
    for agent in blueprint.agents:
        if agent.id in end_agents:
            workflow.add_edge(agent.id, END)
            continue
            
        seq_targets = sequential_edges.get(agent.id, [])
        if not seq_targets:
            workflow.add_edge(agent.id, END)
        else:
            for target in seq_targets:
                workflow.add_edge(agent.id, target)

    # 3. Find the Entry Point
    if start_agents:
        start_nodes = list(start_agents)
    else:
        target_ids = {e.target for e in blueprint.edges if e.target not in io_node_ids}
        start_nodes = [a.id for a in blueprint.agents if a.id not in target_ids]
    
    if not start_nodes:
        start_nodes = [blueprint.agents[0].id]
        
    workflow.set_entry_point(start_nodes[0])
    
    return workflow.compile()
