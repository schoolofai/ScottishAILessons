# Appwrite Schema Update: diagram_description Field

## Overview

This document describes the required Appwrite database schema change to support the new `diagram_description` feature in the Diagram Author agent.

## Collection: lesson_diagrams

**Database**: `default`
**Collection ID**: `lesson_diagrams`

## New Attribute Required

### diagram_description

Add a new string attribute to store brief descriptions of diagrams for downstream LLMs.

**Configuration**:
- **Attribute Name**: `diagram_description`
- **Type**: String
- **Size**: 1000 characters
- **Required**: No (optional for backward compatibility)
- **Default**: `""` (empty string)
- **Array**: No
- **Encrypted**: No

## Implementation Steps

### Via Appwrite Console (Recommended)

1. Navigate to Appwrite Console: `https://cloud.appwrite.io/console`
2. Select your project
3. Go to **Databases** → `default` → `lesson_diagrams`
4. Click **Attributes** tab
5. Click **+ Create Attribute**
6. Select **String**
7. Enter the following configuration:
   - **Key**: `diagram_description`
   - **Size**: `1000`
   - **Required**: Uncheck (leave unchecked)
   - **Default**: Leave empty (will default to empty string)
   - **Array**: Uncheck
8. Click **Create**

### Via Appwrite CLI (Alternative)

```bash
appwrite databases createStringAttribute \
    --databaseId default \
    --collectionId lesson_diagrams \
    --key diagram_description \
    --size 1000 \
    --required false \
    --default ""
```

### Via REST API (Alternative)

```bash
curl -X POST \
  'https://cloud.appwrite.io/v1/databases/default/collections/lesson_diagrams/attributes/string' \
  -H 'Content-Type: application/json' \
  -H 'X-Appwrite-Project: YOUR_PROJECT_ID' \
  -H 'X-Appwrite-Key: YOUR_API_KEY' \
  -d '{
    "key": "diagram_description",
    "size": 1000,
    "required": false,
    "default": ""
  }'
```

## Migration Considerations

### Backward Compatibility

- **Existing Diagrams**: The field is optional, so existing diagrams will have `diagram_description = ""` (empty string)
- **No Data Migration Needed**: Empty descriptions are acceptable for existing diagrams
- **Gradual Rollout**: New diagrams generated after deployment will have populated descriptions

### Rollout Strategy

1. **Schema First**: Add the Appwrite attribute before deploying code changes
2. **Deploy Code**: Deploy the updated Diagram Author agent code
3. **Test**: Run test execution and verify descriptions are populated
4. **Monitor**: Check first production run to ensure descriptions are meaningful
5. **Optional**: Consider making the field required after initial rollout succeeds and old diagrams are regenerated

## Usage

Once the schema is updated, the Diagram Author agent will automatically populate this field with:

- **1-2 sentence descriptions** of what each diagram shows
- **Key mathematical elements** (shapes, functions, data points)
- **Labeled features** (points, axes, measurements)

### Example Values

```json
{
  "diagram_description": "Right triangle ABC with sides a=3cm and b=4cm, showing Pythagorean relationship and right angle marker"
}
```

```json
{
  "diagram_description": "Parabola showing y = x² with vertex at origin, axis of symmetry at x=0, and roots marked at (-2,0) and (2,0)"
}
```

```json
{
  "diagram_description": "Bar chart comparing rainfall in mm across Edinburgh, Glasgow, and Stirling using Scottish blue bars with labeled y-axis"
}
```

## Verification

After adding the attribute, verify it was created successfully:

1. Go to **Databases** → `default` → `lesson_diagrams` → **Attributes**
2. Confirm `diagram_description` appears in the attributes list
3. Check configuration:
   - Type: String
   - Size: 1000
   - Required: No
   - Default: ""

## Downstream Benefits

This field enables:

- **Text-based LLMs** to describe diagrams to students without vision capabilities
- **Accessibility features** for screen readers and text-to-speech
- **Search indexing** of diagram content
- **Context-aware recommendations** based on diagram descriptions
- **Lesson planning** by understanding diagram content without image processing

## Rollback Plan

If needed, the attribute can be safely deleted without affecting existing functionality:

1. The code treats missing `diagram_description` as empty string via `diagram.get("diagram_description", "")`
2. No critical functionality depends on this field
3. Deleting the attribute will not break diagram rendering or storage

## Related Files

- **Prompts**:
  - `src/prompts/diagram_generation_subagent.md` (generates description)
  - `src/prompts/diagram_author_prompt.md` (output schema)

- **Code**:
  - `src/diagram_author_claude_client.py` (extracts from output)
  - `src/utils/diagram_upserter.py` (persists to Appwrite)

## Status

- [ ] Schema updated in Appwrite
- [ ] Code deployed
- [ ] Test execution verified
- [ ] Production rollout complete

## Questions or Issues

If you encounter issues adding this attribute:

1. Check Appwrite project permissions
2. Verify database and collection IDs are correct
3. Ensure attribute key name is exactly `diagram_description` (no typos)
4. Check size is 1000 (sufficient for 1-2 sentence descriptions)

---

**Last Updated**: 2025-11-03
**Author**: Diagram Author Agent Enhancement
**Feature**: diagram_description field for downstream LLM usage
