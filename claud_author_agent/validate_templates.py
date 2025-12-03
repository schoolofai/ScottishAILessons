#!/usr/bin/env python3
"""Validate JSXGraph templates against diagramScreenshot service.

This script tests each template JSON file against the diagramScreenshot service
to ensure they render successfully before being used by the diagram author agent.

Usage:
    # Start the diagramScreenshot service first
    docker compose -f ../diagramScreenshot/docker-compose.yml up -d

    # Run validation
    python validate_templates.py

    # Optional: Save rendered PNGs
    python validate_templates.py --save-images
"""

import argparse
import base64
import json
import sys
from pathlib import Path

import requests

TEMPLATES_DIR = Path(__file__).parent / "src/prompts/jsxgraph_examples"
SERVICE_URL = "http://localhost:3001/api/v1/render"
API_KEY = "dev-api-key-change-in-production"  # Default dev API key for diagramScreenshot service
DEFAULT_OPTIONS = {"width": 800, "height": 600}


def validate_template(template_path: Path, save_image: bool = False) -> dict:
    """Send template to diagramScreenshot and check for 200 response.

    Args:
        template_path: Path to the template JSON file
        save_image: If True, save the rendered PNG alongside the JSON

    Returns:
        dict with validation result including path, status, success, and error details
    """
    with open(template_path) as f:
        diagram = json.load(f)

    try:
        response = requests.post(
            SERVICE_URL,
            json={"diagram": diagram, "options": DEFAULT_OPTIONS},
            headers={"Content-Type": "application/json", "X-API-Key": API_KEY},
            timeout=30
        )
    except requests.exceptions.ConnectionError:
        return {
            "path": str(template_path),
            "status": 0,
            "success": False,
            "error": f"Cannot connect to diagramScreenshot service at {SERVICE_URL}"
        }
    except requests.exceptions.Timeout:
        return {
            "path": str(template_path),
            "status": 0,
            "success": False,
            "error": "Request timed out after 30 seconds"
        }

    result = {
        "path": str(template_path),
        "status": response.status_code,
        "success": response.status_code == 200,
        "error": None
    }

    if response.status_code != 200:
        try:
            error_data = response.json()
            result["error"] = error_data.get("error", str(error_data))
        except json.JSONDecodeError:
            result["error"] = response.text[:200]
    elif save_image:
        # Save the rendered PNG
        try:
            response_data = response.json()
            if response_data.get("success") and response_data.get("image"):
                image_data = base64.b64decode(response_data["image"])
                png_path = template_path.with_suffix(".png")
                png_path.write_bytes(image_data)
                result["image_saved"] = str(png_path)
        except Exception as e:
            result["image_save_error"] = str(e)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Validate JSXGraph templates against diagramScreenshot service"
    )
    parser.add_argument(
        "--save-images",
        action="store_true",
        help="Save rendered PNG images alongside template JSON files"
    )
    args = parser.parse_args()

    if not TEMPLATES_DIR.exists():
        print(f"❌ Templates directory not found: {TEMPLATES_DIR}")
        sys.exit(1)

    # Find all template JSON files (excluding metadata.json)
    template_files = [
        f for f in TEMPLATES_DIR.rglob("*.json")
        if f.name != "metadata.json"
    ]

    if not template_files:
        print(f"❌ No template files found in {TEMPLATES_DIR}")
        sys.exit(1)

    print(f"Found {len(template_files)} template(s) to validate\n")

    results = []
    for template_path in sorted(template_files):
        result = validate_template(template_path, save_image=args.save_images)
        results.append(result)

        status_icon = "✅" if result["success"] else "❌"
        relative_path = template_path.relative_to(TEMPLATES_DIR)
        print(f"{status_icon} {relative_path}: HTTP {result['status']}")

        if result["error"]:
            print(f"   Error: {result['error']}")
        if result.get("image_saved"):
            print(f"   Image saved: {result['image_saved']}")

    # Summary
    print("\n" + "=" * 50)
    failed = [r for r in results if not r["success"]]
    passed = [r for r in results if r["success"]]

    print(f"Passed: {len(passed)}/{len(results)}")
    print(f"Failed: {len(failed)}/{len(results)}")

    if failed:
        print("\n❌ Failed templates:")
        for r in failed:
            print(f"   - {r['path']}")
        sys.exit(1)
    else:
        print(f"\n✅ All {len(results)} templates validated successfully!")
        if args.save_images:
            print("   PNG images saved alongside each template.")
        sys.exit(0)


if __name__ == "__main__":
    main()
