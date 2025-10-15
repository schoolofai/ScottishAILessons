"""
deep_research_agent_full.py

Full implementation of Deep Research Agent with ClaudeSDKClient.
Based on specification v2.0 from tasks/deep_research_agent_spec.md

This implementation uses the actual Claude Agent SDK with:
- Isolated filesystem per execution
- Specialized subagents (Researcher, Data Manager, Synthesizer)
- Built-in todo tracking
- Comprehensive logging
- Optional Appwrite MCP integration
"""

import asyncio
import tempfile
import shutil
import json
import uuid
import logging
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import AgentDefinition

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class IsolatedFilesystem:
    """
    Creates and manages isolated filesystem per execution.
    Each execution gets its own temporary workspace for context engineering.
    """

    def __init__(self, execution_id: str, persist: bool = True):
        self.execution_id = execution_id
        self.persist = persist
        self.root = Path(tempfile.mkdtemp(prefix=f"agent_{execution_id}_"))
        self.context_dir = self.root / "context"
        self.research_dir = self.root / "research"
        self.data_dir = self.root / "data"
        self.output_dir = self.root / "output"

        logger.info(f"[IsolatedFS] Initialized filesystem for execution {execution_id}")
        logger.info(f"[IsolatedFS] Root directory: {self.root}")
        logger.info(f"[IsolatedFS] Persistence: {'Enabled (workspace will be kept)' if persist else 'Disabled (will cleanup)'}")

    def setup(self) -> None:
        """Create directory structure and README"""
        logger.info(f"[IsolatedFS] Setting up directory structure...")

        for dir_path in [self.context_dir, self.research_dir,
                         self.data_dir, self.output_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"[IsolatedFS] Created directory: {dir_path.name}/")

        readme = f"""# Agent Execution Workspace

Execution ID: {self.execution_id}
Created: {datetime.now().isoformat()}

## Directories
- `/context/`  - Key findings and insights
- `/research/` - Detailed research documents
- `/data/`     - Data summaries and logs
- `/output/`   - Final synthesis

## Context Engineering
All subagents share this filesystem.
Use files to offload context and share information.
"""
        (self.root / "README.md").write_text(readme)
        logger.info(f"[IsolatedFS] Filesystem setup complete at {self.root}")
        logger.info(f"[IsolatedFS] ✓ All directories created and ready")

    def cleanup(self) -> None:
        """Remove temporary directory (only if persist is False)"""
        if not self.persist:
            if self.root.exists():
                logger.info(f"[IsolatedFS] Cleaning up filesystem at {self.root}")
                shutil.rmtree(self.root)
                logger.info(f"[IsolatedFS] ✓ Filesystem cleaned up successfully")
            else:
                logger.warning(f"[IsolatedFS] Root directory not found during cleanup")
        else:
            logger.info(f"[IsolatedFS] ✓ Workspace persisted at: {self.root}")
            logger.info(f"[IsolatedFS] Files will remain available after execution")

    def __enter__(self):
        self.setup()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()


