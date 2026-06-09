from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
import os

# 1. Calculator Tool
@tool
def calculator(expression: str) -> str:
    """Useful for when you need to answer questions about math or calculations. Input should be a valid mathematical expression."""
    try:
        allowed_names = {"__builtins__": None}
        result = eval(expression, allowed_names, {})
        return str(result)
    except Exception as e:
        return f"Error evaluating expression: {e}"

# 2. Web Search Tool
@tool
def web_search(query: str) -> str:
    """Useful for finding up-to-date information, news, or facts on the internet. Input should be a search query."""
    try:
        search = DuckDuckGoSearchRun()
        return search.run(query)
    except Exception as e:
        return f"Error performing web search: {e}"

# 3. File Reader Tool
@tool
def read_file(filepath: str) -> str:
    """Useful for reading the contents of a local file. Input should be the absolute or relative path to the file."""
    try:
        if not os.path.exists(filepath):
            return f"Error: File '{filepath}' does not exist."
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Truncate if file is too large to prevent blowing up context limits
            return content[:5000] + "\n...[TRUNCATED]" if len(content) > 5000 else content
    except Exception as e:
        return f"Error reading file: {e}"

# Dictionary for mapping tool ID to the actual tool function
TOOL_REGISTRY_MAP = {
    "calculator": calculator,
    "web_search": web_search,
    "read_file": read_file
}

mcp_tools = list(TOOL_REGISTRY_MAP.values())
