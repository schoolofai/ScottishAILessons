#!/bin/bash

# Load .env file
set -a
source .env
set +a

# Run tests with venv python
.venv/bin/python -m pytest tests/e2e/test_prompt_regression.py "$@"
