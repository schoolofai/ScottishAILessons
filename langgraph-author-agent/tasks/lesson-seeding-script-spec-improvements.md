# Plan: Generic SOW Seeding with Batch Processing

## Overview

Refactor `seedAuthoredSOW.ts` to:
1. Accept parameterized inputs (SOW file path)
2. Support batch mode with configurable input directory
3. Validate directory structure and JSON schemas
4. Process SOW files automatically

**Note**: The `research_packs/` folder exists in the directory structure but is **ignored** by the SOW seeding script (not currently used for SOW seeding).

## Current State Analysis

**Existing Files** (already restructured by user):
```
langgraph-author-agent/data/Seeding_Data/
├── input/
│   ├── sows/
│   │   ├── application-of-mathematics_national-3.json (104 entries)
│   │   ├── application-of-mathematics_national-4.json (90 entries)
│   │   └── mathematics_national-4.json (116 entries)
│   └── research_packs/ (EXISTS but IGNORED by SOW seeding script)
│       ├── application-of-mathematics_national-3.json
│       ├── application-of-mathematics_national-4.json
│       └── mathematics_national-4.json
└── output/ (TO BE CREATED)
    ├── logs/
    └── reports/
```

**Note**: The `research_packs/` folder is present in the directory structure but is **not used** by the SOW seeding script.

**Hardcoded Path** (line 409 in seedAuthoredSOW.ts):
```typescript
const jsonFilePath = path.join(__dirname, '../../langgraph-author-agent/data/sow_authored_AOM_nat3.json');
```

## Implementation Plan

### Phase 1: Directory Structure Setup

**Files to Create**:
1. `langgraph-author-agent/data/Seeding_Data/output/logs/` - Execution logs
2. `langgraph-author-agent/data/Seeding_Data/output/reports/` - Validation reports
3. `langgraph-author-agent/data/Seeding_Data/.gitignore` - Ignore output files

**Directory Validation Function**:
```typescript
function validateDirectoryStructure(baseDir: string): ValidationResult {
  const required = [
    'input/sows',
    'output/logs',
    'output/reports'
  ];
  // Note: input/research_packs is NOT validated (exists but ignored by script)

  // Check each required path exists
  // Return detailed validation result
}
```

### Phase 2: CLI Argument Parsing

**New Script Modes**:

**Mode 1: Single File** (explicit path)
```bash
npm run seed:authored-sow -- \
  --sow langgraph-author-agent/data/Seeding_Data/input/sows/mathematics_national-4.json
```

**Mode 2: By Name** (auto-resolve from Seeding_Data)
```bash
npm run seed:authored-sow -- --name mathematics_national-4
# Resolves to: input/sows/mathematics_national-4.json
```

**Mode 3: Batch** (process all SOW files)
```bash
npm run seed:authored-sow -- --batch
# Or with custom directory:
npm run seed:authored-sow -- --batch --input-dir /path/to/custom/Seeding_Data
```

**Argument Parser**:
```typescript
interface CLIArgs {
  mode: 'single' | 'named' | 'batch';
  sowFile?: string;
  name?: string;
  inputDir?: string;
  validate?: boolean;  // Dry-run validation only
}

function parseCLIArgs(): CLIArgs {
  // Use minimist or yargs for parsing
  // Default: --batch mode if no args provided
}
```

### Phase 3: JSON Schema Validation

**Schema Definitions**:

**SOW Schema**:
```typescript
const SOWSchema = {
  required: ['$id', 'courseId', 'version', 'status', 'metadata', 'entries'],
  properties: {
    courseId: { type: 'string', pattern: '^course_[a-z0-9]+$' },
    version: { type: 'number', minimum: 1 },
    status: { enum: ['draft', 'published', 'archived'] },
    entries: {
      type: 'array',
      minItems: 1,
      items: {
        required: ['order', 'lessonTemplateRef', 'label', 'outcomeRefs'],
        properties: {
          order: { type: 'number' },
          lessonTemplateRef: { type: 'string' },
          label: { type: 'string', minLength: 1 },
          outcomeRefs: { type: 'array', items: { type: 'string' } },
          assessmentStandardRefs: { type: 'array' }
        }
      }
    }
  }
};
```

