class ToolRegistry:
    def __init__(self):
        # Tools that are actually implemented in tools.py
        self._tools = [
            {"id": "web_search", "name": "Web Search (DuckDuckGo)", "description": "Search the internet for real-time information."},
            {"id": "read_file", "name": "File Reader", "description": "Read the contents of a file from the local machine."},
            {"id": "calculator", "name": "Calculator", "description": "Perform mathematical calculations."},
        ]

    def list_tools(self):
        return self._tools
        
# Singleton instance for the gateway
registry = ToolRegistry()
