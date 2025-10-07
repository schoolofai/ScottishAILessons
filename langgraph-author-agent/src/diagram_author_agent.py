"""Diagram Author DeepAgent - Orchestrates 2 subagents to produce diagram JSON documents for Scottish secondary education.

This agent generates JSXGraph visualizations for lesson cards. It is completely
Appwrite-agnostic and outputs plain JSON (diagrams.json) for frontend seeding scripts.
"""

import os

from langchain_google_genai import ChatGoogleGenerativeAI
from deepagents import async_create_deep_agent

# Dual-import pattern for custom state schema
try:
    from src.diagram_author_state import DiagramAuthorState
except ImportError:
    from diagram_author_state import DiagramAuthorState

# Dual-import pattern for prompts
try:
    from src.diagram_author_prompts import (
        DIAGRAM_AGENT_PROMPT,
        DIAGRAM_AUTHOR_SUBAGENT_PROMPT,
        VISUAL_CRITIC_SUBAGENT_PROMPT
    )
except ImportError:
    from diagram_author_prompts import (
        DIAGRAM_AGENT_PROMPT,
        DIAGRAM_AUTHOR_SUBAGENT_PROMPT,
        VISUAL_CRITIC_SUBAGENT_PROMPT
    )

# Import tool utilities (render_diagram_tool ONLY, no Appwrite)
try:
    from src.diagram_author_tools import diagram_tools
except ImportError:
    from diagram_author_tools import diagram_tools

# Initialize Gemini Flash Lite model (cost-effective with vision capabilities)
gemini = ChatGoogleGenerativeAI(
    model="models/gemini-flash-lite-latest",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)


# =============================================================================
# SUBAGENT CONFIGURATIONS
# =============================================================================

# 1. Diagram Author Subagent - Generates JSXGraph JSON and renders images
diagram_author_subagent = {
    "name": "diagram_author_subagent",
    "description": "Generate JSXGraph JSON visualizations and render to images using DiagramScreenshot service. Iterates based on visual critique feedback until quality threshold reached.",
    "prompt": DIAGRAM_AUTHOR_SUBAGENT_PROMPT,
    "tools": diagram_tools  # render_diagram_tool only (HTTP client)
}

# 2. Visual Critic Subagent - Analyzes rendered images with multi-modal vision
visual_critic_subagent = {
    "name": "visual_critic_subagent",
    "description": "Analyze rendered diagram images across 4 dimensions (clarity, accuracy, pedagogy, aesthetics). Provides objective scoring (0.0-1.0) and constructive feedback. Accepts diagrams with score ≥ 0.85.",
    "prompt": VISUAL_CRITIC_SUBAGENT_PROMPT,
    "tools": []  # No tools needed, pure vision analysis
}


# =============================================================================
# MAIN DIAGRAM AUTHOR DEEPAGENT
# =============================================================================

# Create the Diagram Author DeepAgent with 2 subagents
# Uses custom state schema with dict_merger reducer for concurrent updates
agent = async_create_deep_agent(
    model=gemini,
    tools=diagram_tools,  # render_diagram_tool only (NO Appwrite tools)
    instructions=DIAGRAM_AGENT_PROMPT,
    subagents=[
        diagram_author_subagent,
        visual_critic_subagent
    ],
    context_schema=DiagramAuthorState,  # Custom state with dict_merger reducer
).with_config({"recursion_limit": 1000})


# =============================================================================
# HEALTH CHECK UTILITY
# =============================================================================

def check_service_health():
    """Check if DiagramScreenshot service is available.

    This should be called before running the agent to ensure the rendering
    service is accessible.

    Returns:
        bool: True if service is healthy, False otherwise
    """
    try:
        from src.diagram_author_tools import check_diagram_service_health
    except ImportError:
        from diagram_author_tools import check_diagram_service_health

    health = check_diagram_service_health()

    if health["healthy"]:
        print(f"✅ DiagramScreenshot service is healthy (status: {health['status']})")
        return True
    else:
        print(f"❌ DiagramScreenshot service is not healthy (status: {health['status']})")
        print(f"   Details: {health.get('details', {})}")
        print("")
        print("To start the service:")
        print("  cd diagram-prototypes")
        print("  docker compose up -d")
        print("")
        return False


# =============================================================================
# USAGE EXAMPLE
# =============================================================================

if __name__ == "__main__":
    import asyncio
    import json

    # Example lesson template input
    example_input = {
        "$id": "lesson_template_001",
        "title": "Pythagorean Theorem",
        "lesson_type": "teach",
        "cards": [
            {
                "id": "card_1",
                "cardType": "teach",
                "title": "Right Triangle Basics",
                "content": "In a right triangle with sides a=3 and b=4, we can find the hypotenuse c using the Pythagorean theorem: a² + b² = c²"
            },
            {
                "id": "card_2",
                "cardType": "explain_plain",
                "title": "Explanation",
                "content": "The Pythagorean theorem states that in a right triangle..."
            }
        ]
    }

    async def run_example():
        """Run example diagram generation."""
        # Check service health first
        if not check_service_health():
            print("Cannot proceed without DiagramScreenshot service")
            return

        print("\n🚀 Running Diagram Author Agent")
        print("=" * 50)
        print(f"Input: {example_input['title']}")
        print(f"Cards: {len(example_input['cards'])}")
        print("")

        # Invoke agent
        result = await agent.ainvoke({
            "messages": [
                {"role": "user", "content": json.dumps(example_input)}
            ]
        })

        # Check for output
        files = result.get("files", {})
        if "diagrams.json" in files:
            diagrams_data = json.loads(files["diagrams.json"])
            print(f"\n✅ Generated {len(diagrams_data.get('diagrams', []))} diagrams")
            print("")
            print("Output saved to files['diagrams.json']")
            print("Use frontend seeding script to persist to Appwrite:")
            print("  npm run seed:diagrams -- <courseId> <sow_order>")
        else:
            print("\n⚠️  No diagrams.json produced")
            if "diagram_errors.json" in files:
                errors = json.loads(files["diagram_errors.json"])
                print(f"Errors: {len(errors)} cards failed")

        print("=" * 50)

    # Run async example
    asyncio.run(run_example())
