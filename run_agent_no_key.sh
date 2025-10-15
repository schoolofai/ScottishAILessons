#!/bin/bash

# Script to run the Claude agent with ANTHROPIC_API_KEY unset
# This tests if the agent can use Claude Max subscription without explicit API key

echo "======================================================================"
echo "Testing Claude Agent SDK without ANTHROPIC_API_KEY"
echo "======================================================================"
echo ""

# Check if ANTHROPIC_API_KEY is currently set
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "Current ANTHROPIC_API_KEY is set: ${ANTHROPIC_API_KEY:0:10}..."
    echo "Unsetting ANTHROPIC_API_KEY for this test"
else
    echo "ANTHROPIC_API_KEY is not set"
fi

echo ""
echo "Running agent..."
echo "----------------------------------------------------------------------"
echo ""

# Unset the API key and run the agent
unset ANTHROPIC_API_KEY
./venv/bin/python examples/simple_agent.py

# Capture exit code
EXIT_CODE=$?

echo ""
echo "----------------------------------------------------------------------"
echo "Test completed with exit code: $EXIT_CODE"

if [ $EXIT_CODE -eq 0 ]; then
    echo "SUCCESS: Agent ran successfully without explicit API key!"
    echo "This suggests it's using Claude Max subscription or other auth."
else
    echo "FAILED: Agent could not authenticate without API key."
    echo "You may need to set ANTHROPIC_API_KEY or configure authentication."
fi

exit $EXIT_CODE
