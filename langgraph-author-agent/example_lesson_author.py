#!/usr/bin/env python3
"""
Example script to test the Lesson Author Agent.

This script demonstrates how to:
1. Extract a SoW entry from the full SoW document
2. Load the research pack
3. Create dual JSON input
4. Run the lesson author agent
5. Save the generated lesson template

Usage:
    python3 example_lesson_author.py [lesson_index]

Example:
    python3 example_lesson_author.py 0    # Author first lesson
    python3 example_lesson_author.py 5    # Author sixth lesson
"""

import asyncio
import json
import sys
from pathlib import Path
from langgraph_sdk import get_client

# Configuration
LANGGRAPH_URL = "http://127.0.0.1:2024"
SOW_FILE = "data/sow_authored_AOM_nat3.json"
RESEARCH_PACK_FILE = "data/research_pack_json_AOM_nat3.txt"
OUTPUT_DIR = "outputs/lesson_templates"


def load_sow_entry(lesson_index: int) -> dict:
    """Load a specific SoW entry by index."""
    with open(SOW_FILE, 'r') as f:
        sow_data = json.load(f)

    if lesson_index < 0 or lesson_index >= len(sow_data['entries']):
        raise IndexError(f"Lesson index {lesson_index} out of range (0-{len(sow_data['entries'])-1})")

    return sow_data['entries'][lesson_index]


def load_research_pack() -> dict:
    """Load the research pack."""
    with open(RESEARCH_PACK_FILE, 'r') as f:
        return json.load(f)


def create_dual_input(sow_entry: dict, research_pack: dict) -> str:
    """Create dual JSON input string."""
    return json.dumps(sow_entry) + ",\n" + json.dumps(research_pack)


async def run_lesson_author(dual_input: str, verbose: bool = True):
    """Run the lesson author agent with streaming output."""
    # Connect to LangGraph server
    try:
        client = get_client(url=LANGGRAPH_URL)
    except Exception as e:
        print(f"❌ Failed to connect to LangGraph server at {LANGGRAPH_URL}")
        print(f"   Make sure the server is running: langgraph dev --port 2024")
        print(f"   Error: {e}")
        sys.exit(1)

    # Create thread
    thread = await client.threads.create()
    thread_id = thread['thread_id']

    if verbose:
        print(f"📍 Thread created: {thread_id}")
        print(f"🚀 Starting lesson authoring...\n")

    # Stream execution
    iteration_count = 0
    last_message = ""

    async for chunk in client.runs.stream(
        thread_id,
        assistant_id="lesson_author",
        input={"messages": [{"role": "user", "content": dual_input}]},
        stream_mode="values"
    ):
        if verbose and 'messages' in chunk and chunk['messages']:
            last_msg = chunk['messages'][-1]
            if hasattr(last_msg, 'content') and last_msg.content != last_message:
                last_message = last_msg.content
                # Print first 150 characters of new messages
                preview = last_message[:150].replace('\n', ' ')
                print(f"💬 {preview}...")

    # Get final state
    state = await client.threads.get_state(thread_id)

    return state, thread_id