**Validation Function**:
```typescript
import Ajv from 'ajv';

async function validateSOWFile(filePath: string): Promise<ValidationResult> {
  const ajv = new Ajv();
  const validate = ajv.compile(SOWSchema);

  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const valid = validate(content);

  return {
    valid,
    errors: validate.errors || [],
    warnings: checkWarnings(content)  // Custom warnings (e.g., title mismatches)
  };
}
```

### Phase 4: Batch Processing Logic

**File Discovery**:
```typescript
interface SOWFile {
  sowFile: string;
  name: string;  // e.g., "mathematics_national-4"
  subject: string;  // e.g., "mathematics"
  level: string;  // e.g., "national-4"
}

function discoverSOWFiles(inputDir: string): SOWFile[] {
  const sowsDir = path.join(inputDir, 'input/sows');

  const sowFiles = fs.readdirSync(sowsDir)
    .filter(f => f.endsWith('.json'));

  return sowFiles.map(sowFile => {
    const name = sowFile.replace('.json', '');
    const [subject, level] = name.split('_');

    return {
      sowFile: path.join(sowsDir, sowFile),
      name,
      subject,
      level
    };
  });
}
```

**Batch Processor**:
```typescript
async function processBatch(inputDir: string): Promise<BatchResult> {
  const sowFiles = discoverSOWFiles(inputDir);

  console.log(`\n📦 Batch Processing: ${sowFiles.length} SOW files found\n`);

  const results = [];

  for (const sow of sowFiles) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${sow.name}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Validate
      const validation = await validateSOWFile(sow.sowFile);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
      }

      // Seed
      await seedSingleSOW(sow.sowFile);

      results.push({ name: sow.name, status: 'success' });
    } catch (error) {
      console.error(`❌ Failed to process ${sow.name}:`, error.message);
      results.push({ name: sow.name, status: 'failed', error: error.message });
    }
  }

  // Generate summary report
  generateBatchReport(results, inputDir);

  return results;
}
```

### Phase 5: Refactor Main Function

**Extract Core Seeding Logic**:
```typescript
async function seedSingleSOW(
  sowFilePath: string
): Promise<void> {
  // Existing logic from seedAuthoredSOW() but parameterized

  console.log(`📖 Reading SOW data from: ${sowFilePath}`);

  if (!fs.existsSync(sowFilePath)) {
    throw new Error(`File not found: ${sowFilePath}`);
  }

  const fileContent = fs.readFileSync(sowFilePath, 'utf-8');
  const sowData: SOWJSONFile = JSON.parse(fileContent);

  // ... rest of existing 4-phase logic ...
}
```

**New Main Entry Point**:
```typescript
async function main() {
  const args = parseCLIArgs();

  // Set default input directory
  const defaultInputDir = path.join(__dirname, '../../langgraph-author-agent/data/Seeding_Data');
  const inputDir = args.inputDir || defaultInputDir;

  // Validate directory structure
  const dirValidation = validateDirectoryStructure(inputDir);
  if (!dirValidation.valid) {
    console.error('❌ Invalid directory structure:', dirValidation.errors);
    process.exit(1);
  }

  // Route to appropriate mode
  if (args.mode === 'batch') {
    await processBatch(inputDir);
  } else if (args.mode === 'named') {
    const sowFile = path.join(inputDir, 'input/sows', `${args.name}.json`);
    await seedSingleSOW(sowFile);
  } else {
    await seedSingleSOW(args.sowFile!);
  }
}
```

### Phase 6: Logging and Reporting

**Execution Log**:
```typescript
const logFile = path.join(inputDir, 'output/logs', `seed-${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile);

