class ToolRegistry:
    def __init__(self):
        # Simulated list of tools that would normally come from FastMCP or connected local servers
        self._tools = [
            {"id": "file_reader", "name": "File Reader", "description": "Reads local files from the project directory."},
            {"id": "postgres_query", "name": "Postgres Query", "description": "Execute read-only queries against the database."},
            {"id": "github_search", "name": "GitHub Search", "description": "Search repositories and code on GitHub."},
            {"id": "brave_search", "name": "Brave Web Search", "description": "Perform a web search using Brave API."},
            {"id": "calculator", "name": "Calculator", "description": "Perform mathematical calculations."},
        ]

    def list_tools(self):
        return self._tools
        
# Singleton instance for the gateway
registry = ToolRegistry()
