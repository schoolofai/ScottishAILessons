# Batch Diagram Generator - DRY-Compliant Implementation Plan

## Architecture: Thin Wrapper Pattern

The batch tool is a **thin orchestration layer** that:
1. Handles batch-specific logic (validation, existing checks, dry-run, force delete)
2. **Reuses** existing `DiagramAuthorClaudeAgent.execute()` for each lesson
3. **Does NOT reimplement** diagram generation pipeline

---

## File Structure
```
claud_author_agent/
├── src/
│   ├── batch_diagram_generator.py          # NEW: Batch CLI (thin wrapper)
│   ├── diagram_author_cli.py               # EXISTING: Single-lesson CLI (no changes)
│   ├── diagram_author_claude_client.py     # EXISTING: Agent (no changes)
│   └── utils/
│       ├── batch_diagram_utils.py          # NEW: Batch utilities
│       ├── diagram_validator.py            # NEW: Validation wrapper
│       └── diagram_cleanup.py              # NEW: Force delete utilities
```

---

## Core Pattern: Reuse Existing Agent

```python
# batch_diagram_generator.py - CORRECT DRY approach
from src.diagram_author_claude_client import DiagramAuthorClaudeAgent

async def execute_diagram_batch(...):
    """Execute batch by calling existing agent per lesson."""

    for order in lesson_orders:
        # Setup per-lesson logging
        log_file = f"{log_dir}/order_{order}.log"

        # REUSE existing DiagramAuthorClaudeAgent
        agent = DiagramAuthorClaudeAgent(
            mcp_config_path=mcp_config,
            persist_workspace=True,
            log_level=log_level
        )

        # Call existing execute() method (DRY compliance)
        result = await agent.execute(courseId=courseId, order=order)

        # Collect result
        results.append(result)

    return results
```

---

## New Batch-Specific Components

### 1. Main Entry Point (`batch_diagram_generator.py`)

```python
async def main():
    # Parse CLI: --courseId, --order (optional), --dry-run, --force, --yes
    args = parse_arguments()

    # Validate courseId format
    is_valid, error = validate_diagram_author_input(args.courseId, None)
    if not is_valid:
        raise ValueError(error)

    # Determine mode
    if args.order:
        # Single lesson: delegate to existing CLI
        return await run_single_lesson_mode(args)
    else:
        # All lessons: batch mode
        return await run_batch_mode(args)

async def run_batch_mode(args):
    # 1. Fetch lesson orders from Authored_SOW
    lesson_orders = await fetch_lesson_orders_from_sow(args.courseId, mcp_config)

    # 2. Validate ALL lessons FIRST (fast-fail)
    validation_results = await validate_lessons_batch(args.courseId, lesson_orders, mcp_config)

    # 3. Check existing diagrams
    existing_diagrams = await check_existing_diagrams_batch(args.courseId, lesson_orders, mcp_config)

    # 4. Build execution plan (skip/generate/overwrite decisions)
    execution_plan = build_execution_plan(lesson_orders, validation_results, existing_diagrams, args.force)

    # 5. Dry-run: display preview and exit
    if args.dry_run:
        display_dry_run_preview(execution_plan)
        display_estimates(execution_plan)
        return

    # 6. Confirmation prompt (unless --yes)
    if not args.yes:
        confirm_execution(execution_plan)

    # 7. Execute batch (reuse existing agent)
    results = await execute_diagram_batch(
        execution_plan=execution_plan,
        courseId=args.courseId,
        mcp_config=mcp_config,
        log_level=args.log_level,
        force=args.force
    )

    # 8. Write batch summary
    write_batch_summary(results)

    # 9. Display final report
    display_final_report(results)
```

---

### 2. Batch Utilities (`utils/batch_diagram_utils.py`)

