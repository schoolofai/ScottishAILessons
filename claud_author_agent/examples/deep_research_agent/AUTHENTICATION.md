# Authentication Guide

The Deep Research Agent supports **multiple authentication methods** through the Claude Agent SDK.

## Authentication Methods

The SDK automatically handles authentication using one of these methods (in order):

1. **API Key** - Set via `ANTHROPIC_API_KEY` environment variable
2. **Claude Subscription** - Uses your Claude.ai account subscription
3. **Session Token** - Uses existing session credentials

## No Forced API Key Check

**Important:** The agent **does not** require or check for `ANTHROPIC_API_KEY`. The SDK handles authentication automatically.

### What This Means

```python
# This works - SDK will use subscription if no API key
agent = DeepResearchAgent()
result = await agent.execute(query)

# This also works - SDK will use API key if set
export ANTHROPIC_API_KEY='sk-...'
result = await agent.execute(query)
```

## Running Without API Key

### Method 1: Run Directly

```bash
# Unset API key (or don't set it)
unset ANTHROPIC_API_KEY

# Run agent - SDK uses subscription
python3 deep_research_agent_full.py
```

### Method 2: Use Demo Script

```bash
# Deliberately unsets API key and runs
python3 run_demo_mode.py
```

### Method 3: Use Shell Script

```bash
# Unsets API key and runs
./run_without_api_key.sh
```

## Running With API Key

```bash
# Set API key
export ANTHROPIC_API_KEY='sk-ant-...'

# Run agent - SDK uses API key
python3 deep_research_agent_full.py
```

## How SDK Handles Authentication

The Claude Agent SDK tries authentication methods in this order:

```
1. Check for ANTHROPIC_API_KEY environment variable
   ├─ If set → Use API key authentication
   └─ If not set → Continue to next method

2. Check for Claude subscription
   ├─ If logged in to Claude.ai → Use subscription
   └─ If not logged in → Continue to next method

3. Check for session credentials
   ├─ If available → Use session token
   └─ If not available → Fail with auth error
```

## What Changed

### Before (Old Behavior)

```python
# Agent checked for API key explicitly
api_key = os.environ.get('ANTHROPIC_API_KEY')
if not api_key:
    raise ValueError("ANTHROPIC_API_KEY not set!")
```

**Problem:** Blocked subscription-based authentication

### After (New Behavior)

```python
# Agent lets SDK handle authentication
# No explicit API key check
# SDK automatically tries all auth methods
```

**Benefit:** Works with both API key and subscription

## Code Changes

### In `deep_research_agent_full.py`

**Removed:**
```python
# Check for API key
api_key = os.environ.get('ANTHROPIC_API_KEY')
if not api_key:
    logger.error("[Execution] ✗ ANTHROPIC_API_KEY not set!")
    raise ValueError("ANTHROPIC_API_KEY not set")
```

**Replaced with:**
```python
# Note: SDK will handle authentication (API key or Claude subscription)
# No need to check for API key - let SDK determine auth method
```

## Examples

### Example 1: Using Subscription

```python
import os
from deep_research_agent_full import DeepResearchAgent

# Make sure API key is not set
if 'ANTHROPIC_API_KEY' in os.environ:
    del os.environ['ANTHROPIC_API_KEY']

# SDK will use Claude subscription
agent = DeepResearchAgent()
result = await agent.execute("Research: Your topic")
```

### Example 2: Using API Key

```python
import os
from deep_research_agent_full import DeepResearchAgent

# Set API key
os.environ['ANTHROPIC_API_KEY'] = 'sk-ant-...'

# SDK will use API key
agent = DeepResearchAgent()
result = await agent.execute("Research: Your topic")
```

### Example 3: Let User Choose

```python
import os
from deep_research_agent_full import DeepResearchAgent

# Don't set anything - SDK chooses best method
agent = DeepResearchAgent()

# If API key is set → uses API key
# If API key not set but subscription available → uses subscription
# If neither → fails with clear SDK auth error
result = await agent.execute("Research: Your topic")
```

## Error Handling

If authentication fails, you'll see an error from the SDK (not from our agent):

```python
try:
    result = await agent.execute(query)
except Exception as e:
    # SDK authentication error
    print(f"Authentication failed: {e}")
    # Could be:
    # - No API key set
    # - No subscription available
    # - Invalid credentials
    # - Network issue
```

## Logging

The agent no longer logs API key checks:

**Before:**
```
[Execution] ✗ ANTHROPIC_API_KEY not set!
[Execution] Please set your API key
```

**After:**
```
[Execution] Starting Deep Research Session
[Execution] Creating agent configuration...
[Execution] Starting query execution...
# SDK handles auth silently
```

## Benefits

1. **Flexible Authentication** - Works with multiple methods
2. **No Forced Requirements** - Don't need API key if you have subscription
3. **SDK Managed** - Let the SDK handle auth complexity
4. **Better UX** - Users can choose their preferred auth method
5. **Future Proof** - Will work with new SDK auth methods

## Troubleshooting

### Agent Fails to Authenticate

**Symptom:** SDK auth error when running

**Solutions:**
- Set API key: `export ANTHROPIC_API_KEY='sk-ant-...'`
- OR ensure you're logged in to Claude.ai
- OR check network connectivity

### Want to Force API Key Only

If you want to require API key:

```python
import os
from deep_research_agent_full import DeepResearchAgent

# Explicitly check before running
if 'ANTHROPIC_API_KEY' not in os.environ:
    raise ValueError("Please set ANTHROPIC_API_KEY")

agent = DeepResearchAgent()
result = await agent.execute(query)
```

### Want to Force Subscription Only

```python
import os
from deep_research_agent_full import DeepResearchAgent

# Explicitly unset API key to force subscription
if 'ANTHROPIC_API_KEY' in os.environ:
    del os.environ['ANTHROPIC_API_KEY']

agent = DeepResearchAgent()
result = await agent.execute(query)
```

## Testing

All test scripts work with both auth methods:

```bash
# Test with subscription (no API key)
python3 run_demo_mode.py

# Test with API key
export ANTHROPIC_API_KEY='sk-ant-...'
python3 deep_research_agent_full.py

# Test workspace persistence (works with both)
python3 test_persistence.py
```

## Migration

If you were checking for API key in your code:

**Old code:**
```python
if not os.environ.get('ANTHROPIC_API_KEY'):
    print("API key required!")
    exit(1)
```

**New code:**
```python
# Just run - SDK handles it
# Will work with API key OR subscription
```

## Summary

✅ **No API key check** - Agent doesn't force API key requirement
✅ **SDK handles auth** - Automatically tries all methods
✅ **Subscription support** - Works with Claude.ai subscription
✅ **API key support** - Still works with API key
✅ **Flexible** - User chooses authentication method
✅ **Future proof** - Compatible with new SDK auth methods

The agent now relies on the Claude Agent SDK to handle all authentication, making it more flexible and user-friendly.
