from langgraph.graph import StateGraph, END
from langgraph.prebuilt import create_react_agent
from app.modules.agent_runner.domain.state import AgentState
from app.modules.agent_runner.domain.models import AgentBlueprint
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool, InjectedToolCallId
from app.modules.mcp_gateway.tools import TOOL_REGISTRY_MAP
from typing import Annotated

from langgraph.types import Command
from langchain_core.messages import SystemMessage, ToolMessage, AIMessage, HumanMessage
from langchain_core.runnables import Runnable
import re
import json
import uuid
import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_hijack_redis = redis.from_url(REDIS_URL)

class DeterministicToolWrapper(Runnable):
    """
    A wrapper around the ChatModel that enforces deterministic tool execution.
    Scans the system prompt for `@Alias[MCP_ToolName]`.
    If the AI's response starts with `@Alias` or `[MCP_ToolName]`, 
    it hijacks the response, strips out the alias/tool name, and forces 
    a Tool Call execution with the remaining text as the argument.
    """
    class Config:
        arbitrary_types_allowed = True
    
    def __init__(self, llm, task_id=None, max_tool_calls=1):
        super().__init__()
        object.__setattr__(self, 'bound', llm)
        object.__setattr__(self, '_task_id', task_id)
        object.__setattr__(self, '_max_tool_calls', max_tool_calls)  # -1 = unlimited
    
    def _publish_debug(self, debug_data: dict):
        """Publish debug info to Redis so frontend debugger can show it."""
        if self._task_id:
            try:
                _hijack_redis.publish(f"agent_stream_{self._task_id}", json.dumps({
                    "status": "TRACE_STEP",
                    "message": "New trace step",
                    "data": debug_data
                }))
            except Exception:
                pass
    
    def __getattr__(self, name):
        """Delegate any missing attributes (bind_tools, with_config, etc.) to the underlying LLM."""
        return getattr(object.__getattribute__(self, 'bound'), name)
    
    def bind_tools(self, *args, **kwargs):
        """Override bind_tools to keep the wrapper around the new bound LLM."""
        new_llm = self.bound.bind_tools(*args, **kwargs)
        wrapper = DeterministicToolWrapper(new_llm, task_id=self._task_id, max_tool_calls=self._max_tool_calls)
        return wrapper
        
    def invoke(self, input, config=None, **kwargs):
        return self.bound.invoke(input, config=config, **kwargs)
        
    async def ainvoke(self, inputs, config=None, **kwargs):
        return await self._ainvoke_with_fallback(inputs, config, **kwargs)
        
    async def _ainvoke_with_fallback(self, inputs, config=None, **invoke_kwargs):
        target_tool_name = None
        alias_used = None
        tool_call_count = 0
        max_calls = self._max_tool_calls  # -1 = unlimited, 1 = default
        
        messages = inputs.get("messages", []) if isinstance(inputs, dict) else inputs
        
        if messages:
            for msg in messages:
                msg_type = msg.get("type", "") if isinstance(msg, dict) else getattr(msg, "type", "")
                msg_class = "" if isinstance(msg, dict) else msg.__class__.__name__
                
                if msg_type == "system" or msg_class == "SystemMessage":
                    content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
                    if not isinstance(content, str):
                        content = str(content)
                    
                    # Use a robust regex that ignores HTML tags and spaces, makes @alias optional, and tolerates missing closing bracket
                    match = re.search(r'(?:@(\w+)\s*(?:<[^>]+>)*\s*)?\[(\w+)(?:\])?', content)
                    if match:
                        alias_used = match.group(1)
                        target_tool_name = match.group(2)
                
                elif msg_type == "human" or msg_class == "HumanMessage":
                    tool_call_count = 0  # Reset counter on new human message
                    
                elif msg_type == "ai" or msg_class == "AIMessage":
                    tool_calls = msg.get("tool_calls", []) if isinstance(msg, dict) else getattr(msg, "tool_calls", [])
                    for tc in tool_calls:
                        if tc.get("name") == target_tool_name:
                            tool_call_count += 1

        # If tool has been called enough times, inject stop warning. (-1 = unlimited, skip this)
        tool_limit_reached = (max_calls != -1 and tool_call_count >= max_calls)
        if tool_limit_reached and target_tool_name:
            stop_warning = SystemMessage(content=f"SYSTEM ALERT: You have successfully used the requested tool {tool_call_count} time(s). The maximum allowed is {max_calls}. DO NOT call any more tools. Please output a brief final response to the user and stop.")
            if isinstance(inputs, dict):
                inputs = {**inputs, "messages": messages + [stop_warning]}
            else:
                inputs = messages + [stop_warning]

        try:
            result = await self.bound.ainvoke(inputs, config, **invoke_kwargs)
        except Exception as e:
            error_msg = str(e)
            if "tool_use_failed" in error_msg or "<function=" in error_msg:
                xml_match = re.search(r'<function=([^>]+)>(.*?)(?:</function>)?', error_msg, re.DOTALL)
                if xml_match:
                    fallback_tool_name = xml_match.group(1).strip()
                    args_str = xml_match.group(2).strip()
                    try:
                        fallback_args = json.loads(args_str)
                    except json.JSONDecodeError:
                        fallback_args = {}
                    return AIMessage(
                        content="",
                        tool_calls=[{"name": fallback_tool_name, "args": fallback_args, "id": f"call_{uuid.uuid4().hex[:8]}"}]
                    )
            raise e
        
        # === DEBUG LOG: Always show what the AI returned ===
        ai_content = getattr(result, 'content', '') or ''
        ai_tool_calls = getattr(result, 'tool_calls', []) or []
        hijack_will_fire = bool(target_tool_name and not tool_limit_reached and not ai_tool_calls and isinstance(ai_content, str))
        
        debug_info = {
            "target_tool": target_tool_name,
            "tool_limit_reached": tool_limit_reached,
            "ai_raw_content": ai_content[:500] if ai_content else "",
            "ai_native_tool_calls": [{"name": tc.get("name", ""), "args": tc.get("args", {})} for tc in ai_tool_calls] if ai_tool_calls else [],
            "hijack_will_fire": hijack_will_fire
        }
        print(f"\n[AI DEBUG] {json.dumps(debug_info, ensure_ascii=False, default=str)}\n")
        
        # Publish to frontend debugger
        self._publish_debug({
            "stepIndex": -1,
            "agentId": "system",
            "type": "AI_DEBUG",
            "content": debug_info
        })
        
        if target_tool_name and not tool_limit_reached and not result.tool_calls and isinstance(result.content, str):
            content = result.content.strip()
            # Check if AI output starts with @alias or [tool]
            if (alias_used and content.startswith(f"@{alias_used}")) or content.startswith(f"[{target_tool_name}]") or len(content) > 0:
                raw_arg = content
                
                # 1. Strip the alias and tool name from the content
                if alias_used:
                    raw_arg = re.sub(rf'@{alias_used}\s*(?:<[^>]+>)*\s*', '', raw_arg)
                
                # Remove [tool_name
                raw_arg = re.sub(rf'\[{target_tool_name}\b', '', raw_arg)
                
                raw_arg = raw_arg.strip()
                
                # Strip leading brackets, parentheses, quotes, colons, commas, and spaces
                raw_arg = re.sub(r'^[\(\[\]\"\'\:\,\s]+', '', raw_arg)
                
                # Strip hallucinated parameter names like message=" or text=
                raw_arg = re.sub(r'^(?:message|msg|text)\s*=\s*[\"\']?', '', raw_arg, flags=re.IGNORECASE)
                
                # Strip hallucinated @AgentName or @alias prefixes that AI prepends to the message
                raw_arg = re.sub(r'^@\w+\s*', '', raw_arg)
                
                # 3. Try to extract JSON arguments if AI tried to be clever: {"message": "hi"} or [tool_name, {"message": "hi"}]
                json_match = re.search(r'(\{.*?\})', content, re.DOTALL)
                args = None
                if json_match:
                    try:
                        parsed_args = json.loads(json_match.group(1))
                        if isinstance(parsed_args, dict):
                            args = parsed_args
                    except json.JSONDecodeError:
                        pass
                
                # 4. If no valid JSON was found, clean the raw string argument
                if not args:
                    # Strip trailing brackets, parentheses, quotes, and spaces
                    clean_arg = re.sub(r'[\)\[\]\"\'\s]+$', '', raw_arg)
                    
                    if not clean_arg and isinstance(messages, list):
                        for m in reversed(messages):
                            msg_type = m.get("type", "") if isinstance(m, dict) else getattr(m, "type", "")
                            msg_class = "" if isinstance(m, dict) else m.__class__.__name__
                            if msg_type == "human" or msg_class == "HumanMessage":
                                clean_arg = m.get("content", "") if isinstance(m, dict) else getattr(m, "content", "")
                                if not isinstance(clean_arg, str):
                                    if isinstance(clean_arg, list):
                                        clean_arg = " ".join([str(x.get("text", "")) if isinstance(x, dict) else str(x) for x in clean_arg])
                                    else:
                                        clean_arg = str(clean_arg)
                                clean_arg = clean_arg.strip()
                                break
                    
                    # Hardcode fallback to 'message' for now
                    args = {"message": clean_arg}
                
                # === DEBUG LOG: Show the hijack process ===
                print(f"\n{'='*60}")
                print(f"[HIJACK DEBUG] AI Raw Output: {content}")
                print(f"[HIJACK DEBUG] After Cleaning: {raw_arg}")
                print(f"[HIJACK DEBUG] Final Args: {args}")
                print(f"[HIJACK DEBUG] Target Tool: {target_tool_name}")
                print(f"{'='*60}\n")
                
                return AIMessage(
                    content="",
                    tool_calls=[{
                        "name": target_tool_name,
                        "args": args,
                        "id": f"call_{uuid.uuid4().hex[:8]}"
                    }],
                    id=getattr(result, 'id', None),
                    response_metadata=getattr(result, 'response_metadata', {})
                )
        return result

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