function log(message: string) {
  console.log(message);
  logStream.write(message + '\n');
}
```

**Batch Report**:
```typescript
function generateBatchReport(results: BatchResult[], inputDir: string) {
  const reportFile = path.join(inputDir, 'output/reports', `batch-report-${Date.now()}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    results
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`\n📊 Batch Summary:`);
  console.log(`   Total: ${report.total}`);
  console.log(`   ✅ Successful: ${report.successful}`);
  console.log(`   ❌ Failed: ${report.failed}`);
  console.log(`\n📁 Report saved: ${reportFile}`);
}
```

### Phase 7: NPM Scripts Update

**package.json** additions:
```json
{
  "scripts": {
    "seed:authored-sow": "tsx scripts/seedAuthoredSOW.ts",
    "seed:sow:single": "tsx scripts/seedAuthoredSOW.ts --sow",
    "seed:sow:batch": "tsx scripts/seedAuthoredSOW.ts --batch",
    "seed:sow:validate": "tsx scripts/seedAuthoredSOW.ts --batch --validate"
  }
}
```

## File Changes

### Files to Modify

1. **`assistant-ui-frontend/scripts/seedAuthoredSOW.ts`**
   - Add CLI argument parsing (use `minimist` library)
   - Extract `seedSingleSOW()` function
   - Add `processBatch()` function
   - Add `validateSOWFile()` function
   - Add `validateDirectoryStructure()` function
   - Add logging infrastructure
   - Refactor `main()` as router

2. **`assistant-ui-frontend/package.json`**
   - Add `minimist` dependency
   - Add `ajv` dependency (for JSON schema validation)
   - Update npm scripts

3. **`langgraph-author-agent/docs/Seeding/README.md`**
   - Update with new CLI usage
   - Document batch mode
   - Document validation mode

### Files to Create

1. **`langgraph-author-agent/data/Seeding_Data/.gitignore`**
   ```
   output/logs/*.log
   output/reports/*.json
   ```

2. **`langgraph-author-agent/data/Seeding_Data/README.md`**
   ```markdown
   # Seeding Data Directory

   ## Structure
   - input/sows/ - SOW JSON files (used by seeding script)
   - input/research_packs/ - Research pack JSON files (exists but ignored by SOW seeding)
   - output/logs/ - Execution logs
   - output/reports/ - Batch processing reports

   ## Naming Convention
   Files must follow: `<subject>_<level>.json`

   Examples:
   - mathematics_national-4.json
   - application-of-mathematics_national-3.json

   ## Note
   The `research_packs/` folder is not used by the SOW seeding script.
   ```

3. **`assistant-ui-frontend/scripts/lib/sowSchemas.ts`** (optional)
   - Export SOW_SCHEMA
   - Export validation utilities

## Testing Strategy

### Test Cases

**1. Single File Mode**:
```bash
npm run seed:authored-sow -- --name mathematics_national-4
# Expected: Seeds only mathematics_national-4 SOW
```

**2. Batch Mode**:
```bash
npm run seed:authored-sow -- --batch
# Expected: Seeds all 3 SOWs, generates report
```

**3. Validation Only**:
```bash
npm run seed:authored-sow -- --batch --validate
# Expected: Validates all files, no database writes, generates report
```

**4. Custom Input Directory**:
```bash
npm run seed:authored-sow -- --batch --input-dir /custom/path
# Expected: Processes files from custom directory
```

**5. Invalid JSON**:
```bash
# Manually corrupt a JSON file
npm run seed:authored-sow -- --name corrupted_file
# Expected: Clear error message with validation details
```

## Success Criteria

- [ ] Script runs in single file mode with --name parameter
- [ ] Script runs in batch mode processing all SOW files
- [ ] Directory structure validated before processing
- [ ] JSON schema validated for each file
- [ ] Execution logs written to output/logs/
- [ ] Batch reports written to output/reports/
- [ ] Failed files don't stop batch processing (continue on error)
- [ ] Clear error messages for validation failures
- [ ] Backwards compatible (default behavior processes all)
- [ ] Documentation updated with new usage patterns

## Future Enhancements (Not in This Phase)

- Parallel batch processing (Promise.all)
- Progress bar for batch mode
- Email/Slack notifications on completion
- Resume failed batches
- Incremental seeding (only changed files)

## Migration Notes

**Breaking Changes**: None - script is backwards compatible

**Default Behavior**:
- If no arguments: Run batch mode on default Seeding_Data directory
- Preserves existing 4-phase validation pipeline
- Same error handling and logging

**Data Migration**: User has already restructured files ✅
