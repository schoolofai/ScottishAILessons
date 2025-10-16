# Course Data Schema

## Structure for `Course_data.txt`

This is a **text file** (not JSON) extracted from Appwrite `sqa_education.current_sqa` collection.

## Format

```
# SQA Course Data: {course_name}
Subject: {subject}
Level: {level}
Course Code: {course_code}

## Units

### Unit 1: {unit_name}
Code: {unit_code}
Description: {unit_description}

#### Outcomes
- O1: {outcome_description}
- O2: {outcome_description}

#### Assessment Standards
- AS1.1: {full_standard_description}
- AS1.2: {full_standard_description}

### Unit 2: {unit_name}
...

## Marking Guidance
{marking_guidance}

## Calculator Policy
{calculator_policy}

## Recommended Sequence
{recommended_sequence}

---
Extracted from Appwrite: {timestamp}
```

## Usage by SOW Author

1. **Extract Assessment Standards**: Use full descriptions for enriched format
2. **Follow Recommended Sequence**: Order lessons according to official guidance
3. **Apply Calculator Policy**: Align lessons with SQA requirements
4. **Use Official Terminology**: Extract exact codes, unit names, outcome descriptions

## Critical Requirements

- **Full Descriptions**: Extract COMPLETE assessment standard descriptions (not truncated)
- **Exact Codes**: Use official AS codes (AS1.1, AS1.2, etc.)
- **Outcome References**: Link each standard to its outcome (O1, O2, etc.)
