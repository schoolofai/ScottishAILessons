# Storage Bucket Approach for Large Authored_SOW Entries

## Overview

When the compressed `entries` field exceeds Appwrite's 100,000 character limit, we store the entries data in **Appwrite Storage** and save the file ID in the database field instead.

**Key Benefits:**
- **No data loss** - All lesson content preserved (no trimming)
- **Backward compatible** - Existing SOWs with inline entries continue to work
- **Transparent** - Readers auto-detect format and fetch from storage if needed

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STORAGE BUCKET APPROACH                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                         WRITE PATH (Phase 4 Upserter)
                         ────────────────────────────
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Compress entries (gzip+b64) │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Size > 100,000 chars?       │
                    └───────────────────────────────┘
                           │               │
                          YES              NO
                           │               │
                           ▼               ▼
              ┌─────────────────────┐   ┌─────────────────────┐
              │ Upload to Storage   │   │ Store inline        │
              │ Bucket              │   │ (compressed string) │
              └─────────────────────┘   └─────────────────────┘
                           │                       │
                           ▼                       │
              ┌─────────────────────┐              │
              │ Store file_id in    │              │
              │ entries field       │              │
              │ "storage:<file_id>" │              │
              └─────────────────────┘              │
                           │                       │
                           └───────────┬───────────┘
                                       ▼
                           ┌───────────────────────┐
                           │   Appwrite Document   │
                           │   Authored_SOW        │
                           └───────────────────────┘


                         READ PATH (Drivers)
                         ───────────────────
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Read entries field          │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Starts with "storage:"?    │
                    └───────────────────────────────┘
                           │               │
                          YES              NO
                           │               │
                           ▼               ▼
              ┌─────────────────────┐   ┌─────────────────────┐
              │ Extract file_id     │   │ Decompress inline   │
              │ Fetch from Storage  │   │ (existing logic)    │
              │ Decompress          │   │                     │
              └─────────────────────┘   └─────────────────────┘
                           │                       │
                           └───────────┬───────────┘
                                       ▼
                           ┌───────────────────────┐
                           │   Parsed entries[]    │
                           └───────────────────────┘