class DeepResearchAgent:
    """
    Deep research agent with isolated filesystem and specialized subagents.

    Features:
    - Isolated filesystem per execution
    - Context engineering via files
    - Built-in todo tracking (monitored from SDK)
    - Specialized subagents (Researcher, Data Manager, Synthesizer)
    - Optional Appwrite MCP integration
    """

    def __init__(self, mcp_config_path: Optional[str] = None, persist_workspace: bool = True):
        self.execution_id = str(uuid.uuid4())[:8]
        self.persist_workspace = persist_workspace

        logger.info("=" * 80)
        logger.info("[Agent] Initializing DeepResearchAgent")
        logger.info(f"[Agent] Execution ID: {self.execution_id}")
        logger.info(f"[Agent] Workspace persistence: {'Enabled' if persist_workspace else 'Disabled'}")

        # Load MCP config (Appwrite tools available)
        # Default to project root if not specified
        if mcp_config_path is None:
            project_root = Path(__file__).parent.parent.parent
            mcp_config_path = project_root / ".mcp.json"

        try:
            if Path(mcp_config_path).exists():
                with open(mcp_config_path, 'r') as f:
                    self.mcp_config = json.load(f)['mcpServers']
                logger.info(f"[Agent] ✓ Loaded MCP configuration from {mcp_config_path}")
                logger.info(f"[Agent] Available MCP servers: {list(self.mcp_config.keys())}")
            else:
                self.mcp_config = {}
                logger.warning(f"[Agent] MCP config not found at {mcp_config_path}")
                logger.info(f"[Agent] Continuing without MCP servers")
        except Exception as e:
            logger.error(f"[Agent] ✗ Failed to load MCP config: {e}")
            self.mcp_config = {}

        self.filesystem: Optional[IsolatedFilesystem] = None
        self.session_id: Optional[str] = None
        self.current_todos: List[Dict[str, Any]] = []
        self.total_cost = 0.0
        self.message_count = 0

        logger.info(f"[Agent] ✓ Agent initialized successfully")
        logger.info("=" * 80)

    def _get_system_prompt(self) -> str:
        """Get main agent system prompt"""
        return f'''You are an orchestrator agent managing specialized subagents for deep research.

**Execution Context:**
- Execution ID: {self.execution_id}
- Workspace: {self.filesystem.root}

**Available Subagents:**
1. **researcher** - Deep research specialist
   - Conducts thorough research
   - Writes findings to /context/ and /research/

2. **data-manager** - Data specialist with Appwrite access
   - Uses Appwrite MCP tools ONLY when explicitly requested
   - Writes summaries to /data/

3. **synthesizer** - Synthesis specialist
   - Reads all workspace files
   - Creates comprehensive summary in /output/

**Your Responsibilities:**
1. Analyze the user's research query
2. Break down into subtasks using TodoWrite
3. Delegate to appropriate subagents using Task tool
4. Monitor progress and coordinate work
5. Ensure final synthesis in /output/summary.md

**Important Guidelines:**
- Use TodoWrite tool to track ALL progress
- Break complex tasks into clear steps
- Update todo status as you work (pending → in_progress → completed)
- Only ONE todo should be in_progress at a time
- All subagents share the workspace filesystem
- Delegate appropriately based on task requirements

**Task Delegation:**
- Research tasks → Use Task tool with researcher subagent
- Data operations (if explicitly requested) → Use Task tool with data-manager subagent
- Final synthesis → Use Task tool with synthesizer subagent

Begin by analyzing the user's query and creating a todo list to track the work.'''

    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Define specialized subagents with detailed prompts"""

        return {
            'researcher': AgentDefinition(
                description='Deep research specialist for comprehensive analysis',
                prompt=f'''You are a specialized research agent.

**Workspace**: {self.filesystem.root}

**Your Responsibilities:**
1. Conduct thorough research on assigned topics
2. Write key findings to `{self.filesystem.context_dir}/findings.md`
3. Write detailed analysis to `{self.filesystem.research_dir}/<topic>.md`
4. Use TodoWrite tool to track research progress
5. Break complex topics into sub-tasks

**Guidelines:**
- Document sources and reasoning clearly
- Use clear markdown formatting
- Update todos as you progress
- Write incrementally (don't try to complete everything at once)
- Use files to offload large context

**Output Expectations:**
- `{self.filesystem.context_dir}/findings.md` - Key insights (500-1000 words)
- `{self.filesystem.research_dir}/<topic>.md` - Detailed analysis (2000+ words)
- Regular TodoWrite updates showing progress''',
                tools=['Read', 'Write', 'Grep', 'Glob', 'TodoWrite'],
                model='sonnet'
            ),

            'data-manager': AgentDefinition(
                description='Data specialist with optional Appwrite MCP access',
                prompt=f'''You are a data management specialist.

**Workspace**: {self.filesystem.root}

**Your Responsibilities:**
1. Use Appwrite MCP tools ONLY when explicitly requested in the task
2. Query existing data from Appwrite if prompted
3. Save data to Appwrite if prompted
4. Write operation summaries to `{self.filesystem.data_dir}/`
5. Log ALL operations to `{self.filesystem.data_dir}/operations.log`
6. Track operations with TodoWrite

**Appwrite MCP Tools Available:**
- mcp__appwrite__databases_list
- mcp__appwrite__databases_create_document
- mcp__appwrite__databases_upsert_document
- mcp__appwrite__databases_list_documents
- mcp__appwrite__databases_get_document

**IMPORTANT**: Only use Appwrite tools when the user's task explicitly requests it.
Otherwise, focus on file-based operations.

**Guidelines:**
- Validate data before operations
- Log all operations clearly with timestamps
- Handle errors gracefully
- Report success/failure status

**Output Expectations:**
- `{self.filesystem.data_dir}/operations.log` - Detailed operation log
- `{self.filesystem.data_dir}/summary.json` - Data summary if applicable
- TodoWrite updates for all operations''',
                tools=[
                    'Read', 'Write', 'TodoWrite',
                    'mcp__appwrite__databases_list',
                    'mcp__appwrite__databases_create_document',
                    'mcp__appwrite__databases_upsert_document',
                    'mcp__appwrite__databases_list_documents',
                    'mcp__appwrite__databases_get_document'
                ],
                model='sonnet'
            ),

            'synthesizer': AgentDefinition(
                description='Synthesis specialist for combining context',
                prompt=f'''You are a synthesis specialist.

**Workspace**: {self.filesystem.root}

**Your Responsibilities:**
1. Read ALL files from workspace directories:
   - `{self.filesystem.context_dir}/` - Key findings
   - `{self.filesystem.research_dir}/` - Detailed research
   - `{self.filesystem.data_dir}/` - Data summaries
2. Identify themes, patterns, and insights
3. Create comprehensive synthesis
4. Write to `{self.filesystem.output_dir}/summary.md`
5. Track synthesis progress with TodoWrite

**Synthesis Structure:**
```markdown
# Executive Summary
[High-level overview of findings]

# Key Findings
[Bullet points from all sources]

# Detailed Analysis
[Comprehensive analysis with cross-references]

# Patterns and Themes
[Cross-cutting insights]

# Recommendations
[Actionable next steps]

# Sources
[List all files consulted]
```

**Guidelines:**
- Read EVERY file in the workspace directories
- Cross-reference information from different sources
- Highlight gaps or contradictions
- Provide clear, actionable insights
- Structure for readability

**Output Expectations:**
- `{self.filesystem.output_dir}/summary.md` - Comprehensive final synthesis
- TodoWrite updates showing synthesis progress''',
                tools=['Read', 'Write', 'Glob', 'TodoWrite'],
                model='sonnet'
            )
        }

    def _process_message(self, message: Any) -> None:
        """Process messages from the agent and track todos"""
        self.message_count += 1

        message_type = type(message).__name__

        # Track session ID from SystemMessage
        if message_type == "SystemMessage" and hasattr(message, 'subtype') and message.subtype == "init":
            if hasattr(message, 'data') and 'session_id' in message.data:
                self.session_id = message.data['session_id']
                logger.info(f"[Session] Session started: {self.session_id}")

        # Check for TodoWrite tool usage in AssistantMessage
        if message_type == "AssistantMessage":
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'type') and block.type == 'tool_use':
                        if hasattr(block, 'name') and block.name == 'TodoWrite':
                            if hasattr(block, 'input'):
                                self.current_todos = block.input.get('todos', [])

                                completed = sum(1 for t in self.current_todos if t['status'] == 'completed')
                                in_progress = sum(1 for t in self.current_todos if t['status'] == 'in_progress')
                                pending = sum(1 for t in self.current_todos if t['status'] == 'pending')
                                total = len(self.current_todos)

                                logger.info(f"[Progress] Todo Update: {completed}/{total} completed | {in_progress} in progress | {pending} pending")

                                # Log current in_progress task
                                for todo in self.current_todos:
                                    if todo['status'] == 'in_progress':
                                        logger.info(f"[Progress] → Currently working on: {todo['content']}")

            # Track usage/cost if available
            if hasattr(message, 'usage') and message.usage:
                if hasattr(message.usage, 'total_cost_usd'):
                    self.total_cost += message.usage.total_cost_usd
                    logger.debug(f"[Cost] Message cost: ${message.usage.total_cost_usd:.4f} | Total: ${self.total_cost:.4f}")

        # Log assistant text responses
        if message_type == "AssistantMessage" and hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'type') and block.type == 'text':
                    if hasattr(block, 'text'):
                        logger.info(f"[Assistant] {block.text[:200]}...")

    async def execute(
        self,
        task: str,
        max_turns: int = 50
    ) -> Dict[str, Any]:
        """
        Execute deep research agent with isolated filesystem.

        Args:
            task: User's research query (input that starts the session)
            max_turns: Maximum conversation turns

        Returns:
            Dict with execution results, todos, costs, and output files
        """

        logger.info("\n" + "=" * 80)
        logger.info("[Execution] Starting Deep Research Session")
        logger.info("=" * 80)
        logger.info(f"[Execution] Task: {task[:200]}...")
        logger.info(f"[Execution] Max turns: {max_turns}")

        # Note: SDK will handle authentication (API key or Claude subscription)
        # No need to check for API key - let SDK determine auth method

        with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace) as filesystem:
            self.filesystem = filesystem

            logger.info("[Execution] Creating agent configuration...")

            # Get subagent definitions
            subagents = self._get_subagent_definitions()

            # Configure agent options with subagents
            options = ClaudeAgentOptions(
                model='claude-sonnet-4-5',
                max_turns=max_turns,
                system_prompt=self._get_system_prompt(),
                agents=subagents,  # Pass subagent definitions
                allowed_tools=[
                    'Read', 'Write', 'Edit', 'Glob', 'Grep',
                    'TodoWrite', 'Task'
                ],
                permission_mode='acceptEdits',
                continue_conversation=True,
                mcp_servers=self.mcp_config if self.mcp_config else {}
            )

            logger.info(f"[Execution] ✓ Agent configured:")
            logger.info(f"  - Model: {options.model}")
            logger.info(f"  - Max turns: {options.max_turns}")
            logger.info(f"  - Subagents available via Task tool: {list(subagents.keys())}")
            logger.info(f"  - MCP servers: {list(self.mcp_config.keys()) if self.mcp_config else 'None'}")
            logger.info(f"  - Workspace: {filesystem.root}")

            logger.info("[Execution] Starting session with query()...")

            try:
                # Execute query with options
                async for message in query(prompt=task, options=options):
                    message_type = type(message).__name__

                    # Print RAW unfiltered message
                    logger.info(f"[RAW MESSAGE] Type: {message_type}")
                    logger.info(f"[RAW MESSAGE] Content: {message}")

                    self._process_message(message)

                    # Check for result
                    if message_type == "ResultMessage":
                        if hasattr(message, 'subtype') and message.subtype == "success":
                            logger.info("[Execution] ✓ Execution completed successfully")

                            # Write final result to workspace
                            result_content = f"""# Deep Research Session - Final Result