def build_agent_graph(blueprint: AgentBlueprint, mcp_tool_map: dict = None, task_id: str = None):
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
                        
                # Extract tools and sub-agents of the target agent to inform the parent agent
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
                    
                    # Extract tools and sub-agents of the target agent to inform the parent agent
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
        
        # Wrap llm with DeterministicToolWrapper to intercept @Alias@[MCP_ToolName]
        wrapped_llm = DeterministicToolWrapper(llm, task_id=task_id, max_tool_calls=agent.max_tool_calls)
        
        # create_react_agent returns a compiled graph that acts as a Node
        agent_node = create_react_agent(
            model=wrapped_llm, 
            tools=requested_tools,
            prompt=final_system_prompt
        )
        workflow.add_node(agent.id, agent_node)

    # 2. Connect all nodes
    # If they want to delegate, they will call a handoff tool which returns a Command(goto=...) to intercept.
    # Otherwise, they follow sequential edges or go to END.
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

    # 3. Find the Entry Point (Nodes with no incoming edges)
    if start_agents:
        start_nodes = list(start_agents)
    else:
        target_ids = {e.target for e in blueprint.edges if e.target not in io_node_ids}
        start_nodes = [a.id for a in blueprint.agents if a.id not in target_ids]
    
    if not start_nodes:
        # Fallback to the first agent if circular or missing
        start_nodes = [blueprint.agents[0].id]
        
    workflow.set_entry_point(start_nodes[0])
    
    return workflow.compile()
