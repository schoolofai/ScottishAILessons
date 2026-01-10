"""DevOps Pipeline Package for Content Authoring.

This package provides a robust orchestration layer for the content authoring
pipelines, including:

- Pipeline 1: Course Creation (seed -> SOW -> lessons -> diagrams)
- Pipeline 2: Mock Exam Generation (planned)
- Pipeline 3: Practice Wizard Generation (planned)

Usage:
    ./pipeline.sh lessons --subject mathematics --level national_5
    ./pipeline.sh lessons --resume <run_id>
"""

__version__ = "1.0.0"