## Execution Information
- **Execution ID**: {self.execution_id}
- **Session ID**: {self.session_id}
- **Completed**: {datetime.now().isoformat()}
- **Total Messages**: {self.message_count}
- **Total Cost**: ${self.total_cost:.4f}

## Research Query
{task}

## Final Result
{message.result}

## Progress Summary
"""
                            # Add todo summary
                            if self.current_todos:
                                completed = sum(1 for t in self.current_todos if t['status'] == 'completed')
                                result_content += f"\nCompleted {completed}/{len(self.current_todos)} tasks:\n\n"
                                for i, todo in enumerate(self.current_todos, 1):
                                    status_icon = "✓" if todo['status'] == 'completed' else "○"
                                    result_content += f"{i}. {status_icon} [{todo['status']}] {todo['content']}\n"
                            else:
                                result_content += "\nNo todos tracked.\n"

                            result_content += f"""
## Workspace Files

Generated files in workspace `{filesystem.root}`:

"""
                            # List all files in workspace
                            for dir_name, dir_path in [
                                ('Context', filesystem.context_dir),
                                ('Research', filesystem.research_dir),
                                ('Data', filesystem.data_dir),
                                ('Output', filesystem.output_dir)
                            ]:
                                files = list(dir_path.glob("*"))
                                if files:
                                    result_content += f"\n### {dir_name} Directory (`{dir_name.lower()}/`)\n\n"
                                    for f in files:
                                        if f.is_file():
                                            size = f.stat().st_size
                                            result_content += f"- **{f.name}** ({size} bytes)\n"

                            result_content += f"""
