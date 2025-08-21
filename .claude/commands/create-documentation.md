---
name: create-documentation
description: Generate comprehensive documentation for a feature folder including review instructions
---

# Create Feature Documentation

Generate comprehensive documentation for a feature in the tasks folder.

## Usage

```
/create-documentation <feature-folder-name>
```

Example:
```
/create-documentation integrate-pdf-extractor
```

## Implementation

First, I'll check if the feature folder exists:

```bash
ls tasks/$ARGUMENTS/
```

Then I'll read the three key documents:

1. **High-level spec**: Find the .md file without prd- or tasks- prefix
2. **PRD**: Find the file starting with prd-
3. **Tasks**: Find the file starting with tasks-

Next, I'll analyze the uncommitted and untracked changes:

```bash
git status --porcelain
git diff
git diff --staged
# For untracked files, I'll read their contents
git ls-files --others --exclude-standard
```

Finally, I'll generate a comprehensive README.md in the feature folder with:

### 1. Feature Overview
- Summary from spec and PRD
- Key objectives and goals

### 2. New Functionality Added
- List of implemented features based on completed tasks
- Technical components added

### 3. Testing Instructions
- Prerequisites and setup
- Step-by-step test cases
- Expected outcomes

### 4. Code Review Guide

For each modified file:
- Purpose of changes
- Key diff snippets
- Review checklist

### 5. Architecture Changes
- Database schema updates
- New API endpoints
- State management changes
- Dependencies added

The README will be saved to `tasks/$ARGUMENTS/README.md`

## Output Format

The generated README.md will include:

```markdown
# Feature: [Feature Name]

## Overview
[Summary from spec and PRD]

## New Functionality Added
- [List of features implemented]
- [Based on tasks completed]

## Testing Instructions

### Prerequisites
- [Required setup]

### Test Cases
1. [Step-by-step test scenarios]
2. [Expected outcomes]

## Code Review Guide

### Files Modified
- `path/to/file1.ts` - [Purpose of changes]
- `path/to/file2.tsx` - [Purpose of changes]

### Detailed Review Steps

#### 1. [Component/Module Name]
**File**: `path/to/file.ts`
**Changes**: [Summary of what was changed]

\`\`\`diff
[Relevant diff snippet]
\`\`\`

**Review Points**:
- [ ] Check [specific aspect]
- [ ] Verify [integration point]
- [ ] Test [edge case]

### Architecture Changes
- [Database schema updates]
- [New API endpoints]
- [State management changes]

## Integration Notes
- [Dependencies added]
- [Configuration changes]
- [Migration requirements]
```

## Example Output

Running `@create-documentation tasks/integrate-pdf-extractor/` would generate:

```markdown
# Feature: PDF Extractor Integration

## Overview
Integration of external PDF extractor service for enhanced document processing...

## New Functionality Added
- WebSocket progress tracking for PDF extraction
- Real-time status updates in UI
- Retry mechanism for failed extractions
...
```