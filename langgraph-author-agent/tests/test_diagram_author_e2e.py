#!/usr/bin/env python3
"""End-to-end test for diagram_author agent.

Fetches a lesson template from Appwrite and generates diagrams.

Usage:
    python tests/test_diagram_author_e2e.py <lesson_template_id>

Example:
    python tests/test_diagram_author_e2e.py 68e1665b000f250aa9a1
"""

import os
import sys
import json
import asyncio
import gzip
import base64
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from appwrite.client import Client as AppwriteClient
from appwrite.services.databases import Databases
from langgraph_sdk import get_client


# Configuration
APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY")
LANGGRAPH_URL = "http://localhost:2027"

DATABASE_ID = "default"
LESSON_TEMPLATES_COLLECTION = "lesson_templates"
LESSON_DIAGRAMS_COLLECTION = "lesson_diagrams"

COMPRESSION_PREFIX = "gzip:"


def decompress_cards(data):
    """Decompress cards from gzip+base64 format.

    Compatible with frontend compression.ts utility.
    Handles both compressed ('gzip:' prefix) and uncompressed JSON strings.
    """
    # Handle null/undefined
    if not data:
        print("   Warning: Received null/undefined cards data")
        return []

    # Handle already-parsed arrays
    if isinstance(data, list):
        return data

    # Handle non-string data
    if not isinstance(data, str):
        print(f"   Warning: Unexpected cards data type: {type(data)}")
        return []

    try:
        # Check if data is compressed (has 'gzip:' prefix)
        if data.startswith(COMPRESSION_PREFIX):
            # Remove prefix
            base64_data = data[len(COMPRESSION_PREFIX):]

            # Decode base64
            compressed_bytes = base64.b64decode(base64_data)

            # Decompress gzip
            decompressed = gzip.decompress(compressed_bytes).decode('utf-8')

            # Parse JSON
            cards = json.loads(decompressed)

            if not isinstance(cards, list):
                raise ValueError("Decompressed data is not an array")

            return cards
        else:
            # Fallback: Try parsing as uncompressed JSON
            cards = json.loads(data)

            if not isinstance(cards, list):
                raise ValueError("Parsed data is not an array")

            return cards

    except Exception as e:
        print(f"   Error decompressing cards: {e}")
        print(f"   Data preview: {data[:100]}")
        raise ValueError(f"Card decompression failed: {e}")


async def fetch_lesson_template(lesson_template_id: str):
    """Fetch lesson template from Appwrite."""
    print(f"📚 Fetching lesson template: {lesson_template_id}")

    client = AppwriteClient()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)

    databases = Databases(client)

    try:
        document = databases.get_document(
            DATABASE_ID,
            LESSON_TEMPLATES_COLLECTION,
            lesson_template_id
        )

        print(f"✅ Found lesson template: {document.get('title', 'Untitled')}")
        print(f"   Lesson Type: {document.get('lesson_type', 'Unknown')}")

        # Decompress cards (handles both gzip and uncompressed)
        cards_data = document.get('cards', [])
        cards = decompress_cards(cards_data)

        print(f"   Cards: {len(cards)}")

        return {
            "lessonTemplateId": document['$id'],
            "title": document.get('title', ''),
            "lesson_type": document.get('lesson_type', ''),
            "cards": cards
        }
    except Exception as e:
        print(f"❌ Failed to fetch lesson template: {e}")
        raise


async def generate_diagrams(lesson_template: dict):
    """Call diagram_author agent to generate diagrams."""
    print("\n🎨 Calling diagram_author agent...")

    # Get LangGraph client
    client = get_client(url=LANGGRAPH_URL)

    # Create a thread
    thread = await client.threads.create()
    print(f"✅ Created thread: {thread['thread_id']}")

    # Prepare input with lesson template as JSON in message content (DeepAgent pattern)
    # The agent expects to parse lesson_template from the user message, not from separate state fields
    input_data = {
        "messages": [{"role": "user", "content": json.dumps(lesson_template)}]
    }

    print("\n📤 Sending lesson template to diagram_author...")
    print(f"   Template ID: {lesson_template['lessonTemplateId']}")
    print(f"   Title: {lesson_template['title']}")
    print(f"   Cards: {len(lesson_template['cards'])}")

    # Stream the agent execution
    print("\n🔄 Processing...\n")

    final_state = None

    async for chunk in client.runs.stream(
        thread['thread_id'],
        "diagram_author",
        input=input_data,
        stream_mode="values"
    ):
        if chunk.event == "values":
            final_state = chunk.data

            # Log progress
            if final_state.get("cards_processed") is not None:
                print(f"   ✓ Cards processed: {final_state['cards_processed']}/{final_state.get('total_cards', '?')}")
            if final_state.get("cards_with_diagrams") is not None:
                print(f"   ✓ Cards with diagrams: {final_state['cards_with_diagrams']}")

    print("\n✅ Agent execution complete!")

    return final_state


