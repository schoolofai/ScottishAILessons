"""E2E Tests for LangGraph Agent using Python SDK.

This package contains end-to-end tests that use the LangGraph Python SDK
to test the agent as a black box with a running backend server.

The tests start a LangGraph backend server using `langgraph dev` and then
use the LangGraph SDK to interact with it, providing true client-server
testing scenarios.
"""