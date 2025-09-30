"""Setup file for langgraph-author-agent."""

from setuptools import setup, find_packages

setup(
    name="langgraph-author-agent",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "langgraph-cli[inmem]",
        "tavily-python",
        "deepagents",
    ],
    python_requires=">=3.11",
)