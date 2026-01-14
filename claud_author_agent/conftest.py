"""
Pytest configuration for claud_author_agent tests.

Sets up the Python path to allow imports from the src directory.
"""

import sys
from pathlib import Path

# Add the claud_author_agent directory to Python path
# This allows imports like: from src.models.nat5_plus_exam_models import ...
CLAUD_AUTHOR_AGENT_ROOT = Path(__file__).parent
if str(CLAUD_AUTHOR_AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(CLAUD_AUTHOR_AGENT_ROOT))
