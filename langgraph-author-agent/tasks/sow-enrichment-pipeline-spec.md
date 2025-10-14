# SoW Enrichment Pipeline Specification (INDEX)

## Status
**Superseded** | Created: 2025-10-12 | Split: 2025-10-13

## Overview

This document has been **split into two focused specifications**:

1. **[sow-prompt-enrichment-spec.md](./sow-prompt-enrichment-spec.md)** - AI Prompt Modifications
   - What fields to remove from AI prompts (metadata, lessonTemplateRef)
   - What fields to keep (pedagogical decisions)
   - Assessment standard enrichment schema
   - Lesson author prompt updates
   - Token savings analysis

2. **[sow-seeding-enrichment-spec.md](./sow-seeding-enrichment-spec.md)** - Seeding Script Implementation
   - Enrichment pipeline implementation in seedAuthoredSOW.ts
   - TypeScript interfaces and helper functions
   - Error handling and validation
   - Testing strategy
   - Implementation checklist

## Quick Navigation

### For AI Prompt Changes
→ See **[sow-prompt-enrichment-spec.md](./sow-prompt-enrichment-spec.md)**

**What you'll find**:
- Field classification (remove vs keep)
- Specific prompt sections to update
- Assessment standard enrichment format
- Lesson author prompt changes
- Expected token savings (~300-500 tokens per SoW, ~200-300 tokens per lesson)

**Key Changes**:
- Remove: `$id`, `version`, `status`, `createdAt`, `updatedAt`, `lessonTemplateRef`, `coherence.unit`
- Keep: All pedagogical fields (`order`, `label`, `lesson_type`, `policy`, `engagement_tags`, etc.)
- Transform: `assessmentStandardRefs` (codes) → enriched `assessmentStandards` (with descriptions)

### For Seeding Script Implementation
→ See **[sow-seeding-enrichment-spec.md](./sow-seeding-enrichment-spec.md)**

**What you'll find**:
- Complete TypeScript implementation
- `enrichSOWData()` main function
- Helper functions (`fetchCourseData`, `enrichAssessmentStandards`, `lookupUnitForOutcome`)
- Type definitions for enriched schema
- Comprehensive error handling
- Unit and integration test specifications

**Key Implementation**:
- New PHASE 0.5 in seedAuthoredSOW.ts workflow
- Fail-fast validation on missing assessment standard codes
- Backward compatibility (preserves `assessmentStandardRefs` alongside enriched format)

## Migration Guide

If you were using this document before the split (2025-10-12):

| Old Content | New Location |
|-------------|--------------|
| Lines 1-30 (Problem/Goals) | Both specs (context section) |
| Lines 64-104 (Field Classification) | `sow-prompt-enrichment-spec.md` |
| Lines 105-156 (Assessment Standard Enrichment) | Both specs (different perspectives) |
| Lines 157-401 (Implementation Code) | `sow-seeding-enrichment-spec.md` |
| Lines 456-489 (Error Handling) | `sow-seeding-enrichment-spec.md` |
| Lines 491-525 (Testing) | `sow-seeding-enrichment-spec.md` |
| Lines 544-580 (Implementation Checklist) | `sow-seeding-enrichment-spec.md` |
| Lines 582-603 (Dependencies) | Both specs |

## Rationale for Split

The original spec mixed two distinct concerns:

1. **AI Interface Changes**: What the LLM should/shouldn't generate (prompt engineering)
2. **Pipeline Implementation**: How to transform minimal AI output into production data (software engineering)

By splitting them:
- **Clarity**: Each spec has a single, focused purpose
- **Ownership**: Different teams can own different specs (AI engineers vs backend engineers)
- **Parallel Work**: Prompt updates and pipeline implementation can proceed independently
- **Maintenance**: Easier to update one concern without affecting the other

## Next Steps

1. **Review Both Specs**: Read both documents to understand the full enrichment strategy
2. **Coordinate Implementation**: Pipeline must be deployed before prompt changes go live
3. **Test Integration**: Verify minimal AI output + enrichment = complete SoW
4. **Roll Out Sequentially**:
   - Week 1: Implement and test enrichment pipeline
   - Week 2: Deploy pipeline to development
   - Week 3: Update prompts and measure improvements
   - Week 4: Roll out to production

---

**Note**: This index file is kept for navigation and historical reference. Use the split specifications for all implementation work.

**Document Owner**: AI Analysis | **Last Updated**: 2025-10-13
