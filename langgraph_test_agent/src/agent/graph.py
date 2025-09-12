"""Simple LangGraph test to demonstrate subgraph interrupt behavior with shared state."""

from typing_extensions import TypedDict
from langgraph.graph.state import StateGraph, START
from langgraph.types import interrupt


# Define shared state schema
class State(TypedDict, total=False):
    count: int
    messages: list
    interrupted: bool


# SUBGRAPH NODES
def sub_node_1(state: State):
    """First subgraph node."""
    count = state.get("count", 0)
    print(f"🔷 SUB_NODE_1: count={count}")
    return {"count": count}


def sub_node_interrupt(state: State):
    """Second subgraph node that triggers interrupt."""
    count = state.get("count", 0) + 1
    print(f"🔷 SUB_NODE_INTERRUPT: count={count} - INTERRUPTING")
    
    # This interrupt will test the behavior when subgraph is added as a node
    interrupt("Need user input")
    
    return {"count": count, "interrupted": True}


# Build subgraph with shared state
subgraph_builder = StateGraph(State)
subgraph_builder.add_node("sub_node_1", sub_node_1)
subgraph_builder.add_node("sub_node_interrupt", sub_node_interrupt)
subgraph_builder.add_edge(START, "sub_node_1")
subgraph_builder.add_edge("sub_node_1", "sub_node_interrupt")
subgraph = subgraph_builder.compile(checkpointer=True)


# Build main graph - add subgraph directly as a node (no parent node function)
main_graph = StateGraph(State)
main_graph.add_node("subgraph_node", subgraph)  # Add compiled subgraph as node
main_graph.add_edge(START, "subgraph_node")

# Compile main graph 
graph = main_graph.compile()