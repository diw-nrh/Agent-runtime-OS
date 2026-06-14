from langchain_core.messages import SystemMessage, ToolMessage, AIMessage, HumanMessage
from langchain_core.runnables import Runnable
from typing import Callable, Dict, Optional
import re
import json
import uuid

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
    
    def __init__(self, llm, task_id: Optional[str] = None, max_tool_calls: int = 1, max_memory_messages: int = 10, telemetry_publisher: Optional[Callable[[str, Dict[str, object]], None]] = None, tool_names: list = None, forced_tool_name: Optional[str] = None):
        super().__init__()
        object.__setattr__(self, 'bound', llm)
        object.__setattr__(self, '_task_id', task_id)
        object.__setattr__(self, '_max_tool_calls', max_tool_calls)  # -1 = unlimited
        object.__setattr__(self, '_max_memory_messages', max_memory_messages)  # -1 = unlimited
        object.__setattr__(self, '_telemetry_publisher', telemetry_publisher)
        object.__setattr__(self, '_tool_names', tool_names or [])
        object.__setattr__(self, '_forced_tool_name', forced_tool_name)
    
    def _publish_debug(self, debug_data: dict):
        """Publish debug info via the injected telemetry publisher."""
        if self._task_id and self._telemetry_publisher:
            try:
                self._telemetry_publisher(self._task_id, debug_data)
            except Exception:
                pass
    
    def __getattr__(self, name):
        """Delegate any missing attributes (bind_tools, with_config, etc.) to the underlying LLM."""
        return getattr(object.__getattribute__(self, 'bound'), name)
    
    def bind_tools(self, *args, **kwargs):
        """Override bind_tools to keep the wrapper around the new bound LLM."""
        new_llm = self.bound.bind_tools(*args, **kwargs)
        wrapper = DeterministicToolWrapper(
            new_llm, 
            task_id=self._task_id, 
            max_tool_calls=self._max_tool_calls, 
            max_memory_messages=self._max_memory_messages,
            telemetry_publisher=self._telemetry_publisher,
            tool_names=self._tool_names,
            forced_tool_name=self._forced_tool_name
        )
        return wrapper
        
    def invoke(self, input, config=None, **kwargs):
        return self.bound.invoke(input, config=config, **kwargs)
        
    async def ainvoke(self, input, config=None, **kwargs):
        return await self._ainvoke_with_fallback(input, config, **kwargs)
        
    async def _ainvoke_with_fallback(self, input, config=None, **invoke_kwargs):
        target_tool_name = None
        alias_used = None
        tool_call_count = 0
        max_calls = self._max_tool_calls  # -1 = unlimited, 1 = default
        
        tool_call_counts = {}
        
        if isinstance(input, dict) and "messages" in input:
            messages = input["messages"]
        elif isinstance(input, list):
            messages = input
        else:
            messages = [input]
            
        # Optional: truncate memory if needed
        if self._max_memory_messages > 0:
            if len(messages) > self._max_memory_messages + 2:
                sys_msgs = [m for m in messages if getattr(m, "type", "") == "system" or m.__class__.__name__ == "SystemMessage"]
                other_msgs = [m for m in messages if getattr(m, "type", "") != "system" and m.__class__.__name__ != "SystemMessage"]
                messages = sys_msgs + other_msgs[-self._max_memory_messages:]
                if isinstance(input, dict):
                    input = {**input, "messages": messages}
                else:
                    input = messages
                    
        for msg in messages:
            msg_type = msg.get("type", "") if isinstance(msg, dict) else getattr(msg, "type", "")
            msg_class = "" if isinstance(msg, dict) else msg.__class__.__name__
            
            if msg_type == "human" or msg_class == "HumanMessage":
                tool_call_counts.clear()  # Reset counter on new human message
                
            elif msg_type == "ai" or msg_class == "AIMessage":
                tool_calls = msg.get("tool_calls", []) if isinstance(msg, dict) else getattr(msg, "tool_calls", [])
                for tc in tool_calls:
                    name = tc.get("name")
                    if name:
                        tool_call_counts[name] = tool_call_counts.get(name, 0) + 1

        # Check if ANY tool has reached the limit
        limit_reached_tool = None
        if max_calls != -1:
            for t_name, count in tool_call_counts.items():
                if count >= max_calls:
                    limit_reached_tool = t_name
                    break
                    
        tool_limit_reached = limit_reached_tool is not None
        if tool_limit_reached:
            stop_warning = SystemMessage(content=f"SYSTEM ALERT: You have successfully used the requested tool {limit_reached_tool} {max_calls} time(s). The maximum allowed is {max_calls}. DO NOT call any more tools. Please output a brief final response to the user and stop.")
            if isinstance(input, dict):
                input = {**input, "messages": messages + [stop_warning]}
            else:
                input = messages + [stop_warning]

        try:
            result = await self.bound.ainvoke(input, config, **invoke_kwargs)
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
        
        target_tool_name = None
        alias_used = None
        
        # === SYSTEM PROMPT FORCED TOOL ===
        if getattr(self, '_forced_tool_name', None) and not ai_tool_calls and not tool_limit_reached:
            target_tool_name = self._forced_tool_name
            alias_used = f"[{self._forced_tool_name}]"
            
        # === DYNAMIC TOOL DETECTION ===
        if not target_tool_name and not ai_tool_calls and not tool_limit_reached and isinstance(ai_content, str):
            # Scan AI content for all @tool_name or [tool_name]
            # Pick the first one that is actually a valid tool for this agent
            for match in re.finditer(r'(?:@|\[)(\w+)(?:\])?', ai_content):
                matched_name = match.group(1)
                if matched_name in self._tool_names:
                    target_tool_name = matched_name
                    break

        hijack_will_fire = bool(target_tool_name)
        
        debug_info = {
            "target_tool": target_tool_name,
            "tool_limit_reached": tool_limit_reached,
            "ai_raw_content": ai_content[:500] if ai_content else "",
            "ai_native_tool_calls": [{"name": tc.get("name", ""), "args": tc.get("args", {})} for tc in ai_tool_calls] if ai_tool_calls else [],
            "hijack_will_fire": hijack_will_fire
        }
        print(f"\n[AI DEBUG] {json.dumps(debug_info, ensure_ascii=False, default=str)}\n")
        
        # Publish to frontend debugger via port
        self._publish_debug(debug_info)
        
        if hijack_will_fire:
            content = result.content.strip()
            raw_arg = content
            
            # Remove [tool_name or @tool_name
            raw_arg = re.sub(rf'(?:@|\[){target_tool_name}(?:\])?\b', '', raw_arg)
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
                            
                # HACK: Fast workaround for standard MCP tools that accept an object with various keys
                args = {
                    "message": clean_arg,
                    "text": clean_arg,
                    "query": clean_arg,
                    "prompt": clean_arg,
                    "input": clean_arg,
                    "command": clean_arg
                }
                
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
