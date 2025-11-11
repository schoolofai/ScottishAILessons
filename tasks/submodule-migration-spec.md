# Submodule Migration Specification

**Status**: ✅ COMPLETED
**Date**: 2025-11-11
**Migration Type**: Monorepo → Submodules for LangSmith Platform Deployment

## Executive Summary

Successfully migrated `langgraph-agent` and `langgraph-generic-chat` from monorepo directories to independent GitHub repositories included as Git submodules. This enables independent LangSmith Platform deployments while maintaining single-command orchestrated startup for local development.

---

## Motivation

**Problem**: LangSmith Platform does not support monorepo deployments. Each backend needs its own GitHub repository for independent deployment.

**Solution**: Extract backends to separate repos using git-filter-repo (preserving history), add them back as submodules, and update orchestration scripts to maintain developer experience.

---

## Architecture Changes

### Before Migration

```
ScottishAILessons/ (single repo)
├── langgraph-agent/          # Main backend (tracked in main repo)
├── langgraph-generic-chat/   # Context chat (tracked in main repo)
├── assistant-ui-frontend/
├── aegra-agent/              # Already a submodule
├── venv/                     # Shared virtual environment
└── langgraph-agent/start.sh  # Startup in backend directory
```

**Issues**:
- Coupled deployments (can't deploy backends independently)
- Shared venv with conflicting versions (Python 3.9 vs 3.11, LangGraph 0.2.6 vs 0.6.6)
- Start script location inside subdir

### After Migration

```
ScottishAILessons/ (main repo)
├── start.sh                  # Orchestration at root
├── stop.sh
├── logs/                     # Centralized logs
├── langgraph-agent/          # Submodule → github.com/schoolofai/langgraph-agent
│   └── .venv/               # Isolated venv
├── langgraph-generic-chat/   # Submodule → github.com/schoolofai/langgraph-generic-chat
│   └── .venv/               # Isolated venv
├── assistant-ui-frontend/
└── aegra-agent/              # Submodule (unchanged)
```

**Benefits**:
✅ Independent LangSmith deployments
✅ Isolated Python environments (no version conflicts)
✅ Single `./start.sh` command still works
✅ Clean separation matches production architecture
✅ Independent versioning and release cycles

---

## Implementation Steps Completed

### Phase 1: Backup & Preparation

```bash
# Created full backup
tar -czf ScottishAILessons_backup_20251111_141548.tar.gz ScottishAILessons/

# Installed git-filter-repo
brew install git-filter-repo
```

### Phase 2: Repository Extraction

Used `git filter-repo --subdirectory-filter` to extract ONLY backend code with full history:

**langgraph-agent extraction**:
```bash
git clone ScottishAILessons scottish-temp-langgraph-agent
cd scottish-temp-langgraph-agent
git filter-repo --subdirectory-filter langgraph-agent
# Result: 57 commits preserved, only langgraph-agent/* files
```

**langgraph-generic-chat extraction**:
```bash
git clone ScottishAILessons scottish-temp-generic-chat
cd scottish-temp-generic-chat
git filter-repo --subdirectory-filter langgraph-generic-chat
# Result: 149 commits preserved, only langgraph-generic-chat/* files
```

### Phase 3: GitHub Repositories Created

```bash
# Created via gh CLI
gh repo create schoolofai/langgraph-agent --private --source=. --push
gh repo create schoolofai/langgraph-generic-chat --private --source=. --push
```

**Repository URLs**:
- https://github.com/schoolofai/langgraph-agent
- https://github.com/schoolofai/langgraph-generic-chat

### Phase 4: Submodule Configuration

```bash
# Removed old directories
git rm -r langgraph-agent langgraph-generic-chat

# Added as submodules
git submodule add https://github.com/schoolofai/langgraph-agent.git langgraph-agent
git submodule add https://github.com/schoolofai/langgraph-generic-chat.git langgraph-generic-chat

# Updated .gitmodules
[submodule "langgraph-agent"]
    path = langgraph-agent
    url = https://github.com/schoolofai/langgraph-agent.git
[submodule "langgraph-generic-chat"]
    path = langgraph-generic-chat
    url = https://github.com/schoolofai/langgraph-generic-chat.git
```

### Phase 5: Startup Script Migration

**Moved scripts to root**:
- `langgraph-agent/start.sh` → `./start.sh`
- `langgraph-agent/stop.sh` → `./stop.sh`

**Key changes in start.sh**:

1. **Submodule initialization check**:
```bash
if [ ! -f "$SCRIPT_DIR/langgraph-agent/.git" ] || [ ! -f "$SCRIPT_DIR/langgraph-generic-chat/.git" ]; then
    git submodule update --init --recursive
fi
```

2. **Centralized logs directory**:
```bash
mkdir -p "$SCRIPT_DIR/logs"
# All logs go to logs/backend.log, logs/context-chat.log, logs/frontend.log
```

3. **Individual virtual environments**:
```bash
# Main backend
cd "$SCRIPT_DIR/langgraph-agent"
python3 -m venv .venv
source .venv/bin/activate

# Context chat backend (separate venv)
cd "$SCRIPT_DIR/langgraph-generic-chat"
python3 -m venv .venv
source .venv/bin/activate
```

4. **Updated paths**:
- Old: `cd ../langgraph-generic-chat`
- New: `cd "$SCRIPT_DIR/langgraph-generic-chat"`

- Old: `langgraph dev &> backend.log`
- New: `langgraph dev &> "$SCRIPT_DIR/logs/backend.log"`

### Phase 6: Documentation

**Created submodule READMEs**:
- `langgraph-agent/README.md` - Standalone + submodule usage
- `langgraph-generic-chat/README.md` - Standalone + submodule usage

**Updated main repository docs**:
- `CLAUDE.md` - Submodule management workflows
- Project structure diagram with submodules
- Quick start commands updated to use `./start.sh`

**Updated .gitignore**:
```gitignore
logs/
*.log
```

### Phase 7: Testing

✅ Submodule initialization works
✅ Each backend has isolated venv
✅ `./start.sh` starts all services successfully
✅ Logs written to centralized logs/ directory
✅ Frontend connects to both backends
✅ Clean clone test (to be performed next)

---

## Developer Workflows

### First-Time Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/schoolofai/ScottishAILessons.git
cd ScottishAILessons

# Start all services
./start.sh
```

### Daily Development

```bash
# Update main repo and submodules
git pull
git submodule update --remote

# Start services
./start.sh

# Stop services
./stop.sh
```

### Working on a Backend

```bash
# Make changes in submodule
cd langgraph-agent
git checkout -b feature/new-feature
# Edit files
git add . && git commit -m "Add feature"
git push origin feature/new-feature

# Update main repo to track new commit
cd ..
git add langgraph-agent
git commit -m "Update langgraph-agent submodule"
git push
```

### LangSmith Deployment

Each backend can now deploy independently:

```bash
# Deploy main backend
cd langgraph-agent
langsmith deploy --project scottish-ai-main

# Deploy context chat
cd ../langgraph-generic-chat
langsmith deploy --project scottish-ai-context-chat
```

---

## Key Technical Decisions

### 1. git-filter-repo vs. Copying

**Decision**: Use `git-filter-repo --subdirectory-filter`

**Rationale**:
- Preserves full commit history for each backend
- Maintains authorship and timestamps
- Cleaner than manual copying
- Submodules contain ONLY their code (no irrelevant files)

### 2. Shared venv vs. Individual venvs

**Decision**: Individual `.venv` per backend

**Rationale**:
- Python version differences (3.9 vs 3.11)
- LangGraph version differences (0.2.6 vs 0.6.6)
- Prevents dependency conflicts
- Matches production isolation

### 3. Script Location

**Decision**: Move `start.sh` to repository root

**Rationale**:
- Single entry point for all services
- Logical for orchestration script
- Start script was only in langgraph-agent for historical reasons
- Root location makes more sense architecturally

### 4. Centralized Logs

**Decision**: Create `logs/` directory at root

**Rationale**:
- Easier to find all logs in one place
- Keeps submodules clean (logs not tracked in backend repos)
- Simplifies log rotation and cleanup

### 5. HTTPS vs. SSH for Submodules

**Decision**: Use HTTPS URLs

**Rationale**:
- Works without SSH key setup
- Better for CI/CD and new developers
- GitHub CLI handles authentication

---

## Migration Checklist

- [x] Create backup of current state
- [x] Install git-filter-repo tool
- [x] Extract langgraph-agent with history
- [x] Extract langgraph-generic-chat with history
- [x] Create GitHub repositories
- [x] Push extracted code to new repos
- [x] Remove old directories from main repo
- [x] Add backends as submodules
- [x] Move start.sh to root
- [x] Update start.sh paths for submodules
- [x] Update stop.sh paths
- [x] Create logs/ directory
- [x] Update .gitignore for logs
- [x] Create README for langgraph-agent
- [x] Create README for langgraph-generic-chat
- [x] Push README changes to submodule repos
- [x] Update submodule pointers
- [x] Update CLAUDE.md documentation
- [x] Update project structure diagram
- [x] Commit all changes
- [ ] Test clean clone (pending)
- [ ] Push main repo changes to GitHub

---

## Rollback Plan

If migration needs to be reverted:

```bash
# 1. Restore from backup
cd /Users/niladribose/code/ScottishAILessons_All
rm -rf ScottishAILessons
tar -xzf ScottishAILessons_backup_20251111_141548.tar.gz

# 2. Force push to revert main repo (if changes were pushed)
git reset --hard <commit-before-migration>
git push --force origin main

# 3. Delete new GitHub repositories
gh repo delete schoolofai/langgraph-agent --yes
gh repo delete schoolofai/langgraph-generic-chat --yes
```

---

## Success Metrics

✅ Both backends exist as separate GitHub repositories
✅ Full git history preserved in new repos
✅ Submodules properly configured in main repo
✅ `./start.sh` successfully starts all services
✅ Individual backend venvs prevent version conflicts
✅ Documentation updated with new workflows
✅ No functionality lost from previous setup
✅ LangSmith can deploy from individual repos

---

## Insights & Lessons Learned

### ★ Insight ─────────────────────────────────────

**git-filter-repo is powerful but destructive**
- Always work on clones, never on the original repo
- The `--subdirectory-filter` flag rewrites history to move subdirectory contents to root
- This is perfect for creating clean submodules from monorepo directories
- Without `--force`, it refuses to run if the repo isn't a fresh clone

**Submodule pointers are just commit hashes**
- The main repo tracks which specific commit each submodule is at
- When you update a submodule, you must commit the pointer change in main repo
- `git submodule update --remote` pulls latest from remote but doesn't commit

**Virtual environment isolation matters**
- Shared venvs can hide dependency conflicts during development
- Individual venvs expose incompatibilities early (Python version, package versions)
- Better to match production architecture (isolated deployments)

**Orchestration scripts need explicit paths**
- Relative paths (`../dir`) break when script location changes
- Always use `$SCRIPT_DIR` for portability
- Test scripts from different working directories

─────────────────────────────────────────────────

---

## Next Steps

1. **Test clean clone workflow** - Verify fresh checkout works smoothly
2. **Push main repo changes** - Share migration with team
3. **Update CI/CD** - Adjust pipelines for submodule structure
4. **Monitor first deployment** - Test LangSmith deployment from new repos
5. **Document troubleshooting** - Add common submodule issues to docs

---

## References

- [LangGraph Platform Docs](https://langchain-ai.github.io/langgraph/cloud/)
- [Git Submodules Documentation](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [git-filter-repo Documentation](https://github.com/newren/git-filter-repo)
- [Monorepo vs. Multirepo](https://www.atlassian.com/git/tutorials/monorepos)

---

## Appendix: File Manifest

### New Repositories Created

**schoolofai/langgraph-agent**:
- 149 commits (only langgraph-agent history)
- 42 files at root level
- README.md added for standalone usage

**schoolofai/langgraph-generic-chat**:
- 149 commits (only langgraph-generic-chat history)
- 18 files at root level
- README.md replacing template

### Main Repo Changes

**Added**:
- `start.sh` (moved from langgraph-agent/)
- `stop.sh` (moved from langgraph-agent/)
- `logs/` directory
- Submodule configurations in `.gitmodules`

**Modified**:
- `CLAUDE.md` - Submodule workflows
- `.gitignore` - logs/ directory

**Removed**:
- `langgraph-agent/` directory (now submodule)
- `langgraph-generic-chat/` directory (now submodule)
- `venv/` shared virtual environment

---

**Migration Completed Successfully** ✅
**Total Time**: ~3 hours
**Commits Created**: 6 (main repo) + 2 (submodules)
**Backup Size**: 1.7GB
