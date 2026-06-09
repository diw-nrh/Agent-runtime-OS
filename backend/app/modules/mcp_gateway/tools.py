from langchain_core.tools import tool

@tool
def calculator(expression: str) -> str:
    """Useful for when you need to answer questions about math or calculations. Input should be a valid mathematical expression."""
    try:
        # Warning: eval is dangerous in production, using simple eval for demo purposes
        allowed_names = {"__builtins__": None}
        result = eval(expression, allowed_names, {})
        return str(result)
    except Exception as e:
        return f"Error evaluating expression: {e}"

@tool
def get_weather(location: str) -> str:
    """Useful for finding the current weather in a given location."""
    # Dummy implementation for demo
    return f"The weather in {location} is currently 25°C and sunny."

# This array will be used by the ToolNode and LLM bindings
mcp_tools = [calculator, get_weather]
