# Task List Management
The task file is placed within the folder under tasks/ folder with name : $ARGUMENTS. The task file starts with the prfix `tasks-`
Guidelines for managing task lists in markdown files to track progress on completing a PRD.

## Task Implementation

- **Get Specification And Context** - Read the following documentes in the folder @ARGUMENTS - 
  1. Brief - a document starting with prefix - "brief-". This document has details researched about the feature and architectural decisions - read this carefully. 
  2. Product Requirement Document (PRD) - a document starting with prefix - "prd-" , is a formal requirement spec derived from the brief - read and understand these carefully. 
- **Execute as many subtasks as possible without human intervention** : As the tasks are test driven a task is complete when all tests pass. Each task had a details section right underneath it read and understand it , if it evolves update it.  Use your judgement to bring human in the loop when absolutely neccessary.
- **Completion protocol:**  
  1. When you finish a **sub‑task** 
     a. immediately mark it as completed by changing `[ ]` to `[x]`.
     b. for the completed subtask - summarise the changes made and show file and code snippets to clarify concepts. **Put the summary right underneath the subtask within the Tasks Section**  
  2. If **all** subtasks underneath a parent task are now `[x]`, also mark the **parent task** as completed.
  3. When a task and all its subtasks are finished - generate a summary of implementation in @tasks/<@ARGUMENTS>/ folder for the task just finished in a file
  with nameing convetion  "Task-<task number>-summary.md" e.g "Task-1-summary.md" , do the same for each major task completed. Make sure the summary has enough details for any one using the outcome of the task and changing code implementation. 
  4. If a task and **all** its subtasks are completed and the tests are not passing or there are any complicated issues bring human in the loop for feedback   


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
7. Use Playwright MCP to manually exercise code to make sure thinks are going as planned.
6. After every completion of sub-task and tasks  remind yourself to
   1. Read the PRD and High Level Brief , and update them if needed.
   2. Remind yourself to update completion status of sub-tasks , tasks and MVP in the tasks file.
