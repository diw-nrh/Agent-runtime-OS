from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    The state dictionary representing the memory of a single LangGraph execution.
    For sub-graphs (create_react_agent) to work seamlessly, this should closely match MessagesState.
    """
    messages: Annotated[Sequence[BaseMessage], add_messages]
    blueprint_id: str
