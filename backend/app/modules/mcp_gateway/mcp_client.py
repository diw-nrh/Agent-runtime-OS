import asyncio
from contextlib import AsyncExitStack
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client, get_default_environment
import mcp.client.stdio
from langchain_mcp_adapters.tools import load_mcp_tools
from app.modules.agent_runner.domain.models import AgentBlueprint

from langchain_core.tools import BaseTool

def wrap_tool_with_approval(tool: BaseTool, task_id: str) -> BaseTool:
    original_arun = tool._arun
    
    async def wrapped_arun(*args, **kwargs):
        import redis.asyncio as redis_async
        import redis
        import json
        import os
        
        REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        async_redis = redis_async.from_url(REDIS_URL)
        sync_redis = redis.from_url(REDIS_URL)
        
        channel = f"agent_approval_{task_id}_{tool.name}"
        pubsub = async_redis.pubsub()
        await pubsub.subscribe(channel)
        
        payload = {
            "status": "TOOL_APPROVAL_REQUEST",
            "message": f"Tool {tool.name} requires approval",
            "data": {
                "toolName": tool.name,
                "args": kwargs or args
            }
        }
        
        sync_redis.publish(f"agent_stream_{task_id}", json.dumps(payload))
        
        approved = False
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    if data.get("action") == "approve":
                        approved = True
                        break
                    else:
                        break
        finally:
            await pubsub.unsubscribe(channel)
            await async_redis.aclose()
            
        if not approved:
            return f"Error: Human denied permission to execute tool {tool.name}."
            
        return await original_arun(*args, **kwargs)

    tool._arun = wrapped_arun
    return tool

async def load_mcp_tools_for_blueprint(blueprint: AgentBlueprint, stack: AsyncExitStack, task_id: str = None) -> dict:
    """
    Connects to all MCP servers defined in the blueprint and returns a map of tool_id -> list of Langchain tools.
    The AsyncExitStack keeps the connections open while the agent runs.
    """
    tool_map = {}
    
    # Collect all unique MCP tools from all agents
    all_tools = []
    for agent in blueprint.agents:
        for tool in agent.tools:
            # tool is a dict, e.g., {'id': '...', 'type': 'sse', 'url': '...', 'command': '...', 'args': '...'}
            if isinstance(tool, dict) and "type" in tool:
                all_tools.append(tool)
                
    # Deduplicate tools by ID
    unique_tools = {t["id"]: t for t in all_tools}.values()
    
    for tool in unique_tools:
        tool_id = tool["id"]
        tool_type = tool.get("type", "sse")
        
        try:
            if tool_type == "sse" and tool.get("url"):
                # Connect via SSE
                read_stream, write_stream = await stack.enter_async_context(sse_client(tool["url"]))
                session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
                await asyncio.wait_for(session.initialize(), timeout=10.0)
                # Load tools
                
                # Check if load_mcp_tools is async
                tools_res = load_mcp_tools(session)
                if asyncio.iscoroutine(tools_res):
                    lc_tools = await asyncio.wait_for(tools_res, timeout=10.0)
                else:
                    lc_tools = tools_res
                    
                permissions = tool.get("permissions", {})
                global_perm = permissions.get("global", "allow")
                tool_perms = permissions.get("tools", {})
                
                filtered_tools = []
                for t in lc_tools:
                    perm = tool_perms.get(t.name, "ask") if global_perm == "custom" else global_perm
                    if perm == "block":
                        continue
                    if perm == "ask" and task_id:
                        t = wrap_tool_with_approval(t, task_id)
                    filtered_tools.append(t)
                    
                tool_map[tool_id] = filtered_tools
                
            elif tool_type == "stdio" and tool.get("command"):
                # Connect via Stdio
                command = tool["command"]
                args = tool.get("args", [])
                
                # Check if it's a string, if so split it (fallback)
                if isinstance(args, str):
                    import shlex
                    args = shlex.split(args)
                    
                server_params = mcp.client.stdio.StdioServerParameters(
                    command=command,
                    args=args,
                    env=get_default_environment()
                )
                read_stream, write_stream = await stack.enter_async_context(stdio_client(server_params))
                session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
                await asyncio.wait_for(session.initialize(), timeout=10.0)
                
                tools_res = load_mcp_tools(session)
                if asyncio.iscoroutine(tools_res):
                    lc_tools = await asyncio.wait_for(tools_res, timeout=10.0)
                else:
                    lc_tools = tools_res
                    
                permissions = tool.get("permissions", {})
                global_perm = permissions.get("global", "allow")
                tool_perms = permissions.get("tools", {})
                
                filtered_tools = []
                for t in lc_tools:
                    perm = tool_perms.get(t.name, "ask") if global_perm == "custom" else global_perm
                    if perm == "block":
                        continue
                    if perm == "ask" and task_id:
                        t = wrap_tool_with_approval(t, task_id)
                    filtered_tools.append(t)
                    
                tool_map[tool_id] = filtered_tools
                
        except asyncio.TimeoutError:
            print(f"WARNING: Timeout connecting to MCP tool {tool_id} ({tool_type}). Skipping.")
        except Exception as e:
            print(f"Failed to load MCP tool {tool_id}: {e}")
            # If a tool fails to load, we just don't add it to the map
            
    return tool_map