async def save_diagrams_to_appwrite(diagrams: list, lesson_template_id: str):
    """Save generated diagrams to Appwrite."""
    print(f"\n💾 Saving {len(diagrams)} diagrams to Appwrite...")

    client = AppwriteClient()
    client.set_endpoint(APPWRITE_ENDPOINT)
    client.set_project(APPWRITE_PROJECT_ID)
    client.set_key(APPWRITE_API_KEY)

    databases = Databases(client)

    saved_count = 0

    for diagram in diagrams:
        try:
            # Create document
            document = databases.create_document(
                DATABASE_ID,
                LESSON_DIAGRAMS_COLLECTION,
                "unique()",
                {
                    "lessonTemplateId": lesson_template_id,
                    "cardId": diagram.get("cardId", ""),
                    "jsxgraph_json": diagram.get("jsxgraph_json", ""),
                    "diagram_type": diagram.get("diagram_type", "unknown"),
                    "visual_critique_score": diagram.get("visual_critique_score"),
                    "critique_iterations": diagram.get("critique_iterations"),
                    "image_data": diagram.get("image_base64", "")
                }
            )

            print(f"   ✅ Saved diagram for card: {diagram.get('cardId')}")
            saved_count += 1

        except Exception as e:
            print(f"   ❌ Failed to save diagram for card {diagram.get('cardId')}: {e}")

    print(f"\n✅ Saved {saved_count}/{len(diagrams)} diagrams to Appwrite")


async def save_output_file(diagrams: list, lesson_template_id: str):
    """Save diagrams to local JSON file."""
    output_dir = Path(__file__).parent.parent / "output"
    output_dir.mkdir(exist_ok=True)

    output_path = output_dir / f"diagrams_{lesson_template_id}.json"

    with open(output_path, 'w') as f:
        json.dump({"diagrams": diagrams}, f, indent=2)

    print(f"\n💾 Diagrams also saved to: {output_path}")


async def main():
    """Main test function."""
    if len(sys.argv) < 2:
        print("Usage: python tests/test_diagram_author_e2e.py <lesson_template_id>")
        print("Example: python tests/test_diagram_author_e2e.py 68e1665b000f250aa9a1")
        sys.exit(1)

    lesson_template_id = sys.argv[1]

    print("🧪 Diagram Author Agent E2E Test")
    print("=================================")
    print(f"Lesson Template ID: {lesson_template_id}")
    print(f"LangGraph URL: {LANGGRAPH_URL}")
    print("")

    try:
        # Step 1: Fetch lesson template
        lesson_template = await fetch_lesson_template(lesson_template_id)

        # Step 2: Generate diagrams
        result = await generate_diagrams(lesson_template)

        # Step 3: Display results
        print("\n📊 Results:")
        print("============")

        if result is None:
            print("⚠️  Agent returned None - check server logs for errors")
            print("   This may indicate the agent encountered an error during processing")
            return

        # DeepAgents output to files, not state fields
        files = result.get('files', {})
        output_diagrams = []

        if 'diagrams.json' in files:
            diagrams_data = json.loads(files['diagrams.json'])
            output_diagrams = diagrams_data.get('diagrams', [])

        print(f"Total cards: {len(lesson_template['cards'])}")
        print(f"Cards processed: {len(output_diagrams)}")
        print(f"Cards with diagrams: {len(output_diagrams)}")

        if output_diagrams:
            print(f"\n✅ Generated {len(output_diagrams)} diagrams:")
            for i, diagram in enumerate(output_diagrams, 1):
                print(f"   {i}. Card: {diagram.get('cardId', 'unknown')}")
                print(f"      Type: {diagram.get('diagram_type', 'unknown')}")
                print(f"      Score: {diagram.get('visual_critique_score', 'N/A')}")
                print(f"      Iterations: {diagram.get('critique_iterations', 0)}")

            # Save to file
            await save_output_file(output_diagrams, lesson_template_id)

            # Save to Appwrite
            await save_diagrams_to_appwrite(output_diagrams, lesson_template_id)
        else:
            print("\n⚠️  No diagrams were generated")

        if result.get('errors'):
            print(f"\n❌ Errors encountered: {len(result['errors'])}")
            for i, error in enumerate(result['errors'], 1):
                print(f"   {i}. {error.get('message', json.dumps(error))}")

        print("\n✅ Test complete!")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
