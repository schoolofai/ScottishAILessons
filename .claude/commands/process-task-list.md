# Task List Management
The task file is placed within the folder under tasks/ folder with name : $ARGUMENTS. The task file starts with the prfix `tasks-`
Guidelines for managing task lists in markdown files to track progress on completing a PRD
## Task Implementation
- **Use OUTSIDE-IN TDD for Task Execution** - the process is defined below.
- **One sub-task at a time:** Do **NOT** start the next sub‑task until you ask the user for permission and they say “yes” or "y"
- **Completion protocol:**  
  1. When you finish a **sub‑task**, immediately mark it as completed by changing `[ ]` to `[x]`.  
  2. If **all** subtasks underneath a parent task are now `[x]`, also mark the **parent task** as completed.  
- Stop after each sub‑task and wait for the user’s go‑ahead.

## OUTSIDE-IN TDD Task Execution - 
Where possible and applicable use the following strategy to implement tasks. 
The outer loop is likely applicable at task level and inner loop for sub-task level , but use your discretion. 
# Outside‑In TDD – Concise Guide for Coding Agent

**Goal:** Implement a feature end‑to‑end by driving from an outer acceptance test inward, one collaborator at a time.

### Workflow

1. **Acceptance test – Red**
   • Write a failing black‑box test that describes the required behaviour.
2. **Bootstrap**
   • Add a minimal façade/controller so the test compiles; keep it red.
3. **Inner loop (unit level)**
   • Pick the current class under test.
   • Write a unit test that mocks its immediate collaborator(s); red.
   • Implement just enough code to satisfy the mock; green.
4. **Cascade inward**
   • Repeat step 3 for each new collaborator until you reach leaf classes with no outgoing deps.
5. **Acceptance test – Green**
   • Run the outer test; it should now pass.
6. **Refactor**
   • Clean names, deduplicate, move code; keep all tests green.
7. **Commit**
   • Vertical slice delivered.

### Rules of Thumb

* Mock/stub only *behavioural* collaborators—never value objects or simple data.
* Replace external I/O (DB, HTTP) with fakes at the lowest sensible layer to keep tests fast.
* Always keep at least one red test until lower‑level tests are green.
* Separate **Red–Green** from **Refactor**; don’t change behaviour while greening.

That’s it—outside‑in TDD in seven steps.


## Task List Maintenance

1. **Update the task list as you work:**
   - Mark tasks and subtasks as completed (`[x]`) per the protocol above.
   - Add new tasks as they emerge.

2. **Maintain the “Relevant Files” section:**
   - List every file created or modified.
   - Give each file a one‑line description of its purpose.

## AI Instructions

When working with task lists, the AI must:

1. Regularly update the task list file after finishing any significant work.
2. Follow the completion protocol:
   - Mark each finished **sub‑task** `[x]`.
   - Mark the **parent task** `[x]` once **all** its subtasks are `[x]`.
3. Add newly discovered tasks.
4. Keep “Relevant Files” accurate and up to date.
5. Before starting work, check which sub‑task is next.
6. After implementing a sub‑task, update the file and then pause for user approval.