```python
async def fetch_lesson_orders_from_sow(courseId, mcp_config):
    """Fetch all lesson orders from Authored_SOW collection."""
    from .diagram_extractor import fetch_sow_entries  # Reuse existing utility

    sow = await fetch_sow_entries(courseId, mcp_config)
    # Extract order field from each SOW entry
    lesson_orders = [entry["order"] for entry in sow]
    return sorted(lesson_orders)

async def check_existing_diagrams_batch(courseId, lesson_orders, mcp_config):
    """Check which diagrams already exist for each lesson."""
    from .appwrite_mcp import list_appwrite_documents

    existing = {}
    for order in lesson_orders:
        # Fetch lesson template to get lessonTemplateId
        template = await fetch_lesson_template(courseId, order, mcp_config)
        if not template:
            existing[order] = []
            continue

        lesson_template_id = template["$id"]

        # Query lesson_diagrams collection
        diagrams = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_diagrams",
            queries=[f'equal("lessonTemplateId", "{lesson_template_id}")'],
            mcp_config_path=mcp_config
        )

        # Extract (cardId, diagram_context) tuples
        existing[order] = [
            (d["cardId"], d.get("diagram_context", "lesson"))
            for d in diagrams.get("documents", [])
        ]

    return existing

def build_execution_plan(lesson_orders, validation_results, existing_diagrams, force):
    """Build execution plan with skip/generate/overwrite decisions."""
    plan = []

    for order in lesson_orders:
        validation = validation_results.get(order, {})

        # Skip if validation failed
        if not validation.get("valid", False):
            plan.append({
                "order": order,
                "action": "SKIP",
                "reason": "Validation failed",
                "errors": validation.get("errors", [])
            })
            continue

        # Get existing diagrams for this lesson
        existing = existing_diagrams.get(order, [])
        eligible_count = validation.get("eligible_cards_count", 0)

        if existing and not force:
            plan.append({
                "order": order,
                "action": "SKIP",
                "reason": f"Already has {len(existing)} diagrams (use --force to regenerate)",
                "existing_count": len(existing)
            })
        elif existing and force:
            plan.append({
                "order": order,
                "action": "OVERWRITE",
                "reason": f"Force regenerate {len(existing)} existing diagrams",
                "existing_count": len(existing),
                "eligible_count": eligible_count
            })
        else:
            plan.append({
                "order": order,
                "action": "GENERATE",
                "reason": f"Generate {eligible_count} new diagrams",
                "eligible_count": eligible_count
            })

    return plan

def display_dry_run_preview(execution_plan):
    """Display ASCII table preview."""
    print("\n" + "="*80)
    print("DRY RUN PREVIEW - No changes will be made")
    print("="*80 + "\n")

    # Summary stats
    total = len(execution_plan)
    skip_count = sum(1 for p in execution_plan if p["action"] == "SKIP")
    generate_count = sum(1 for p in execution_plan if p["action"] == "GENERATE")
    overwrite_count = sum(1 for p in execution_plan if p["action"] == "OVERWRITE")
    malformed = sum(1 for p in execution_plan if "Validation failed" in p.get("reason", ""))

    print(f"Total Lessons: {total}")
    print(f"  - Generate: {generate_count}")
    print(f"  - Overwrite: {overwrite_count}")
    print(f"  - Skip: {skip_count}")
    print(f"  - Malformed (validation failed): {malformed}")
    print("\n")

    # Table
    print(f"{'Order':<8} {'Action':<12} {'Reason':<50}")
    print("-" * 80)

    for p in execution_plan:
        action_color = {
            "GENERATE": "\033[92m",   # Green
            "OVERWRITE": "\033[93m",  # Yellow
            "SKIP": "\033[90m"        # Gray
        }.get(p["action"], "")
        reset = "\033[0m"

        print(
            f"{p['order']:<8} "
            f"{action_color}{p['action']:<12}{reset} "
            f"{p['reason'][:50]:<50}"
        )

    print("\n" + "="*80 + "\n")
```

---

### 3. Validation Wrapper (`utils/diagram_validator.py`)

```python
async def validate_lessons_batch(courseId, lesson_orders, mcp_config):
    """Validate all lessons before batch execution."""
    from .diagram_extractor import fetch_lesson_template, extract_diagram_cards

    results = {}

    for order in lesson_orders:
        try:
            # Fetch lesson template
            template = await fetch_lesson_template(courseId, order, mcp_config)

            if not template:
                results[order] = {
                    "valid": False,
                    "errors": [f"Lesson not found: courseId={courseId}, order={order}"]
                }
                continue

            # Use existing claud_author_agent validator (from CLAUDE.md user instructions)
            # Import from wherever it's defined
            from .lesson_template_validator import validate_lesson_template

            validation_result = validate_lesson_template(template)

            if not validation_result.is_valid:
                results[order] = {
                    "valid": False,
                    "errors": validation_result.errors,
                    "warnings": validation_result.warnings
                }
                continue

            # Count eligible cards
            eligible_cards = await extract_diagram_cards(template, llm_client=None)

            results[order] = {
                "valid": True,
                "warnings": validation_result.warnings,
                "eligible_cards_count": len(eligible_cards)
            }

        except Exception as e:
            logger.error(f"Validation failed for order {order}: {e}")
            results[order] = {
                "valid": False,
                "errors": [str(e)]
            }

    return results
```

---

### 4. Force Delete Utilities (`utils/diagram_cleanup.py`)

```python
async def delete_existing_diagrams_for_lesson(courseId, order, mcp_config):
    """Delete all diagrams for a lesson (database + storage)."""
    from .diagram_extractor import fetch_lesson_template
    from .appwrite_mcp import list_appwrite_documents, delete_appwrite_document
    from .storage_uploader import delete_storage_file

    # Fetch lesson template to get lessonTemplateId
    template = await fetch_lesson_template(courseId, order, mcp_config)
    if not template:
        logger.warning(f"No lesson template found for order {order}")
        return

    lesson_template_id = template["$id"]

    # Query existing diagrams
    diagrams = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_diagrams",
        queries=[f'equal("lessonTemplateId", "{lesson_template_id}")'],
        mcp_config_path=mcp_config
    )

    deleted_count = 0
    for diagram in diagrams.get("documents", []):
        diagram_id = diagram["$id"]
        image_file_id = diagram.get("image_file_id")

        # Delete storage file if exists
        if image_file_id:
            try:
                await delete_storage_file(image_file_id, mcp_config)
                logger.info(f"Deleted storage file: {image_file_id}")
            except Exception as e:
                logger.warning(f"Failed to delete storage file {image_file_id}: {e}")

        # Delete database record
        try:
            await delete_appwrite_document(
                database_id="default",
                collection_id="lesson_diagrams",
                document_id=diagram_id,
                mcp_config_path=mcp_config
            )
            deleted_count += 1
            logger.info(f"Deleted diagram: {diagram_id}")
        except Exception as e:
            logger.error(f"Failed to delete diagram {diagram_id}: {e}")
            raise  # Fast-fail

    logger.info(f"Deleted {deleted_count} diagrams for lesson order {order}")
```

