from fastapi import APIRouter
from app.modules.mcp_gateway.discovery import registry

router = APIRouter()

@router.get("/tools")
async def get_tools():
    """
    Returns the list of available MCP tools from the registry.
    """
    tools = registry.list_tools()
    return {"tools": tools}
