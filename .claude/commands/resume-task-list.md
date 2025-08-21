# Rule: Continue implementing tasks in task list from where we left off

## Goal
This command takes arguments - which is of the format <feature_name> <additional instructions> . The feature_name is used to find the feature's task directory as described below. 

To guide the AI assistant to continue tasks from a task list withing the tasks/ directory under the feature directory  tasks/<Feature_name> the feature name is $ARGUMENTS. The feature directory has three files - 
1. a high level brief 2. a product requirement document with prefix - prd 3. A task list based on the PRD with prefix tasks-prd. The goal is to first read these documents and associated code and continue executing the tasks , first confirm with the user the exact task you are going to continue from and the plan to give the user good context of where you left off from. 