---

### 5. Batch Execution Loop (DRY Compliance)

```python
async def execute_diagram_batch(execution_plan, courseId, mcp_config, log_level, force):
    """Execute batch by REUSING existing DiagramAuthorClaudeAgent per lesson."""
    from src.diagram_author_claude_client import DiagramAuthorClaudeAgent

    results = []
    batch_id = datetime.now().strftime("batch_%Y%m%d_%H%M%S")
    log_dir = Path(f"logs/batch_runs/{batch_id}")
    log_dir.mkdir(parents=True, exist_ok=True)

    for lesson_plan in execution_plan:
        order = lesson_plan["order"]

        if lesson_plan["action"] == "SKIP":
            results.append({
                "order": order,
                "status": "SKIPPED",
                "reason": lesson_plan["reason"]
            })
            logger.info(f"⏭️  Skipping lesson {order}: {lesson_plan['reason']}")
            continue

        logger.info(f"🚀 Processing lesson {order}...")

        # Delete existing if --force
        if force and lesson_plan["action"] == "OVERWRITE":
            await delete_existing_diagrams_for_lesson(courseId, order, mcp_config)

        # Setup per-lesson logging
        lesson_log_file = log_dir / f"order_{order}.log"
        file_handler = logging.FileHandler(lesson_log_file)
        logger.addHandler(file_handler)

        try:
            # ═══════════════════════════════════════════════════════════
            # REUSE EXISTING DiagramAuthorClaudeAgent (DRY compliance)
            # ═══════════════════════════════════════════════════════════
            agent = DiagramAuthorClaudeAgent(
                mcp_config_path=mcp_config,
                persist_workspace=True,
                log_level=log_level
            )

            result = await agent.execute(courseId=courseId, order=order)
            # ═══════════════════════════════════════════════════════════

            results.append({
                "order": order,
                "status": "SUCCESS" if result["success"] else "FAILED",
                "diagrams_generated": result.get("diagrams_generated", 0),
                "diagrams_failed": result.get("diagrams_failed", 0),
                "cost_usd": result["metrics"]["total_cost_usd"],
                "execution_time_seconds": result["metrics"].get("execution_time_seconds", 0)
            })

            if result["success"]:
                logger.info(f"✅ Lesson {order}: {result['diagrams_generated']} diagrams generated")
            else:
                logger.error(f"❌ Lesson {order} failed: {result.get('error', 'Unknown')}")

        except Exception as e:
            logger.error(f"❌ Lesson {order} failed with exception: {e}")
            results.append({
                "order": order,
                "status": "FAILED",
                "error": str(e)
            })

        finally:
            logger.removeHandler(file_handler)

    return results
```

---

## CLI Interface

```bash
# Dry-run for all lessons in course
python -m src.batch_diagram_generator --courseId course_c84874 --dry-run

# Generate diagrams for all lessons
python -m src.batch_diagram_generator --courseId course_c84874 --yes

# Force regenerate all diagrams (deletes existing)
python -m src.batch_diagram_generator --courseId course_c84874 --force --yes

# Single lesson mode (delegates to existing CLI)
python -m src.batch_diagram_generator --courseId course_c84874 --order 5
```

---

## Key DRY Compliance Points

✅ **Reuses**:
- `DiagramAuthorClaudeAgent.execute()` - existing single-lesson pipeline
- `validate_diagram_author_input()` - input validation
- `fetch_lesson_template()` - template fetching
- `extract_diagram_cards()` - card filtering
- `check_diagram_service_health()` - health check

✅ **New batch-specific code only**:
- `fetch_lesson_orders_from_sow()` - get all lesson orders
- `check_existing_diagrams_batch()` - query existing diagrams
- `validate_lessons_batch()` - wrapper around existing validator
- `build_execution_plan()` - skip/generate/overwrite logic
- `display_dry_run_preview()` - ASCII table
- `delete_existing_diagrams_for_lesson()` - force delete
- Batch orchestration loop

❌ **Does NOT reimplement**:
- Diagram generation pipeline
- Visual critique logic
- Appwrite upsert logic
- MCP tool integration

---

## Summary

The batch tool is a **90-line orchestrator** that wraps the existing 574-line `DiagramAuthorClaudeAgent`, following the exact same pattern as `batch_lesson_generator.py` wraps the lesson author agent.
