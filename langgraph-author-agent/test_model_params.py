"""Test script to print exact parameters passed to init_chat_model.

This script initializes the model and prints the exact parameters
that would be passed to init_chat_model() for the current configuration.
"""

import os
import sys
import logging
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Set up logging to capture model factory output
logging.basicConfig(level=logging.INFO, format='%(message)s')

# Import after path setup
from src.model_factory import MODEL_CONFIGS, get_model

def print_model_parameters():
    """Print exact parameters for current model configuration."""

    # Get current model key from environment
    model_key = os.getenv("LESSON_MODEL_VERSION")

    if not model_key:
        print("ERROR: LESSON_MODEL_VERSION not set in environment")
        return

    print("=" * 80)
    print(f"MODEL INITIALIZATION PARAMETERS")
    print("=" * 80)
    print(f"\nCurrent LESSON_MODEL_VERSION: {model_key}")
    print()

    # Get config for current model
    if model_key not in MODEL_CONFIGS:
        print(f"ERROR: Model key '{model_key}' not found in MODEL_CONFIGS")
        return

    config = MODEL_CONFIGS[model_key]

    print(f"Model Configuration from MODEL_CONFIGS:")
    print(f"  provider: {config['provider']}")
    print(f"  model_name: {config['model_name']}")
    print(f"  temperature: {config['temperature']}")
    if config.get('base_url'):
        print(f"  base_url: {config['base_url']}")
    if config.get('num_ctx'):
        print(f"  num_ctx: {config['num_ctx']} tokens ({config['num_ctx']/1024:.1f}K)")
    print()

    # Build the exact init_kwargs that would be passed to init_chat_model
    init_kwargs = {
        "model": config["model_name"],
        "model_provider": config["provider"],
        "temperature": config["temperature"]
    }

    # Add Ollama-specific configuration (matching model_factory.py logic)
    if config["provider"] == "ollama":
        init_kwargs["base_url"] = config.get("base_url", "http://localhost:11434")

        # Pass context window configuration via model_kwargs
        if "num_ctx" in config:
            init_kwargs["model_kwargs"] = {"num_ctx": config["num_ctx"]}

    print("=" * 80)
    print("EXACT PARAMETERS PASSED TO init_chat_model():")
    print("=" * 80)
    print()
    print("init_kwargs = {")
    for key, value in init_kwargs.items():
        if isinstance(value, str):
            print(f'    "{key}": "{value}",')
        elif isinstance(value, dict):
            print(f'    "{key}": {value},')
        else:
            print(f'    "{key}": {value},')
    print("}")
    print()

    # Show the actual function call
    print("Equivalent function call:")
    print("=" * 80)
    print("model = init_chat_model(")
    for key, value in init_kwargs.items():
        if isinstance(value, str):
            print(f'    {key}="{value}",')
        elif isinstance(value, dict):
            print(f'    {key}={value},')
        else:
            print(f'    {key}={value},')
    print(")")
    print()
    print("=" * 80)

    # Actually test initialization (with error handling)
    print("\nTesting actual model initialization...")
    print("-" * 80)
    try:
        model = get_model(model_key)
        print(f"✅ Model initialized successfully!")
        print(f"   Model type: {type(model).__name__}")
        print(f"   Model class: {model.__class__.__module__}.{model.__class__.__name__}")
    except Exception as e:
        print(f"❌ Model initialization failed: {e}")
    print("=" * 80)


if __name__ == "__main__":
    print_model_parameters()
