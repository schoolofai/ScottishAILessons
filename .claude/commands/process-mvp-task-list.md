# Task List Management
The task file is placed within the folder under tasks/ folder with name : $ARGUMENTS. The task file starts with the prfix `tasks-`

### Guidelines for managing task lists in markdown files to track progress on completing a PRD

## Task Implementation
- **One MVP at a time** - Start with the first MVP and progressively go through its tasks and its assocaited sub-tasks.
- **Execute as many subtasks as possible without human intervention** : As the tasks are test driven a task is complete when all tests pass. Use your judgement to bring human in the loop when absolutely neccessary.
- **Completion protocol:**
  1. When you finish a **sub‑task**, immediately mark it as completed by changing `[ ]` to `[x]`.
  2. If **all** subtasks underneath a parent task are now `[x]`, also mark the **parent task** as completed.
  3. If **all** tasks of an MVP are finished mark it as completed by changing `[ ]` to `[x]`.
- Stop after each MVP and wait for the user;s go-ahead before moving on to the next MVP.

## Task List Maintenance
1. **Update the MVPs as you work:**
   - Mark MVP as completed (`[x]`) per the protocol above.
   - Add new MVP as they emerge.


2. **Update the task list as you work:**
   - Mark tasks and subtasks as completed (`[x]`) per the protocol above.
   - Add new tasks as they emerge.

3. **Maintain the “Relevant Files” section:**
   - List every file created or modified.
   - Give each file a one‑line description of its purpose.

## AI Instructions

When working with task lists, the AI must:

1. Regularly update the task list file after finishing any significant work.
2. Follow the completion protocol:
   - Mark each finished **sub‑task** `[x]`.
   - Mark the **parent task** `[x]` once **all** its subtasks are `[x]`.
   - Mark the **parent MVP** `[x]` once **all** its tasks are `[x]`.
3. Add newly discovered tasks.
4. Keep “Relevant Files” accurate and up to date.
5. Before starting work, check which sub‑task is next.
6. After implementing a sub‑task, update the file and then pause for user approval.
7. After every completion of sub-task , tasks and MVP remind yourself to
   1. Read the PRD and High Level Brief , and update them if needed.
   2. Remind yourself to update completion status of sub-tasks , tasks and MVP in the tasks file. 
