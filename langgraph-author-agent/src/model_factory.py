"""Model Factory for Lesson Author Agent.

Centralized model initialization supporting multiple AI providers:
- Google Gemini (via google_genai)
- DeepSeek-R1 (via Ollama)

Uses LangChain's init_chat_model for provider-agnostic interface.
NO FALLBACK PATTERN - Fails fast with detailed error messages.
"""

import os
import logging
from typing import Optional
from langchain_core.language_models import BaseChatModel
from langchain.chat_models import init_chat_model

# Configure logging
logger = logging.getLogger(__name__)

# Model configuration registry
# IMPORTANT: All Ollama models MUST support tool calling (function calling) for DeepAgents
MODEL_CONFIGS = {
    # ═══════════════════════════════════════════════════════════════
    # Google Gemini Models (Cloud, Paid)
    # ═══════════════════════════════════════════════════════════════
    "gemini-flash-lite": {
        "provider": "google_genai",
        "model_name": "models/gemini-flash-latest",
        "requires_api_key": "GOOGLE_API_KEY",
        "temperature": 0.7,
        "description": "Fast, cost-effective Gemini model for lesson generation"
    },
    "gemini-2.5-pro": {
        "provider": "google_genai",
        "model_name": "gemini-2.5-pro",
        "requires_api_key": "GOOGLE_API_KEY",
        "temperature": 0.7,
        "description": "High-quality Gemini model (default)"
    },

    # ═══════════════════════════════════════════════════════════════
    # Open Source Models via Ollama (Local, Free)
    # All models below have verified tool calling support
    # ═══════════════════════════════════════════════════════════════

    # ⭐ TOP PICK: GPT-OSS-20B - OpenAI's open-weight model for agentic workflows
    "gpt-oss-20b": {
        "provider": "ollama",
        "model_name": "gpt-oss:20b",
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 65536,  # 64K context window for complex reasoning and lesson authoring
        "description": "OpenAI GPT-OSS-20B (13GB) - Native tool calling, reasoning-focused, agentic workflows (TOP PICK)",
        "ollama_pull_command": "ollama pull gpt-oss:20b"
    },

    # Recommended: Llama 4 Scout - Latest Meta model with MoE architecture (April 2025)
    "llama-4-scout": {
        "provider": "ollama",
        "model_name": "llama4",  # Default Llama 4 = Scout variant
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 65536,  # 64K context window for lesson authoring with research/critic subagents
        "description": "Meta Llama 4 Scout (67GB) - MoE architecture, 10M context, excellent tool calling (RECOMMENDED)",
        "ollama_pull_command": "ollama pull llama4"
    },

    # Alternative: Llama 3.3 70B - Previous generation, still excellent
    "llama-3.3-70b": {
        "provider": "ollama",
        "model_name": "llama3.3:70b",
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 65536,  # 64K context window for complex lesson authoring
        "description": "Meta Llama 3.3 70B - Proven tool calling, stable (previous gen)",
        "ollama_pull_command": "ollama pull llama3.3:70b"
    },

    # Alternative: Llama 3.1 70B - Proven tool calling capabilities
    "llama-3.1-70b": {
        "provider": "ollama",
        "model_name": "llama3.1:70b",
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 32768,  # 32K context window (older model, more conservative)
        "description": "Meta Llama 3.1 70B - Proven tool calling, widely tested",
        "ollama_pull_command": "ollama pull llama3.1:70b"
    },

    # Alternative: Qwen2.5 72B - Strong reasoning and tool use
    "qwen-2.5-72b": {
        "provider": "ollama",
        "model_name": "qwen2.5:72b",
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 65536,  # 64K context window for strong reasoning workloads
        "description": "Alibaba Qwen2.5 72B - Strong reasoning and tool calling",
        "ollama_pull_command": "ollama pull qwen2.5:72b"
    },

    # Budget Option: Llama 3.1 8B - Smaller model with tool support
    "llama-3.1-8b": {
        "provider": "ollama",
        "model_name": "llama3.1:8b",
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 16384,  # 16K context window (smaller model, memory-conscious)
        "description": "Meta Llama 3.1 8B - Fast, lower memory, basic tool calling",
        "ollama_pull_command": "ollama pull llama3.1:8b"
    },

    # Alternative: Mixtral 8x22B - Mistral's large MoE model
    "mixtral-8x22b": {
        "provider": "ollama",
        "model_name": "mixtral:8x22b",
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 32768,  # 32K context window (MoE architecture, balanced)
        "description": "Mistral Mixtral 8x22B - Mixture of Experts with tool support",
        "ollama_pull_command": "ollama pull mixtral:8x22b"
    },

    # Alternative: Command-R Plus - Cohere's RAG-optimized model
    "command-r-plus": {
        "provider": "ollama",
        "model_name": "command-r-plus",
        "requires_api_key": None,
        "temperature": 0.7,
        "base_url": "http://localhost:11434",
        "num_ctx": 32768,  # 32K context window (RAG-optimized, moderate needs)
        "description": "Cohere Command-R Plus - Optimized for RAG and tool use",
        "ollama_pull_command": "ollama pull command-r-plus"
    }
}


class ModelInitializationError(Exception):
    """Raised when model initialization fails."""
    pass


