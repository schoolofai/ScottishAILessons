#!/usr/bin/env python3
"""
Simple test script to connect to LangGraph API and invoke a sample lesson.

This script mimics the behavior of SessionChatAssistant.tsx and AutoStartTrigger.tsx
by sending a human message with lesson context to start a teaching session.

Uses LangSmith for trace monitoring with a unique project name.
"""

import asyncio
import json
import os
from datetime import datetime
from langchain_core.messages import HumanMessage
from langgraph_sdk import get_client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

async def test_langgraph_connection():
    """Test connection to LangGraph API and invoke sample lesson."""

    print("🚀 Testing LangGraph Connection & Lesson Invocation")
    print("=" * 60)

    # Setup LangSmith tracing with unique project name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    langsmith_project = f"langgraph-connection-test-{timestamp}"

    # Set LangSmith environment variables
    if os.getenv("LANGSMITH_API_KEY"):
        os.environ["LANGSMITH_PROJECT"] = langsmith_project
        print(f"📊 LangSmith tracing enabled")
        print(f"   - Project: {langsmith_project}")
        print(f"   - API Key: {os.getenv('LANGSMITH_API_KEY')[:20]}...")
    else:
        print("⚠️  LangSmith API key not found - traces won't be recorded")

    try:
        # Connect to the running LangGraph server
        client = get_client(url="http://localhost:2024")
        assistant_id = "agent"  # From langgraph.json

        print(f"✅ Connected to LangGraph server at http://localhost:2024")
        print(f"📝 Using assistant ID: {assistant_id}")

        # Create a new thread (similar to createThread in chatApi.ts)
        thread = await client.threads.create()
        thread_id = thread["thread_id"]
        print(f"🔗 Created thread: {thread_id}")

        # Create sample lesson context (similar to SessionChatAssistant.tsx)
        session_context = {
            "session_id": "test-connection-session-001",
            "student_id": "test-student-456",
            "lesson_snapshot": {
                "courseId": "math-basics-101",
                "lessonTemplateId": "fractions-intro-template",
                "title": "Introduction to Fractions",
                "topic": "Mathematics - Basic Fractions",
                "description": "Learn about numerators, denominators, and basic fraction operations",
                "objectives": [
                    "Understand what numerators and denominators represent",
                    "Compare simple fractions",
                    "Recognize equivalent fractions",
                    "Simplify basic fractions"
                ],
                "cards": [
                    {
                        "id": "fraction-basics-1",
                        "title": "Understanding Fractions",
                        "explainer": "A fraction shows parts of a whole. The number on top is the numerator (parts we have), and the number on bottom is the denominator (total parts).",
                        "content": "Let's explore what 2/10 means and how we can simplify it.",
                        "cfu": {
                            "id": "cfu-simplify-1",
                            "type": "text",
                            "question": "What is 2/10 simplified to its lowest terms?",
                            "expected": "1/5",
                            "hints": ["Find the greatest common divisor", "Both 2 and 10 can be divided by 2"]
                        }
                    },
                    {
                        "id": "fraction-comparison-2",
                        "title": "Comparing Fractions",
                        "explainer": "To compare fractions, we can convert them to have the same denominator or convert them to decimals.",
                        "content": "Let's compare 3/4 and 2/3 to see which is larger.",
                        "cfu": {
                            "id": "cfu-compare-1",
                            "type": "mcq",
                            "question": "Which fraction is larger: 3/4 or 2/3?",
                            "options": ["3/4", "2/3", "They are equal"],
                            "correct": 0,
                            "explanation": "3/4 = 0.75 and 2/3 ≈ 0.67, so 3/4 is larger"
                        }
                    }
                ]
            }
        }

        print(f"📚 Created lesson context:")
        print(f"   - Course: {session_context['lesson_snapshot']['title']}")
        print(f"   - Cards: {len(session_context['lesson_snapshot']['cards'])}")
        print(f"   - Session ID: {session_context['session_id']}")

        # Prepare input similar to AutoStartTrigger.tsx
        # AutoStartTrigger sends an empty message to start the teaching flow
        input_data = {
            "messages": [HumanMessage(content="")],  # Empty message like AutoStartTrigger
            "session_context": session_context
        }

        print(f"\n🎯 Sending lesson start request...")
        print(f"   - Message content: \"\" (empty, like AutoStartTrigger)")
        print(f"   - Session context: included")

        # Stream the response (similar to sendMessage in chatApi.ts)
        response_count = 0
        tool_calls_seen = []

        print(f"\n📡 Streaming response from LangGraph:")
        print("-" * 50)

        # Track whether we hit an interrupt
        hit_interrupt = False
        messages_seen = []

        async for chunk in client.runs.stream(
            thread_id,
            assistant_id,
            input=input_data,
            stream_mode=["messages", "updates", "values"],  # Add values to see all state changes
            stream_subgraphs=True  # Important for subgraph streaming
        ):
            response_count += 1

            if chunk.event == "messages":
                if hasattr(chunk, 'data') and chunk.data:
                    for msg in chunk.data:
                        messages_seen.append(msg)

                        if hasattr(msg, 'content') and msg.content:
                            print(f"💬 AI Message: {msg.content[:100]}...")

                        # Check for tool calls
                        if hasattr(msg, 'tool_calls') and msg.tool_calls:
                            for tool_call in msg.tool_calls:
                                tool_calls_seen.append(tool_call.name)
                                print(f"🔧 Tool Call: {tool_call.name}")
                                if hasattr(tool_call, 'args') and tool_call.args:
                                    print(f"   - Args keys: {list(tool_call.args.keys())}")
                                    if tool_call.name == "lesson_card_presentation":
                                        card_data = tool_call.args.get('card_data', {})
                                        print(f"   - Card title: {card_data.get('title', 'N/A')}")

            elif chunk.event == "updates":
                if hasattr(chunk, 'data') and chunk.data:
                    print(f"🔄 Update: {chunk.event}")

            elif chunk.event == "values":
                if hasattr(chunk, 'data') and chunk.data:
                    # Check if values contain messages with tool calls
                    values = chunk.data
                    if 'messages' in values:
                        state_messages = values['messages']
                        for msg in state_messages[-1:]:  # Check latest message
                            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                                for tool_call in msg.tool_calls:
                                    if tool_call.name not in tool_calls_seen:
                                        tool_calls_seen.append(tool_call.name)
                                        print(f"🔧 Tool Call (from values): {tool_call.name}")

            elif chunk.event == "interrupt":
                hit_interrupt = True
                print(f"⏸️  Interrupt detected - graph is waiting for user response")

        print("-" * 50)
        print(f"📊 Messages detected: {len(messages_seen)}")
        print(f"⏸️  Hit interrupt: {hit_interrupt}")
        print(f"📊 Stream complete - received {response_count} chunks")

        # Get final state
        final_state = await client.threads.get_state(thread_id)

        # Print detailed state information
        print(f"\n🔍 DETAILED GRAPH STATE:")
        print("=" * 60)

        if final_state:
            print(f"📌 Thread ID: {thread_id}")
            print(f"📌 State Keys: {list(final_state.keys())}")

            # Print values (main state data)
            if 'values' in final_state and final_state['values']:
                values = final_state['values']
                print(f"\n📊 State Values:")
                for key, value in values.items():
                    if key == 'messages':
                        print(f"   - {key}: {len(value)} messages")
                        for i, msg in enumerate(value[-3:]):  # Show last 3 messages
                            msg_type = type(msg).__name__
                            content = getattr(msg, 'content', '')[:100] + '...' if len(getattr(msg, 'content', '')) > 100 else getattr(msg, 'content', '')
                            print(f"     [{i}] {msg_type}: {content}")
                    elif isinstance(value, (list, dict)):
                        if isinstance(value, list):
                            print(f"   - {key}: [{len(value)} items] {value[:3] if len(value) <= 3 else str(value[:3]) + '...'}")
                        else:
                            print(f"   - {key}: {dict(list(value.items())[:3]) if len(value) > 3 else value}")
                    else:
                        print(f"   - {key}: {value}")

            # Print next steps
            if 'next' in final_state:
                print(f"\n🎯 Next Steps: {final_state['next']}")

            # Print checkpoint metadata
            if 'metadata' in final_state:
                print(f"\n📝 Checkpoint Metadata:")
                metadata = final_state['metadata']
                for key, value in metadata.items():
                    print(f"   - {key}: {value}")

            # Print interrupts (detailed)
            if 'interrupts' in final_state and final_state['interrupts']:
                print(f"\n⏸️  INTERRUPTS ({len(final_state['interrupts'])}):")
                for i, interrupt in enumerate(final_state['interrupts']):
                    print(f"   [{i}] {interrupt}")
            else:
                print(f"\n✅ No interrupts - execution completed")

        else:
            print("❌ No final state received from thread")

        print("=" * 60)

        # Print summary
        print(f"\n📋 Session Summary:")
        print(f"   - Thread ID: {thread_id}")
        print(f"   - Tool calls seen: {tool_calls_seen}")
        print(f"   - Response chunks: {response_count}")

        if 'values' in final_state:
            values = final_state['values']
            print(f"   - Final mode: {values.get('mode', 'unknown')}")
            print(f"   - Messages in state: {len(values.get('messages', []))}")
            if 'current_stage' in values:
                print(f"   - Teaching stage: {values.get('current_stage', 'unknown')}")

        # Check for any interrupts (these would be handled by frontend UI)
        if 'interrupts' in final_state and final_state['interrupts']:
            print(f"   - Interrupts: {len(final_state['interrupts'])} (for UI interaction)")

        print(f"\n✅ LangGraph connection test successful!")

        # Save detailed results for inspection
        result_data = {
            "thread_id": thread_id,
            "session_context": session_context,
            "tool_calls_seen": tool_calls_seen,
            "response_count": response_count,
            "messages_count": len(messages_seen),
            "hit_interrupt": hit_interrupt,
            "final_state_keys": list(final_state.keys()) if final_state else [],
            "langsmith_project": langsmith_project,
            "langsmith_enabled": bool(os.getenv("LANGSMITH_API_KEY")),
            "test_timestamp": datetime.now().isoformat()
        }

        with open("langgraph_connection_test_results.json", "w") as f:
            json.dump(result_data, f, indent=2, default=str)

        print(f"💾 Test results saved to: langgraph_connection_test_results.json")

        if os.getenv("LANGSMITH_API_KEY"):
            print(f"🔗 View traces at: https://smith.langchain.com/o/scottish-ai-lessons/projects/p/{langsmith_project}")

        return True

    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main entry point."""
    print("LangGraph Python SDK Connection Test")
    print("This script mimics SessionChatAssistant + AutoStartTrigger behavior\n")

    success = asyncio.run(test_langgraph_connection())

    if success:
        print("\n🎉 Test completed successfully!")
        print("\nWhat happened:")
        print("1. ✅ Connected to LangGraph API at localhost:2024")
        print("2. ✅ Created new thread for lesson session")
        print("3. ✅ Sent lesson context (similar to SessionChatAssistant)")
        print("4. ✅ Triggered teaching with empty message (like AutoStartTrigger)")
        print("5. ✅ Streamed response with tool calls and messages")
        print("6. ✅ Captured final state and interrupts")

        print("\nNext steps:")
        print("- Check langgraph_connection_test_results.json for details")
        print("- Tool calls seen should match lesson_card_presentation")
        print("- Frontend would render these tool calls as interactive UI")
        if os.getenv("LANGSMITH_API_KEY"):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            project_name = f"langgraph-connection-test-{timestamp}"
            print(f"- View detailed traces in LangSmith project: {project_name}")

        return 0
    else:
        print("\n💥 Test failed - check error output above")
        return 1

if __name__ == "__main__":
    exit(main())