```

## Format Detection

The `entries` field uses a prefix to indicate format:

| Prefix | Format | Description |
|--------|--------|-------------|
| `storage:` | Storage Bucket | File ID follows prefix, fetch from storage |
| `gzip:` | TypeScript compressed | Inline gzip+base64 (TypeScript format) |
| *(base64 chars)* | Python compressed | Inline gzip+base64 (Python format, no prefix) |
| `[` or `{` | Raw JSON | Uncompressed JSON (legacy, backward compat) |

**Example entries field values:**
```
# Storage bucket reference
"storage:68f123abc456def789012345"

# TypeScript compressed (inline)
"gzip:H4sIAAAAAAAAA6tWKkktLlGyUlAqS8wpTgUAd..."

# Python compressed (inline, no prefix)
"H4sIAAAAAAAAA6tWKkktLlGyUlAqS8wpTgUAd..."

# Uncompressed JSON (legacy)
"[{\"order\":1,\"label\":\"Lesson 1\",...}]"
```

## Affected Files

### Phase 4: Write Path (claud_author_agent)

| File | Changes Required |
|------|------------------|
| `src/utils/sow_upserter.py` | Upload to storage when > 100k, store `storage:<file_id>` |
| `src/utils/appwrite_mcp.py` | Add `upload_file_to_storage()` helper function |

### Frontend: Read Path (Drivers)

| File | Changes Required |
|------|------------------|
| `lib/appwrite/utils/compression.ts` | Add `fetchEntriesFromStorage()` and update `decompressJSON()` |
| `lib/appwrite/driver/AuthoredSOWDriver.ts` | Use updated decompression (handles storage refs) |
| `lib/appwrite/driver/SOWDriver.ts` | Use updated decompression (handles storage refs) |
| `__tests__/support/ServerAuthoredSOWDriver.ts` | Update `parseEntries()` to handle storage refs |

### Backend: Read Path (claud_author_agent)

| File | Changes Required |
|------|------------------|
| `src/utils/sow_extractor.py` | Add storage bucket fetch logic before decompression |
| `src/utils/compression.py` | Add `fetch_entries_from_storage()` helper |
| `src/utils/appwrite_mcp.py` | Add `download_file_from_storage()` helper function |

## Implementation Plan

### Phase 1: Backend Write Path (sow_upserter.py)

**Goal:** Upload entries to storage when compressed size > 100k

```python
# Pseudocode for sow_upserter.py

APPWRITE_FIELD_LIMIT = 100000
STORAGE_BUCKET_ID = "authored_sow_entries"
STORAGE_PREFIX = "storage:"

async def upsert_sow_to_appwrite(...):
    # ... existing validation code ...

    # Compress entries
    entries_compressed = compress_json_gzip_base64(sow_data["entries"])

    # Check if we need storage bucket
    if len(entries_compressed) > APPWRITE_FIELD_LIMIT:
        logger.info(f"📦 Entries exceed limit, uploading to storage bucket")

        # Upload compressed data to storage
        file_id = await upload_entries_to_storage(
            entries_compressed=entries_compressed,
            course_id=course_id,
            version=version,
            mcp_config_path=mcp_config_path
        )

        # Store reference instead of data
        entries_field_value = f"{STORAGE_PREFIX}{file_id}"
        logger.info(f"   Stored as: {entries_field_value}")
    else:
        # Store inline (existing behavior)
        entries_field_value = entries_compressed

    # Build document with entries (either inline or reference)
    document_data = {
        "courseId": course_id,
        "version": version,
        "status": "draft",
        "entries": entries_field_value,  # May be "storage:<id>" or compressed string
        "metadata": metadata_str,
        "accessibility_notes": accessibility_notes
    }

    # ... rest of upsert logic ...
```

### Phase 2: Backend Read Path (sow_extractor.py)

**Goal:** Fetch entries from storage when field contains storage reference

```python
# Pseudocode for sow_extractor.py

STORAGE_PREFIX = "storage:"

async def extract_sow_entry_to_workspace(...):
    # ... existing query code ...

    entries_raw = sow_doc.get('entries', [])

    if isinstance(entries_raw, str):
        # Check for storage bucket reference
        if entries_raw.startswith(STORAGE_PREFIX):
            file_id = entries_raw[len(STORAGE_PREFIX):]
            logger.info(f"📦 Fetching entries from storage: {file_id}")

            entries_compressed = await download_file_from_storage(
                file_id=file_id,
                mcp_config_path=mcp_config_path
            )
            entries = decompress_json_gzip_base64(entries_compressed)
        else:
            # Existing inline decompression
            entries = decompress_json_gzip_base64(entries_raw)
    else:
        entries = entries_raw

    # ... rest of extraction logic ...
```

### Phase 3: Frontend Read Path (compression.ts)

**Goal:** Update decompression to handle storage references

```typescript
// Pseudocode for compression.ts

const STORAGE_PREFIX = 'storage:';

/**
 * Decompress JSON data, handling storage bucket references
 */
export async function decompressJSONWithStorage<T = any>(
  data: string | any | null | undefined,
  storageClient?: AppwriteStorage  // For fetching from storage
): Promise<T | null> {

  if (typeof data !== 'string') {
    return decompressJSON(data);  // Existing logic for non-strings
  }

  // Check for storage bucket reference
  if (data.startsWith(STORAGE_PREFIX)) {
    const fileId = data.substring(STORAGE_PREFIX.length);
    console.log(`[compression] Fetching entries from storage: ${fileId}`);

    if (!storageClient) {
      throw new Error('Storage client required to fetch storage-backed entries');
    }

    // Fetch file from storage bucket
    const fileData = await storageClient.getFileDownload(
      'authored_sow_entries',
      fileId
    );

    // The file contains compressed data, decompress it
    return decompressJSON<T>(fileData);
  }

  // Existing inline decompression
  return decompressJSON<T>(data);
}
```

### Phase 4: Update Drivers

**AuthoredSOWDriver.ts:**
```typescript
async getPublishedSOW(courseId: string, version: string = "1"): Promise<AuthoredSOWData | null> {
  // ... existing query code ...

  const record = records[0];

  return {
    courseId: record.courseId,
    version: record.version,
    status: record.status,
    // Use new async decompression that handles storage refs
    entries: await decompressJSONWithStorage(record.entries, this.storage),
    metadata: JSON.parse(record.metadata),
    accessibility_notes: record.accessibility_notes
  };
}
```

## Storage Bucket Configuration

### Bucket Details

| Setting | Value |
|---------|-------|
| **Bucket ID** | `authored_sow_entries` |
| **Name** | Authored SOW Entries |
| **Permissions** | `read("any")` (public read for lesson delivery) |
| **File Size Limit** | 10MB (more than enough for entries) |
| **Allowed Extensions** | `.json.gz` (compressed JSON) |

### File Naming Convention

```
{courseId}_{version}_{timestamp}.json.gz

Example:
course_c84476_v2_20260120_123456.json.gz
```

## Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| **Existing SOWs (inline compressed)** | Continue to work - no storage prefix detected |
| **Existing SOWs (uncompressed JSON)** | Continue to work - detected as JSON |
| **New large SOWs** | Use storage bucket - `storage:` prefix |
| **New small SOWs** | Use inline compression - no prefix change |

## Testing Checklist

### Phase 1: Write Path
- [ ] Upload entries to storage when > 100k chars
- [ ] Store `storage:<file_id>` in entries field
- [ ] File uploaded with correct permissions
- [ ] Error handling for upload failures

### Phase 2: Backend Read Path
- [ ] Detect `storage:` prefix correctly
- [ ] Fetch file from storage bucket
- [ ] Decompress fetched data
- [ ] Works with existing inline entries
- [ ] Error handling for missing files

### Phase 3: Frontend Read Path
- [ ] `decompressJSONWithStorage` detects prefix
- [ ] Fetches from storage bucket
- [ ] Works with TypeScript drivers
- [ ] Works with test drivers
- [ ] Backward compatible with inline data

### Phase 4: Integration
- [ ] Full write→read cycle works
- [ ] Existing SOWs still readable
- [ ] New large SOWs stored in bucket
- [ ] Admin panel displays entries correctly

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────┐
│  IMPLEMENTATION ORDER (with dependencies)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. appwrite_mcp.py                                             │
│     └─ Add upload_file_to_storage()                             │
│     └─ Add download_file_from_storage()                         │
│                                                                  │
│  2. sow_upserter.py (depends on 1)                              │
│     └─ Implement storage bucket upload logic                    │
│     └─ Test: Verify upload works                                │
│                                                                  │
│  3. sow_extractor.py (depends on 1)                             │
│     └─ Implement storage bucket fetch logic                     │
│     └─ Test: Verify read works                                  │
│                                                                  │
│  4. compression.ts (Frontend)                                   │
│     └─ Add decompressJSONWithStorage()                          │
│     └─ Test: Verify decompression works                         │
│                                                                  │
│  5. AuthoredSOWDriver.ts (depends on 4)                         │
│     └─ Update to use async decompression                        │
│                                                                  │
│  6. SOWDriver.ts (depends on 4)                                 │
│     └─ Update to use async decompression                        │
│                                                                  │
│  7. ServerAuthoredSOWDriver.ts (depends on 4)                   │
│     └─ Update parseEntries() for storage refs                   │
│                                                                  │
│  8. Integration Test                                            │
│     └─ Run Phase 4 test with 19 lessons                         │
│     └─ Verify storage bucket upload                             │
│     └─ Verify frontend can read                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Notes

### Why Not Just Increase the Field Limit?

1. **Appwrite Cloud**: 100k limit is enforced, cannot be changed
2. **Self-hosted**: Requires modifying Appwrite source code and rebuilding Docker images
3. **Updates break**: Custom modifications break on Appwrite version updates
4. **Storage is designed for this**: Appwrite Storage handles large files natively

### Performance Considerations

- Storage fetch adds ~100-200ms latency per SOW read
- Acceptable for admin operations and initial lesson load
- Could cache fetched entries in memory if needed later

### Cleanup of Storage Files

When an SOW is deleted (force mode), the associated storage file should also be deleted:
```python
# In sow_upserter.py force mode section
if existing_entries.startswith(STORAGE_PREFIX):
    old_file_id = existing_entries[len(STORAGE_PREFIX):]
    await delete_file_from_storage(old_file_id, mcp_config_path)
```

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Backend Write Path (sow_upserter.py) | ⏳ Pending |
| 2 | Backend Read Path (sow_extractor.py) | ⏳ Pending |
| 3 | Frontend Read Path (compression.ts) | ⏳ Pending |
| 4 | Update Frontend Drivers | ⏳ Pending |
| 5 | Integration Testing | ⏳ Pending |

---

*Created: 2026-01-20*
*Last Updated: 2026-01-20*