def get_model(
    model_key: Optional[str] = None,
    temperature: Optional[float] = None
) -> BaseChatModel:
    """Initialize chat model based on model_key.

    Args:
        model_key: Model identifier from MODEL_CONFIGS (e.g., "gemini-2.5-pro")
                  If None, reads from LESSON_MODEL_VERSION env var
                  If env var not set, raises error (NO FALLBACK)
        temperature: Override default temperature (optional)

    Returns:
        Initialized BaseChatModel instance

    Raises:
        ModelInitializationError: If model_key is invalid or required API key missing
        ValueError: If model_key is None and LESSON_MODEL_VERSION not set

    Example:
        >>> model = get_model("gemini-2.5-pro")
        >>> model = get_model()  # Reads from LESSON_MODEL_VERSION env var
    """
    # Determine model key
    if model_key is None:
        model_key = os.getenv("LESSON_MODEL_VERSION")
        if not model_key:
            error_msg = (
                "Model selection required but not provided. "
                "Set LESSON_MODEL_VERSION environment variable or pass model_key parameter. "
                f"Available models: {list(MODEL_CONFIGS.keys())}"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)
        logger.info(f"Using model from LESSON_MODEL_VERSION env var: {model_key}")

    # Validate model key
    if model_key not in MODEL_CONFIGS:
        error_msg = (
            f"Invalid model key: '{model_key}'. "
            f"Available models: {list(MODEL_CONFIGS.keys())}"
        )
        logger.error(error_msg)
        raise ModelInitializationError(error_msg)

    config = MODEL_CONFIGS[model_key]
    logger.info(f"Initializing model: {model_key} ({config['description']})")

    # Check API key requirement (fail fast if missing)
    if config["requires_api_key"]:
        api_key_env = config["requires_api_key"]
        if not os.getenv(api_key_env):
            error_msg = (
                f"Model '{model_key}' requires {api_key_env} environment variable. "
                f"Please set {api_key_env} before using this model."
            )
            logger.error(error_msg)
            raise ModelInitializationError(error_msg)
        logger.info(f"API key found for {api_key_env}")

    # Determine temperature
    final_temperature = temperature if temperature is not None else config["temperature"]

    # Build init_chat_model kwargs
    init_kwargs = {
        "model": config["model_name"],
        "model_provider": config["provider"],
        "temperature": final_temperature
    }

    # Add Ollama-specific configuration
    if config["provider"] == "ollama":
        init_kwargs["base_url"] = config.get("base_url", "http://localhost:11434")

        # Pass context window configuration via model_kwargs
        if "num_ctx" in config:
            init_kwargs["model_kwargs"] = {"num_ctx": config["num_ctx"]}
            context_kb = config["num_ctx"] / 1024
            logger.info(f"Ollama context window: {config['num_ctx']} tokens ({context_kb:.1f}K)")

        logger.info(f"Ollama base URL: {init_kwargs['base_url']}")

    # Initialize model (fail fast on any errors)
    try:
        model = init_chat_model(**init_kwargs)
        logger.info(
            f"✅ Model initialized successfully: {model_key} "
            f"(provider={config['provider']}, temperature={final_temperature})"
        )
        return model
    except Exception as e:
        error_msg = (
            f"Failed to initialize model '{model_key}'. "
            f"Provider: {config['provider']}, Error: {str(e)}"
        )
        if config["provider"] == "ollama":
            pull_cmd = config.get("ollama_pull_command", f"ollama pull {config['model_name']}")
            context_info = f"{config.get('num_ctx', 'default')} tokens" if "num_ctx" in config else "default"
            error_msg += (
                f"\n\n🔧 Ollama Troubleshooting:"
                f"\n1. Ensure Ollama is running: ollama serve"
                f"\n2. Pull the model: {pull_cmd}"
                f"\n3. Verify base URL: {config.get('base_url')}"
                f"\n4. Test model directly: ollama run {config['model_name']}"
                f"\n5. Context window: {context_info}"
                f"\n\n⚠️  Memory errors? Reduce num_ctx in model_factory.py"
                f"\n⚠️  DeepSeek-R1 Note: If you tried DeepSeek-R1, it does NOT support"
                f"\n   tool calling (required for DeepAgents). Use Llama 4 Scout instead."
            )
        logger.error(error_msg)
        raise ModelInitializationError(error_msg) from e


def list_available_models() -> dict[str, str]:
    """Return dict of available model keys and descriptions.

    Returns:
        Dict mapping model_key -> description

    Example:
        >>> models = list_available_models()
        >>> print(models)
        {
            'gemini-flash-lite': 'Fast, cost-effective Gemini model...',
            'gemini-2.5-pro': 'High-quality Gemini model (default)',
            ...
        }
    """
    return {key: config["description"] for key, config in MODEL_CONFIGS.items()}


if __name__ == "__main__":
    # CLI testing utility
    print("Available Models:")
    print("=" * 80)
    for model_key, description in list_available_models().items():
        config = MODEL_CONFIGS[model_key]
        print(f"\n{model_key}:")
        print(f"  Description: {description}")
        print(f"  Provider: {config['provider']}")
        print(f"  Model Name: {config['model_name']}")
        if config['requires_api_key']:
            print(f"  Requires: {config['requires_api_key']} env var")
        else:
            print(f"  Requires: Ollama running at {config.get('base_url', 'N/A')}")
    print("\n" + "=" * 80)