def save_lesson_template(state: dict, lesson_index: int, verbose: bool = True) -> dict:
    """Extract and save the lesson template from state."""
    files = state['values'].get('files', {})

    if 'lesson_template.json' not in files:
        print(f"\n❌ No lesson template generated!")

        # Check for todos
        if 'lesson_todos.json' in files:
            todos = json.loads(files['lesson_todos.json'])
            print(f"\n📋 Outstanding TODOs: {len(todos)}")
            for todo in todos:
                print(f"   - {todo.get('critic', 'unknown')}: {todo.get('issue', 'no details')}")

        return None

    # Parse lesson template
    lesson = json.loads(files['lesson_template.json'])

    # Create output directory
    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save lesson template
    lesson_type = lesson.get('lesson_type', 'unknown')
    output_file = output_dir / f"lesson_{lesson_index:03d}_{lesson_type}.json"

    with open(output_file, 'w') as f:
        json.dump(lesson, f, indent=2)

    if verbose:
        print(f"\n✅ Lesson template saved: {output_file}")
        print(f"\n📊 Lesson Details:")
        print(f"   Title: {lesson.get('title', 'N/A')}")
        print(f"   Type: {lesson.get('lesson_type', 'N/A')}")
        print(f"   Duration: {lesson.get('estMinutes', 'N/A')} minutes")
        print(f"   Cards: {len(lesson.get('cards', []))}")
        print(f"   Outcomes: {', '.join(lesson.get('outcomeRefs', []))}")
        print(f"   Standards: {', '.join(lesson.get('assessmentStandardRefs', []))}")

    # Save critic results
    critic_names = [
        'pedagogical_critic_result',
        'assessment_critic_result',
        'accessibility_critic_result',
        'scottish_context_critic_result',
        'coherence_critic_result'
    ]

    critic_results = {}
    if verbose:
        print(f"\n📝 Critic Reviews:")

    for critic_file in critic_names:
        if f"{critic_file}.json" in files:
            critic_data = json.loads(files[f"{critic_file}.json"])
            critic_name = critic_file.replace('_critic_result', '').replace('_', ' ').title()
            score = critic_data.get('score', 0.0)
            passed = critic_data.get('passed', False)
            critic_results[critic_name] = {'score': score, 'passed': passed}

            if verbose:
                status = '✅' if passed else '❌'
                print(f"   {status} {critic_name}: {score:.2f}")

    # Save critic summary
    critic_summary_file = output_dir / f"lesson_{lesson_index:03d}_critics.json"
    with open(critic_summary_file, 'w') as f:
        json.dump(critic_results, f, indent=2)

    return lesson


async def main():
    """Main execution function."""
    # Parse command line arguments
    lesson_index = 0
    if len(sys.argv) > 1:
        try:
            lesson_index = int(sys.argv[1])
        except ValueError:
            print(f"Usage: {sys.argv[0]} [lesson_index]")
            print(f"Example: {sys.argv[0]} 0")
            sys.exit(1)

    print(f"{'='*60}")
    print(f"  Lesson Author Agent - Example Script")
    print(f"{'='*60}\n")

    # Load data
    print(f"📂 Loading data for lesson index {lesson_index}...")
    try:
        sow_entry = load_sow_entry(lesson_index)
        research_pack = load_research_pack()
    except FileNotFoundError as e:
        print(f"❌ Data file not found: {e}")
        print(f"   Make sure you're running this script from the langgraph-author-agent directory")
        sys.exit(1)
    except IndexError as e:
        print(f"❌ {e}")
        sys.exit(1)

    print(f"✅ Loaded SoW entry: '{sow_entry['label']}'")
    print(f"   Type: {sow_entry['lesson_type']}")
    print(f"   Duration: {sow_entry['estMinutes']} minutes")
    print(f"   Standards: {', '.join(sow_entry['assessmentStandardRefs'])}")
    print(f"\n✅ Loaded research pack (version {research_pack['research_pack_version']})")

    # Create dual input
    dual_input = create_dual_input(sow_entry, research_pack)
    print(f"✅ Created dual JSON input ({len(dual_input)} characters)\n")

    # Run agent
    print(f"{'-'*60}")
    state, thread_id = await run_lesson_author(dual_input, verbose=True)
    print(f"{'-'*60}\n")

    # Save output
    lesson = save_lesson_template(state, lesson_index, verbose=True)

    if lesson:
        print(f"\n{'='*60}")
        print(f"✅ SUCCESS! Lesson template generated.")
        print(f"{'='*60}")
        print(f"\n📁 Output files:")
        print(f"   - Lesson template: {OUTPUT_DIR}/lesson_{lesson_index:03d}_{lesson['lesson_type']}.json")
        print(f"   - Critic results: {OUTPUT_DIR}/lesson_{lesson_index:03d}_critics.json")
        print(f"\n🔗 View execution in LangGraph Studio:")
        print(f"   https://smith.langchain.com/studio/?baseUrl={LANGGRAPH_URL}&threadId={thread_id}")
    else:
        print(f"\n{'='*60}")
        print(f"❌ FAILED to generate lesson template.")
        print(f"{'='*60}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
