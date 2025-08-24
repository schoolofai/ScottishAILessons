#!/usr/bin/env python3
"""Test LangGraph integration"""

import asyncio
from langgraph_sdk import get_client

async def test_integration():
    # Create client
    client = get_client(url="http://localhost:2024")
    
    # Test message
    async for ev in client.runs.stream(
        "agent", 
        {
            "input": {
                "messages": [
                    {"role": "human", "content": "Hello! Can you tell me a joke?"}
                ]
            }
        }, 
        stream_mode="updates"
    ):
        print(f"Event: {ev.event}")

if __name__ == "__main__":
    asyncio.run(test_integration())