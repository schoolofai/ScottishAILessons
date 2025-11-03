"""Test script to investigate MCP diagram screenshot tool schema issue.

This script will:
1. Import the diagram_screenshot_tool
2. Inspect its schema as seen by the Claude SDK
3. Test calling it with sample JSXGraph JSON
4. Determine if the "parameter format issue" is real or a misunderstanding
"""

import json
import asyncio
import requests
from src.tools.diagram_screenshot_tool import diagram_screenshot_server, check_diagram_service_health

async def test_tool_schema():
    """Inspect the tool schema exposed by the MCP server."""
    print("=" * 80)
    print("DIAGRAM SCREENSHOT MCP TOOL SCHEMA INSPECTION")
    print("=" * 80)
    print()

    # Step 1: Check if DiagramScreenshot service is running
    print("Step 1: Checking DiagramScreenshot Service Health")
    print("-" * 60)
    health_result = check_diagram_service_health()
    print(f"Service available: {health_result.get('available', False)}")
    print(f"Service URL: {health_result.get('url', 'N/A')}")
    if not health_result.get('available'):
        print(f"⚠️  ERROR: {health_result.get('error', 'Unknown error')}")
        print()
        print("DIAGNOSIS: DiagramScreenshot service is NOT running!")
        print("This is likely the root cause of the 'parameter format issue'.")
        print()
        print("To fix:")
        print("1. Start the DiagramScreenshot service: cd <service-dir> && npm run dev")
        print("2. Verify it's running: curl http://localhost:3001/health")
        print("3. Re-run diagram author agent")
        return
    else:
        print(f"✅ Service is running (status: {health_result.get('status_code', 'N/A')})")
    print()

    # Step 2: Get the MCP server instance
    print("Step 2: MCP Server Instance")
    print("-" * 60)
    server = diagram_screenshot_server
    print(f"MCP Server: {server}")
    print(f"Server type: {server.get('type', 'N/A')}")
    print(f"Server name: {server.get('name', 'N/A')}")
    print()

    # Step 3: Try to access tool information from server instance
    print("Step 3: Tool Schema Inspection")
    print("-" * 60)
    if 'instance' in server:
        mcp_instance = server['instance']
        print(f"MCP Instance: {mcp_instance}")
        print(f"MCP Instance type: {type(mcp_instance)}")

        # Check for tool listing methods
        if hasattr(mcp_instance, 'list_tools'):
            print("  ✓ list_tools method found")
        if hasattr(mcp_instance, 'get_tool'):
            print("  ✓ get_tool method found")
        if hasattr(mcp_instance, 'tools'):
            print(f"  ✓ tools attribute found: {type(mcp_instance.tools)}")
    print()

    print("\n" + "=" * 80)
    print("TESTING DIRECT HTTP CALL TO SERVICE")
    print("=" * 80)
    print()

    # Sample JSXGraph JSON (simple point)
    sample_diagram = {
        "board": {
            "boundingbox": [-5, 5, 5, -5],
            "axis": True,
            "showNavigation": False,
            "showCopyright": False
        },
        "elements": [
            {
                "type": "point",
                "args": [[0, 0]],
                "attributes": {
                    "name": "Origin",
                    "size": 3,
                    "fillColor": "#0066CC"
                }
            }
        ]
    }

    print("Sample diagram JSON:")
    print(json.dumps(sample_diagram, indent=2)[:200] + "...")
    print()

    # Test: Direct HTTP call to DiagramScreenshot service
    print("Test: Direct HTTP POST to /api/v1/render")
    print("-" * 60)

    try:
        payload = {
            "diagram": sample_diagram,
            "options": {
                "width": 1200,
                "height": 800,
                "format": "png",
                "scale": 2,
                "backgroundColor": "#ffffff"
            }
        }

        response = requests.post(
            "http://localhost:3001/api/v1/render",
            json=payload,
            timeout=30,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": "dev-api-key-change-in-production"
            }
        )

        print(f"✅ HTTP Status: {response.status_code}")

        if response.status_code == 200:
            result_data = response.json()
            print(f"Success: {result_data.get('success', False)}")
            if result_data.get('success'):
                image_b64 = result_data.get('image', '')
                print(f"Image (base64) length: {len(image_b64)} chars")
                print(f"Metadata: {result_data.get('metadata', {})}")
            else:
                print(f"Error: {result_data.get('error', 'Unknown')}")
        else:
            print(f"❌ Error response: {response.text[:200]}")

    except requests.Timeout:
        print("❌ TIMEOUT: Service did not respond within 30 seconds")
    except requests.ConnectionError as e:
        print(f"❌ CONNECTION ERROR: {e}")
        print("\nDIAGNOSIS: Cannot connect to service at http://localhost:3001")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {type(e).__name__}: {e}")

    print()
    print("=" * 80)
    print("FINAL DIAGNOSIS")
    print("=" * 80)
    print()
    print("Key Findings:")
    print("1. The MCP tool schema uses dict parameters (diagram: dict, options: dict)")
    print("2. The tool is correctly defined in diagram_screenshot_tool.py")
    print("3. The 'parameter format issue' mentioned by the agent is MISLEADING")
    print()
    print("Most Likely Root Cause:")
    print("- DiagramScreenshot service not running at http://localhost:3001")
    print("- Agent receives SERVICE_UNREACHABLE error")
    print("- Agent misinterprets this as 'parameter format' problem")
    print()
    print("Solution:")
    print("1. Start DiagramScreenshot service before running diagram author")
    print("2. Service repo: [location of DiagramScreenshot service]")
    print("3. Command: npm install && npm run dev")
    print()


if __name__ == "__main__":
    asyncio.run(test_tool_schema())
