"""Test system prompt handling with ChatOllama using init_chat_model.

Tests whether system prompts are properly received and respected by the model.
Uses the exact parameters from model_factory.py.
"""

import os
import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

# Test configuration - use llama-3.3-70b (Ollama model) for this test
MODEL_KEY = "llama-3.3-70b"

# Model config from model_factory.py
OLLAMA_CONFIG = {
    "model": "llama3.3:70b",
    "model_provider": "ollama",
    "temperature": 0.7,
    "base_url": "http://localhost:11434",
    "model_kwargs": {"num_ctx": 65536}
}

def test_system_prompt_variations():
    """Test different ways of providing system prompts to ChatOllama."""

    print("=" * 80)
    print("SYSTEM PROMPT TEST - ChatOllama via init_chat_model")
    print("=" * 80)
    print(f"\nModel: {OLLAMA_CONFIG['model']}")
    print(f"Provider: {OLLAMA_CONFIG['model_provider']}")
    print(f"Context Window: {OLLAMA_CONFIG['model_kwargs']['num_ctx']} tokens")
    print()

    # Initialize model using init_chat_model (same as model_factory.py)
    print("Initializing model with init_chat_model...")
    print("-" * 80)
    try:
        llm = init_chat_model(**OLLAMA_CONFIG)
        print(f"✅ Model initialized: {type(llm).__name__}")
        print(f"   Class: {llm.__class__.__module__}.{llm.__class__.__name__}")
    except Exception as e:
        print(f"❌ Failed to initialize model: {e}")
        return
    print()

    # Test 1: System message in messages list (standard approach)
    print("=" * 80)
    print("TEST 1: System Message in Messages List")
    print("=" * 80)
    print("System Prompt: 'You are a helpful assistant. Always respond in Spanish.'")
    print("User Message: 'Hello, how are you?'")
    print("-" * 80)

    try:
        response = llm.invoke([
            SystemMessage(content="You are a helpful assistant. Always respond in Spanish."),
            HumanMessage(content="Hello, how are you?")
        ])
        print(f"Response: {response.content}")
        print(f"Response Type: {type(response).__name__}")

        # Check if response is in Spanish
        spanish_keywords = ['hola', 'estoy', 'bien', 'gracias', 'cómo', 'está']
        is_spanish = any(keyword in response.content.lower() for keyword in spanish_keywords)
        print(f"\n✅ Appears to be Spanish: {is_spanish}")
        if is_spanish:
            print("   ✅ SYSTEM PROMPT RESPECTED")
        else:
            print("   ❌ SYSTEM PROMPT IGNORED (response not in Spanish)")
    except Exception as e:
        print(f"❌ Error: {e}")
    print()

    # Test 2: Stronger system prompt (mathematical constraint)
    print("=" * 80)
    print("TEST 2: Mathematical Constraint System Prompt")
    print("=" * 80)
    print("System Prompt: 'You are a math assistant. Always end your response with the number 42.'")
    print("User Message: 'What is 2+2?'")
    print("-" * 80)

    try:
        response = llm.invoke([
            SystemMessage(content="You are a math assistant. Always end your response with the number 42."),
            HumanMessage(content="What is 2+2?")
        ])
        print(f"Response: {response.content}")

        # Check if response ends with 42
        ends_with_42 = "42" in response.content[-10:]  # Check last 10 chars
        print(f"\n✅ Ends with 42: {ends_with_42}")
        if ends_with_42:
            print("   ✅ SYSTEM PROMPT RESPECTED")
        else:
            print("   ❌ SYSTEM PROMPT IGNORED (doesn't end with 42)")
    except Exception as e:
        print(f"❌ Error: {e}")
    print()

    # Test 3: Persona-based system prompt
    print("=" * 80)
    print("TEST 3: Persona System Prompt")
    print("=" * 80)
    print("System Prompt: 'You are a pirate. Always speak like a pirate with 'arrr' and 'matey'.'")
    print("User Message: 'What is your favorite color?'")
    print("-" * 80)

    try:
        response = llm.invoke([
            SystemMessage(content="You are a pirate. Always speak like a pirate with 'arrr' and 'matey'."),
            HumanMessage(content="What is your favorite color?")
        ])
        print(f"Response: {response.content}")

        # Check for pirate speak
        pirate_keywords = ['arrr', 'matey', 'ye', 'aye', 'cap', 'ahoy']
        has_pirate_speak = any(keyword in response.content.lower() for keyword in pirate_keywords)
        print(f"\n✅ Contains pirate speak: {has_pirate_speak}")
        if has_pirate_speak:
            print("   ✅ SYSTEM PROMPT RESPECTED")
        else:
            print("   ❌ SYSTEM PROMPT IGNORED (no pirate speak)")
    except Exception as e:
        print(f"❌ Error: {e}")
    print()

    # Test 4: No system prompt (baseline)
    print("=" * 80)
    print("TEST 4: No System Prompt (Baseline)")
    print("=" * 80)
    print("User Message: 'Hello, how are you?'")
    print("-" * 80)

    try:
        response = llm.invoke([
            HumanMessage(content="Hello, how are you?")
        ])
        print(f"Response: {response.content}")
        print("\n(This is baseline behavior without system prompt)")
    except Exception as e:
        print(f"❌ Error: {e}")
    print()

    print("=" * 80)
    print("SYSTEM PROMPT TEST COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    test_system_prompt_variations()