---

**Note**: This workspace has been persisted and is available at:
`{filesystem.root}`

All research files, findings, and analysis remain accessible after execution.
"""

                            # Write result to workspace root
                            result_file = filesystem.root / "RESULT.md"
                            result_file.write_text(result_content)
                            logger.info(f"[Execution] ✓ Final result written to {result_file}")

                            # Collect output files
                            output_files = list(str(f) for f in filesystem.output_dir.glob("*") if f.is_file())

                            result = {
                                "execution_id": self.execution_id,
                                "session_id": self.session_id,
                                "result": message.result,
                                "todos": self.current_todos,
                                "cost_usd": self.total_cost,
                                "output_files": output_files,
                                "workspace": str(filesystem.root),
                                "message_count": self.message_count,
                                "result_file": str(result_file)
                            }

                            logger.info("=" * 80)
                            return result
                        else:
                            logger.error(f"[Execution] ✗ Execution failed: {message.result}")
                            raise Exception(f"Agent execution failed: {message.result}")

            except Exception as e:
                logger.error(f"[Execution] ✗ Error during execution: {e}")
                raise


async def main():
    """Example: Deep research task with comprehensive logging"""

    # Initialize agent
    logger.info("\n" + "🔬 " * 20)
    logger.info("Deep Research Agent - Full Implementation")
    logger.info("🔬 " * 20 + "\n")

    agent = DeepResearchAgent()

    # User's research query - this is the input that starts the session
    user_query = '''
Research: "Context Engineering in AI Agent Systems"

Please conduct deep research on this topic and provide comprehensive findings.

Steps:
1. Use the researcher subagent to research context engineering techniques
2. Have the researcher write key findings to /context/findings.md
3. Have the researcher write detailed analysis to /research/context_engineering.md
4. Use the synthesizer subagent to read all files and create final summary in /output/summary.md

Track progress with todos throughout the research process.
Make sure to write comprehensive, detailed content to the files.
'''

    # Execute with user query as input
    logger.info("[Main] Submitting research query to agent...")

    try:
        result = await agent.execute(user_query, max_turns=100)

        # Display results
        print("\n" + "=" * 80)
        print("EXECUTION SUMMARY")
        print("=" * 80)
        print(f"Execution ID: {result['execution_id']}")
        print(f"Session ID: {result['session_id']}")
        print(f"Workspace: {result['workspace']}")
        print(f"Messages: {result['message_count']}")
        print(f"Cost: ${result['cost_usd']:.4f}")

        if result['todos']:
            completed = sum(1 for t in result['todos'] if t['status'] == 'completed')
            print(f"\nTodos: {completed}/{len(result['todos'])} completed")
            print("\nFinal Todo Status:")
            for todo in result['todos']:
                status_icon = "✓" if todo['status'] == 'completed' else "○"
                print(f"  {status_icon} [{todo['status']}] {todo['content']}")

        print(f"\nOutput Files: {len(result['output_files'])}")
        if result['output_files']:
            print("\nGenerated Files:")
            for f in result['output_files']:
                file_path = Path(f)
                if file_path.exists():
                    size = file_path.stat().st_size
                    print(f"  ✓ {file_path.name} ({size} bytes)")
                else:
                    print(f"  - {f}")

        print(f"\nResult:\n{result['result']}")

        # Show workspace persistence info
        print("\n" + "-" * 80)
        print("WORKSPACE PERSISTENCE")
        print("-" * 80)
        print(f"✓ Workspace persisted at: {result['workspace']}")
        print(f"✓ Final result written to: {result['result_file']}")
        print("\nYou can access all research files, findings, and analysis")
        print("in the workspace directory listed above.")
        print("-" * 80)

        print("=" * 80)

        logger.info("\n" + "✅ " * 20)
        logger.info("Deep Research Session Complete!")
        logger.info(f"Workspace persisted at: {result['workspace']}")
        logger.info("✅ " * 20 + "\n")

    except Exception as e:
        logger.error(f"\n[Main] Execution failed with error: {e}")
        print("\n" + "=" * 80)
        print("EXECUTION FAILED")
        print("=" * 80)
        print(f"Error: {e}")
        print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
