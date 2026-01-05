"""Integration tester for diagram rendering services.

Performs actual render tests with minimal payloads to validate
the full rendering pipeline before batch execution.

Usage:
    python -m src.utils.integration_tester
    python -m src.utils.integration_tester --url http://localhost:3001
    python -m src.utils.integration_tester --api-key your-key
"""

import asyncio
import base64
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class RenderTestResult:
    """Result of a single render test."""

    tool: str
    success: bool
    response_time_ms: float
    image_size_bytes: int = 0
    error: Optional[str] = None


@dataclass
class IntegrationTestResult:
    """Result of all integration tests."""

    all_passed: bool
    results: List[RenderTestResult] = field(default_factory=list)
    total_time_ms: float = 0.0


class DiagramIntegrationTester:
    """Integration tester that renders actual test images."""

    # Minimal test payloads for each tool
    TEST_PAYLOADS: Dict[str, Dict[str, Any]] = {
        "desmos": {
            "endpoint": "/api/v1/render/desmos/simple",
            "payload": {
                "expressions": [{"latex": "y=x^2", "color": "#2d70b3"}],
                "viewport": {"xmin": -5, "xmax": 5, "ymin": -1, "ymax": 10},
                "options": {"width": 400, "height": 300, "format": "png"},
            },
        },
        "jsxgraph": {
            "endpoint": "/api/v1/render",
            "payload": {
                "diagram": {
                    "board": {"boundingbox": [-5, 5, 5, -5], "axis": True, "grid": True},
                    "elements": [
                        {
                            "type": "point",
                            "args": [0, 0],
                            "attributes": {"name": "O", "size": 3},
                        }
                    ],
                },
                "options": {"width": 400, "height": 300, "format": "png"},
            },
        },
        "plotly": {
            "endpoint": "/api/v1/render/plotly",
            "payload": {
                "chart": {
                    "data": [
                        {
                            "type": "scatter",
                            "x": [1, 2, 3],
                            "y": [1, 4, 9],
                            "mode": "lines",
                        }
                    ],
                    "layout": {"title": "Test", "width": 400, "height": 300},
                },
                "options": {"format": "png"},
            },
        },
        "geogebra": {
            "endpoint": "/api/v1/render/geogebra/simple",
            "payload": {
                "commands": ["A = (0, 0)", "B = (3, 0)", "Segment(A, B)"],
                "coordSystem": {"xmin": -1, "xmax": 4, "ymin": -1, "ymax": 2},
                "options": {"width": 400, "height": 300, "format": "png"},
            },
        },
        # Note: Imagen excluded from integration tests (rate limited, costs money)
    }

    RENDER_TIMEOUT = 30.0  # seconds per render

    def __init__(self, base_url: str, api_key: str):
        """Initialize the integration tester.

        Args:
            base_url: DiagramScreenshot service base URL
            api_key: API key for authentication
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def run_all_tests(self) -> IntegrationTestResult:
        """Run integration tests for all diagram tools.

        Returns:
            IntegrationTestResult with all test outcomes
        """
        results = []
        total_start = time.time()

        for tool, config in self.TEST_PAYLOADS.items():
            result = await self._test_renderer(tool, config)
            results.append(result)

        total_time = (time.time() - total_start) * 1000
        all_passed = all(r.success for r in results)

        return IntegrationTestResult(
            all_passed=all_passed, results=results, total_time_ms=total_time
        )

    async def _test_renderer(
        self, tool: str, config: Dict[str, Any]
    ) -> RenderTestResult:
        """Test a single renderer with minimal payload.

        Args:
            tool: Name of the tool being tested
            config: Configuration dict with endpoint and payload

        Returns:
            RenderTestResult with test outcome
        """
        endpoint = f"{self.base_url}{config['endpoint']}"
        payload = config["payload"]

        headers = {"X-API-Key": self.api_key, "Content-Type": "application/json"}

        try:
            start = time.time()
            async with httpx.AsyncClient(timeout=self.RENDER_TIMEOUT) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
                elapsed_ms = (time.time() - start) * 1000

            if response.status_code != 200:
                return RenderTestResult(
                    tool=tool,
                    success=False,
                    response_time_ms=elapsed_ms,
                    error=f"HTTP {response.status_code}: {response.text[:200]}",
                )

            data = response.json()

            # Validate response has actual image data
            if not data.get("success"):
                error_info = data.get("error", "Unknown error")
                if isinstance(error_info, dict):
                    error_info = error_info.get("message", str(error_info))
                return RenderTestResult(
                    tool=tool,
                    success=False,
                    response_time_ms=elapsed_ms,
                    error=f"Render failed: {error_info}",
                )

            image_data = data.get("image", "")
            if not image_data:
                return RenderTestResult(
                    tool=tool,
                    success=False,
                    response_time_ms=elapsed_ms,
                    error="No image data returned",
                )

            # Validate it's actual base64 image data
            # Strip data URI prefix if present
            if image_data.startswith("data:"):
                image_data = (
                    image_data.split(",", 1)[1] if "," in image_data else ""
                )

            try:
                decoded = base64.b64decode(image_data)
                if len(decoded) < 100:  # Minimum reasonable PNG size
                    return RenderTestResult(
                        tool=tool,
                        success=False,
                        response_time_ms=elapsed_ms,
                        error=f"Image too small ({len(decoded)} bytes) - likely empty/invalid",
                    )
            except Exception as e:
                return RenderTestResult(
                    tool=tool,
                    success=False,
                    response_time_ms=elapsed_ms,
                    error=f"Invalid base64 image data: {e}",
                )

            return RenderTestResult(
                tool=tool,
                success=True,
                response_time_ms=elapsed_ms,
                image_size_bytes=len(decoded),
            )

        except httpx.ConnectError as e:
            return RenderTestResult(
                tool=tool,
                success=False,
                response_time_ms=0,
                error=f"Connection failed: {e}",
            )
        except httpx.TimeoutException:
            return RenderTestResult(
                tool=tool,
                success=False,
                response_time_ms=self.RENDER_TIMEOUT * 1000,
                error=f"Timeout after {self.RENDER_TIMEOUT}s",
            )
        except Exception as e:
            return RenderTestResult(
                tool=tool,
                success=False,
                response_time_ms=0,
                error=f"Unexpected error: {e}",
            )


async def run_integration_tests(
    diagram_service_url: str = "http://localhost:3001", api_key: str = ""
) -> bool:
    """Run all pre-execution integration tests.

    Args:
        diagram_service_url: DiagramScreenshot service URL
        api_key: API key for render endpoints

    Returns:
        True if all tests passed, False otherwise

    Raises:
        RuntimeError: If matplotlib test fails (fail-fast)
    """
    print()
    print("=" * 70)
    print("        DIAGRAM SERVICE INTEGRATION TESTS")
    print("=" * 70)
    print()

    # Check matplotlib locally first
    print("  🔍 Testing local Matplotlib...")
    try:
        import matplotlib

        matplotlib.use("Agg")  # Non-interactive backend
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [1, 4, 9])
        plt.close(fig)
        print("  ✅ Matplotlib: OK (local execution ready)")
    except Exception as e:
        raise RuntimeError(f"Matplotlib test failed: {e}")

    print()
    print(f"  🔍 Testing DiagramScreenshot service at {diagram_service_url}...")
    print()

    tester = DiagramIntegrationTester(diagram_service_url, api_key)
    result = await tester.run_all_tests()

    # Print results table
    print(f"  {'Tool':<12} {'Status':<10} {'Time':<12} {'Size':<12} {'Error'}")
    print("  " + "-" * 66)

    failed_tools = []
    for r in result.results:
        status = "✅ PASS" if r.success else "❌ FAIL"
        time_str = f"{r.response_time_ms:.0f}ms"
        size_str = f"{r.image_size_bytes:,}B" if r.image_size_bytes else "-"
        error_str = (
            r.error[:30] + "..." if r.error and len(r.error) > 30 else (r.error or "")
        )

        print(f"  {r.tool:<12} {status:<10} {time_str:<12} {size_str:<12} {error_str}")

        if not r.success:
            failed_tools.append(r.tool)

    print()
    print(f"  Total test time: {result.total_time_ms:.0f}ms")
    print()

    if failed_tools:
        print("=" * 70)
        print(f"  ❌ FAILED: {', '.join(failed_tools)}")
        print("=" * 70)
        return False

    print("  ✅ All integration tests passed!")
    print("=" * 70)
    print()
    return True


# ============================================================================
# STANDALONE CLI ENTRY POINT
# ============================================================================


def main() -> None:
    """Standalone CLI entry point for running integration tests."""
    import argparse
    import os
    import sys

    from dotenv import load_dotenv

    # Load environment variables from .env file
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Run integration tests for diagram rendering services",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with default settings (localhost:3001)
  python -m src.utils.integration_tester

  # Run with custom service URL
  python -m src.utils.integration_tester --url http://localhost:3001

  # Run with API key from command line
  python -m src.utils.integration_tester --api-key your-api-key

Environment Variables:
  DIAGRAM_SERVICE_URL       - DiagramScreenshot service URL (default: http://localhost:3001)
  DIAGRAM_API_KEY           - API key for authentication
  DIAGRAM_SCREENSHOT_API_KEY - Alternative API key env var (for compatibility with .env)
        """,
    )

    parser.add_argument(
        "--url",
        default=os.getenv("DIAGRAM_SERVICE_URL", "http://localhost:3001"),
        help="DiagramScreenshot service URL (default: from DIAGRAM_SERVICE_URL env or localhost:3001)",
    )

    # Check both environment variable names for API key
    api_key_default = os.getenv("DIAGRAM_API_KEY") or os.getenv("DIAGRAM_SCREENSHOT_API_KEY", "")

    parser.add_argument(
        "--api-key",
        default=api_key_default,
        help="API key for DiagramScreenshot service (default: from DIAGRAM_API_KEY or DIAGRAM_SCREENSHOT_API_KEY env)",
    )

    args = parser.parse_args()

    print()
    print("🧪 Diagram Service Integration Tester")
    print(f"   Service URL: {args.url}")
    print(
        f"   API Key: {'***' + args.api_key[-4:] if len(args.api_key) > 4 else '(not set)'}"
    )

    try:
        success = asyncio.run(
            run_integration_tests(diagram_service_url=args.url, api_key=args.api_key)
        )

        if success:
            print("\n✅ All tests passed! Ready for batch processing.\n")
            sys.exit(0)
        else:
            print(
                "\n❌ Some tests failed. Fix issues before running batch processing.\n"
            )
            sys.exit(1)

    except RuntimeError as e:
        print(f"\n❌ FATAL ERROR: {e}\n")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user\n")
        sys.exit(130)


if __name__ == "__main__":
    main()
