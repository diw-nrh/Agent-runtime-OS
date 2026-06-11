from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import asyncio
from contextlib import AsyncExitStack
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client, get_default_environment
import mcp.client.stdio

from app.modules.mcp_gateway.discovery import registry

router = APIRouter()

class McpTestRequest(BaseModel):
    type: str
    url: Optional[str] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None

@router.get("/tools")
async def get_tools():
    """
    Returns the list of available MCP tools from the registry.
    """
    tools = registry.list_tools()
    return {"tools": tools}

@router.post("/test")
async def test_mcp_connection(req: McpTestRequest):
    """
    Tests an MCP connection and returns the tools it exposes.
    """
    async with AsyncExitStack() as stack:
        try:
            if req.type == "sse" and req.url:
                read_stream, write_stream = await stack.enter_async_context(sse_client(req.url))
            elif req.type == "stdio" and req.command:
                server_params = mcp.client.stdio.StdioServerParameters(
                    command=req.command,
                    args=req.args or [],
                    env=get_default_environment()
                )
                read_stream, write_stream = await stack.enter_async_context(stdio_client(server_params))
            else:
                raise HTTPException(status_code=400, detail="Invalid config for type")

            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await asyncio.wait_for(session.initialize(), timeout=10.0)
            
            # List tools directly from the MCP session
            tools_response = await session.list_tools()
            tools_list = []
            if hasattr(tools_response, "tools"):
                for t in tools_response.tools:
                    tools_list.append({
                        "name": t.name,
                        "description": t.description
                    })
                    
            return {"status": "success", "tools": tools_list}
            
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Connection timeout. Server did not respond to initialize().")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")
