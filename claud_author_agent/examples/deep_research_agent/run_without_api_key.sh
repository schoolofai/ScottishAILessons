#!/bin/bash

# run_without_api_key.sh
#
# This script deliberately unsets the ANTHROPIC_API_KEY to use
# Claude subscription instead (if available).

echo "================================================================================"
echo "Deep Research Agent - Running with Claude Subscription"
echo "================================================================================"
echo ""
echo "This script will deliberately unset the ANTHROPIC_API_KEY"
echo "to use Claude subscription instead."
echo ""
echo "--------------------------------------------------------------------------------"

# Deliberately unset the API key to use subscription
unset ANTHROPIC_API_KEY

echo "✓ ANTHROPIC_API_KEY has been unset"
echo "✓ SDK will use Claude subscription if available"
echo ""
echo "Running agent..."
echo "--------------------------------------------------------------------------------"
echo ""

# Run the agent
cd "$(dirname "$0")"
python3 deep_research_agent_full.py

echo ""
echo "--------------------------------------------------------------------------------"
echo "Alternative: Run with API key instead of subscription:"
echo "  export ANTHROPIC_API_KEY='your-key-here'"
echo "  python3 deep_research_agent_full.py"
echo "================================================================================"
