"""Diagram Service Manager for Health Checks.

Manages health checks and availability for the diagram-screenshot service.
The diagram service is required for Step 4 (diagram generation).

Usage:
    service = DiagramServiceManager()
    if await service.wait_for_health(timeout_seconds=60):
        print("Service is ready")
    else:
        print("Service not available")
"""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Optional: Use aiohttp for async HTTP if available
try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    import urllib.request
    import urllib.error


class DiagramServiceManager:
    """Manages diagram-screenshot service health checks.

    The diagram-screenshot service runs on port 3001 by default
    and provides JSXGraph, Plotly, Desmos, and other diagram rendering.

    Health endpoint: GET /health
    """

    DEFAULT_URL = "http://localhost:3001"
    HEALTH_ENDPOINT = "/health"

    def __init__(self, base_url: Optional[str] = None):
        """Initialize diagram service manager.

        Args:
            base_url: Base URL for the service (default: http://localhost:3001)
        """
        self.base_url = base_url or self.DEFAULT_URL
        self.health_url = f"{self.base_url}{self.HEALTH_ENDPOINT}"

    async def is_healthy(self) -> bool:
        """Check if diagram service is responding.

        Returns:
            True if service responds with 200, False otherwise
        """
        if AIOHTTP_AVAILABLE:
            return await self._check_health_aiohttp()
        else:
            return await self._check_health_urllib()

    async def _check_health_aiohttp(self) -> bool:
        """Check health using aiohttp (async)."""
        try:
            timeout = aiohttp.ClientTimeout(total=5)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(self.health_url) as response:
                    return response.status == 200
        except Exception as e:
            logger.debug(f"Health check failed: {e}")
            return False

    async def _check_health_urllib(self) -> bool:
        """Check health using urllib (sync, run in thread)."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._sync_health_check)

    def _sync_health_check(self) -> bool:
        """Synchronous health check using urllib."""
        try:
            request = urllib.request.Request(
                self.health_url,
                method="GET"
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status == 200
        except Exception as e:
            logger.debug(f"Health check failed: {e}")
            return False

    async def wait_for_health(
        self,
        timeout_seconds: int = 60,
        poll_interval: float = 2.0
    ) -> bool:
        """Wait for diagram service to become healthy.

        Args:
            timeout_seconds: Maximum time to wait
            poll_interval: Seconds between health check attempts

        Returns:
            True if service became healthy, False if timeout
        """
        logger.info(
            f"Waiting for diagram service at {self.base_url} "
            f"(timeout: {timeout_seconds}s)"
        )

        start_time = asyncio.get_event_loop().time()
        attempt = 0

        while True:
            attempt += 1
            elapsed = asyncio.get_event_loop().time() - start_time

            if elapsed >= timeout_seconds:
                logger.error(
                    f"Diagram service not available after {timeout_seconds}s. "
                    f"Start it with: cd diagramScreenshot && docker-compose up -d"
                )
                return False

            if await self.is_healthy():
                logger.info(
                    f"Diagram service is healthy (attempt {attempt}, "
                    f"elapsed: {elapsed:.1f}s)"
                )
                return True

            logger.debug(
                f"Diagram service not ready, retrying... "
                f"(attempt {attempt}, elapsed: {elapsed:.1f}s)"
            )
            await asyncio.sleep(poll_interval)

    async def get_service_info(self) -> Optional[dict]:
        """Get service info from health endpoint.

        Returns:
            Service info dict or None if unavailable
        """
        if not AIOHTTP_AVAILABLE:
            return None

        try:
            timeout = aiohttp.ClientTimeout(total=5)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(self.health_url) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception as e:
            logger.debug(f"Failed to get service info: {e}")

        return None

    def get_start_instructions(self) -> str:
        """Get instructions for starting the diagram service."""
        return """
To start the diagram-screenshot service:

1. Using Docker Compose (recommended):
   cd diagramScreenshot
   docker-compose up -d

2. For local development:
   cd diagramScreenshot
   npm install
   npm run dev

The service will be available at http://localhost:3001

Health check: curl http://localhost:3001/health
"""


class DiagramServiceError(Exception):
    """Exception raised when diagram service is unavailable."""

    def __init__(
        self,
        message: str = "Diagram service unavailable",
        start_instructions: bool = True
    ):
        if start_instructions:
            manager = DiagramServiceManager()
            message = f"{message}\n{manager.get_start_instructions()}"
        super().__init__(message)
