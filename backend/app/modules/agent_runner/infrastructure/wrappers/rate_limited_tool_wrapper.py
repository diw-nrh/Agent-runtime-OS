from langchain_core.tools import BaseTool, StructuredTool

def create_rate_limited_tool(original_tool: BaseTool, max_calls: int) -> BaseTool:
    """
    Wraps a LangChain BaseTool with a Circuit Breaker.
    Maintains a localized call count for the lifespan of the created tool.
    If the limit is exceeded, it intercepts execution and returns a fake ToolMessage
    with an alert to instruct the LLM to stop calling it.
    """
    # If unlimited, return original tool directly
    if max_calls == -1:
        return original_tool
        
    # Localized state tracker for this specific tool instance
    state = {"call_count": 0}
    
    def run_wrapper(*args, **kwargs):
        if state["call_count"] >= max_calls:
            return f"SYSTEM ALERT: You have exceeded the maximum allowed calls ({max_calls}) for the tool '{original_tool.name}'. The tool execution was blocked to prevent infinite loops. Please stop calling this tool and proceed with the information you already have."
        
        state["call_count"] += 1
        
        # Determine if original tool takes args or just kwargs
        if kwargs:
            return original_tool.invoke(kwargs)
        elif args:
            return original_tool.invoke(args[0] if len(args) == 1 else args)
        else:
            return original_tool.invoke({})
        
    async def arun_wrapper(*args, **kwargs):
        if state["call_count"] >= max_calls:
            return f"SYSTEM ALERT: You have exceeded the maximum allowed calls ({max_calls}) for the tool '{original_tool.name}'. The tool execution was blocked to prevent infinite loops. Please stop calling this tool and proceed with the information you already have."
            
        state["call_count"] += 1
        
        # Determine if original tool takes args or just kwargs
        if kwargs:
            return await original_tool.ainvoke(kwargs)
        elif args:
            return await original_tool.ainvoke(args[0] if len(args) == 1 else args)
        else:
            return await original_tool.ainvoke({})

    # Wrap the original tool safely
    return StructuredTool(
        name=original_tool.name,
        description=original_tool.description,
        args_schema=original_tool.args_schema,
        func=run_wrapper,
        coroutine=arun_wrapper,
        return_direct=original_tool.return_direct
    )
