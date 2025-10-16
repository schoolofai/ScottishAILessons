#!/usr/bin/env python3
"""Extract SQA course data from Appwrite and format to Course_data.txt."""

import asyncio
import sys
import json
from datetime import datetime
sys.path.insert(0, "src")

from utils.appwrite_mcp import list_appwrite_documents


async def extract_course_data(subject: str, level: str, output_path: str):
    """Extract course data from Appwrite and write to file."""
    print(f"Extracting SQA course data for {subject} at {level}...")

    try:
        # List all documents (we'll filter in Python since query syntax is complex)
        docs = await list_appwrite_documents(
            database_id="sqa_education",
            collection_id="sqa_current",
            mcp_config_path=".mcp.json"
        )

        if not docs:
            raise Exception("No documents found in sqa_current collection")

        print(f"Found {len(docs)} total document(s) in database")

        # Filter for matching subject and level
        matching_docs = [
            doc for doc in docs
            if doc.get('subject') == subject and doc.get('level') == level
        ]

        if not matching_docs:
            raise Exception(
                f"No SQA course data found for {subject} at {level}. "
                f"Check subject/level formatting."
            )

        print(f"Found {len(matching_docs)} matching document(s)")

        # Use the first (most recent) document
        course_doc = matching_docs[0]

        # Parse the data field (it's stored as JSON string)
        course_data = json.loads(course_doc.get('data', '{}'))
        metadata = json.loads(course_doc.get('metadata', '{}'))

        # Validate required fields
        required_fields = ['course_name', 'units']
        missing_fields = [f for f in required_fields if f not in course_data]
        if missing_fields:
            raise Exception(f"Missing required fields: {', '.join(missing_fields)}")

        # Format as readable text
        output_lines = []
        output_lines.append(f"# SQA Course Data: {course_data.get('course_name', 'Unknown')}")
        output_lines.append(f"Subject: {subject}")
        output_lines.append(f"Level: {level}")
        output_lines.append(f"Course Code: {course_doc.get('course_code', 'N/A')}")
        output_lines.append(f"Catalog Version: {course_doc.get('catalog_version', 'N/A')}")
        output_lines.append("")

        # Add metadata if available
        if metadata:
            output_lines.append("## Course Metadata")
            for key, value in metadata.items():
                output_lines.append(f"{key}: {value}")
            output_lines.append("")

        # Process units
        units = course_data.get('units', [])
        output_lines.append(f"## Units ({len(units)} total)")
        output_lines.append("")

        for i, unit in enumerate(units, 1):
            unit_name = unit.get('unit_name', f'Unit {i}')
            output_lines.append(f"### Unit {i}: {unit_name}")

            if 'unit_code' in unit:
                output_lines.append(f"Code: {unit['unit_code']}")

            if 'unit_description' in unit:
                output_lines.append(f"Description: {unit['unit_description']}")

            output_lines.append("")

            # Outcomes
            outcomes = unit.get('outcomes', [])
            if outcomes:
                output_lines.append("#### Outcomes")
                for outcome in outcomes:
                    outcome_num = outcome.get('outcome_number', '?')
                    outcome_desc = outcome.get('outcome_description', 'No description')
                    output_lines.append(f"- O{outcome_num}: {outcome_desc}")
                output_lines.append("")

            # Assessment Standards
            assessment_standards = unit.get('assessment_standards', [])
            if assessment_standards:
                output_lines.append("#### Assessment Standards")
                for std in assessment_standards:
                    std_num = std.get('standard_number', '?')
                    std_desc = std.get('standard_description', 'No description')
                    output_lines.append(f"- AS{std_num}: {std_desc}")
                output_lines.append("")

            # Skills
            skills = unit.get('skills', [])
            if skills:
                output_lines.append("#### Skills")
                for skill in skills:
                    if isinstance(skill, dict):
                        skill_name = skill.get('skill_name', 'Unknown')
                        skill_desc = skill.get('skill_description', '')
                        if skill_desc:
                            output_lines.append(f"- {skill_name}: {skill_desc}")
                        else:
                            output_lines.append(f"- {skill_name}")
                    else:
                        output_lines.append(f"- {skill}")
                output_lines.append("")

            output_lines.append("---")
            output_lines.append("")

        # Additional course information
        if 'marking_guidance' in course_data:
            output_lines.append("## Marking Guidance")
            output_lines.append(course_data['marking_guidance'])
            output_lines.append("")

        if 'calculator_policy' in course_data:
            output_lines.append("## Calculator Policy")
            output_lines.append(course_data['calculator_policy'])
            output_lines.append("")

        if 'assessment_structure' in course_data:
            output_lines.append("## Assessment Structure")
            assessment = course_data['assessment_structure']
            if isinstance(assessment, dict):
                for key, value in assessment.items():
                    output_lines.append(f"- {key}: {value}")
            else:
                output_lines.append(str(assessment))
            output_lines.append("")

        # Footer
        output_lines.append("---")
        output_lines.append(f"Extracted from Appwrite: {datetime.now().isoformat()}")
        output_lines.append(f"Document ID: {course_doc.get('$id')}")
        output_lines.append(f"Last Modified: {course_doc.get('last_modified', 'N/A')}")

        # Write to file
        output_content = "\n".join(output_lines)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(output_content)

        print(f"\nSuccessfully wrote course data to: {output_path}")
        print(f"Total units extracted: {len(units)}")

        # Return summary info
        return {
            'documents_extracted': len(matching_docs),
            'units_count': len(units),
            'course_name': course_data.get('course_name'),
            'output_path': output_path,
            'file_size_bytes': len(output_content)
        }

    except Exception as e:
        print(f"Error extracting course data: {e}")
        import traceback
        traceback.print_exc()
        raise


async def main():
    """Main entry point."""
    if len(sys.argv) != 4:
        print("Usage: extract_course_data.py <subject> <level> <output_path>")
        sys.exit(1)

    subject = sys.argv[1]
    level = sys.argv[2]
    output_path = sys.argv[3]

    result = await extract_course_data(subject, level, output_path)

    print("\n=== Extraction Summary ===")
    print(f"Course Name: {result['course_name']}")
    print(f"Documents Extracted: {result['documents_extracted']}")
    print(f"Units Count: {result['units_count']}")
    print(f"Output File: {result['output_path']}")
    print(f"File Size: {result['file_size_bytes']} bytes")


if __name__ == "__main__":
    asyncio.run(main())
