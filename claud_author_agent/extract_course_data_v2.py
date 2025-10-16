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

        # Format as readable text
        output_lines = []

        # Header
        qualification_title = course_data.get('qualification', {}).get('title', 'Unknown Course')
        output_lines.append(f"# SQA Course Data: {qualification_title}")
        output_lines.append(f"Subject: {subject}")
        output_lines.append(f"Level: {level}")

        course_code = course_data.get('qualification', {}).get('course_code', 'N/A')
        output_lines.append(f"Course Code: {course_code}")
        output_lines.append(f"Catalog Version: {course_doc.get('catalog_version', 'N/A')}")
        output_lines.append("")

        # SCQF Information
        scqf = course_data.get('qualification', {}).get('scqf', {})
        if scqf:
            output_lines.append("## SCQF Information")
            output_lines.append(f"Level: {scqf.get('level', 'N/A')}")
            output_lines.append(f"Credits: {scqf.get('credits', 'N/A')}")
            if 'core_skill_auto_cert' in scqf:
                output_lines.append(f"Core Skill Auto-Certification: {scqf['core_skill_auto_cert']}")
            output_lines.append("")

        # Course Structure - Units
        units = course_data.get('course_structure', {}).get('units', [])
        output_lines.append(f"## Course Structure - Units ({len(units)} total)")
        output_lines.append("")

        for i, unit in enumerate(units, 1):
            unit_title = unit.get('title', f'Unit {i}')
            unit_code = unit.get('code', 'N/A')
            scqf_credits = unit.get('scqf_credits', 'N/A')

            output_lines.append(f"### Unit {i}: {unit_title}")
            output_lines.append(f"Unit Code: {unit_code}")
            output_lines.append(f"SCQF Credits: {scqf_credits}")
            output_lines.append("")

            # Outcomes
            outcomes = unit.get('outcomes', [])
            if outcomes:
                output_lines.append("#### Outcomes")
                for outcome in outcomes:
                    outcome_id = outcome.get('id', '?')
                    outcome_title = outcome.get('title', 'No title')
                    output_lines.append(f"\n**{outcome_id}: {outcome_title}**")
                    output_lines.append("")

                    # Assessment Standards
                    assessment_standards = outcome.get('assessment_standards', [])
                    if assessment_standards:
                        output_lines.append("Assessment Standards:")
                        for std in assessment_standards:
                            std_code = std.get('code', '?')
                            std_desc = std.get('desc', 'No description')
                            output_lines.append(f"- **{std_code}**: {std_desc}")

                            # Skills list
                            skills_list = std.get('skills_list', [])
                            if skills_list:
                                output_lines.append("  Skills:")
                                for skill in skills_list:
                                    output_lines.append(f"  - {skill}")

                            # Marking guidance
                            marking_guide = std.get('marking_guidance', '')
                            if marking_guide:
                                output_lines.append(f"  Marking Guidance: {marking_guide}")

                            output_lines.append("")

                output_lines.append("")

            output_lines.append("---")
            output_lines.append("")

        # Assessment Model
        assessment_model = course_data.get('assessment_model', {})
        if assessment_model:
            output_lines.append("## Assessment Model")
            output_lines.append("")

            if 'grading' in assessment_model:
                output_lines.append(f"Grading: {assessment_model['grading']}")
                output_lines.append("")

            if 'unit_assessment_requirement' in assessment_model:
                output_lines.append(f"Unit Assessment Requirement: {assessment_model['unit_assessment_requirement']}")
                output_lines.append("")

            if 'added_value_unit_required' in assessment_model:
                output_lines.append(f"Added Value Unit Required: {assessment_model['added_value_unit_required']}")
                output_lines.append("")

            if 'external_course_assessment' in assessment_model:
                output_lines.append(f"External Course Assessment: {assessment_model['external_course_assessment']}")
                output_lines.append("")

            if 'course_award_conditions' in assessment_model:
                conditions = assessment_model['course_award_conditions']
                if isinstance(conditions, list):
                    output_lines.append("Course Award Conditions:")
                    for condition in conditions:
                        output_lines.append(f"- {condition}")
                else:
                    output_lines.append(f"Course Award Conditions: {conditions}")
                output_lines.append("")

        # Marking Guidance
        marking_guidance = course_data.get('marking_guidance', {})
        if marking_guidance:
            output_lines.append("## Marking Guidance")
            output_lines.append("")

            general_principles = marking_guidance.get('general_principles', [])
            if general_principles:
                output_lines.append("### General Principles")
                for principle in general_principles:
                    output_lines.append(f"- {principle}")
                output_lines.append("")

            specific_guidelines = marking_guidance.get('specific_guidelines', {})
            if specific_guidelines:
                output_lines.append("### Specific Guidelines")
                for key, value in specific_guidelines.items():
                    output_lines.append(f"**{key}**: {value}")
                    output_lines.append("")

        # CFE Alignment
        cfe_alignment = course_data.get('cfe_alignment', {})
        if cfe_alignment:
            output_lines.append("## Curriculum for Excellence Alignment")
            output_lines.append("")

            if 'es_os_alignment' in cfe_alignment:
                output_lines.append(f"ES/OS Alignment: {cfe_alignment['es_os_alignment']}")
                output_lines.append("")

            if 'numeracy_contribution' in cfe_alignment:
                output_lines.append(f"Numeracy Contribution: {cfe_alignment['numeracy_contribution']}")
                output_lines.append("")

            if 'literacy_contribution' in cfe_alignment:
                output_lines.append(f"Literacy Contribution: {cfe_alignment['literacy_contribution']}")
                output_lines.append("")

        # Documents/Resources
        documents = course_data.get('documents', {})
        if documents:
            output_lines.append("## Official Documents and Resources")
            output_lines.append("")
            for doc_name, doc_info in documents.items():
                if isinstance(doc_info, dict):
                    output_lines.append(f"### {doc_name}")
                    for key, value in doc_info.items():
                        output_lines.append(f"- {key}: {value}")
                else:
                    output_lines.append(f"### {doc_name}")
                    output_lines.append(f"{doc_info}")
                output_lines.append("")

        # Provenance
        provenance = course_data.get('provenance', {})
        if provenance:
            output_lines.append("## Data Provenance")
            output_lines.append("")
            for key, value in provenance.items():
                output_lines.append(f"- {key}: {value}")
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
        print(f"File size: {len(output_content)} bytes")

        # Return summary info
        return {
            'documents_extracted': len(matching_docs),
            'units_count': len(units),
            'course_name': qualification_title,
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
        print("Usage: extract_course_data_v2.py <subject> <level> <output_path>")
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
