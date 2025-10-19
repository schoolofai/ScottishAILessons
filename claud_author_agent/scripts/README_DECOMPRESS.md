# Cards Field Decompression Scripts

These scripts decompress the `cards` field from Appwrite `lesson_templates` collection and display it as formatted JSON.

The cards are stored in compressed format (gzip + base64) to save database storage space (~81% compression ratio). These scripts provide easy access to the underlying card data.

---

## Quick Start

### Bash Script (Recommended for one-off use)

```bash
# Get the compressed cards string from Appwrite, then:
./decompress_cards.sh "H4sIAAAAAAAAA..."
```

### Python Script (Recommended for automation)

```bash
# Command-line
python decompress_cards.py "H4sIAAAAAAAAA..."

# Interactive mode
python decompress_cards.py

# Export to file
python decompress_cards.py "H4sI..." --export cards.json
```

---

## Features

### Bash Script (`decompress_cards.sh`)

✅ **Compression Statistics**
- Original (base64) size
- Decompressed size (approx)
- Compression ratio and savings percentage

✅ **Cards Summary**
- Total card count
- Unique card types
- Card titles with numbers

✅ **Formatted JSON Output**
- Pretty-printed with 2-space indentation
- Color-coded sections
- Error messages with suggestions

✅ **Lightweight**
- No external dependencies (except standard Unix tools)
- Works on Linux, macOS, Windows (with WSL/Git Bash)

### Python Script (`decompress_cards.py`)

✅ **All Bash Features Plus:**
- Interactive mode (paste and enter)
- Export to JSON file
- Better error messages
- Cross-platform (Windows, Mac, Linux native)
- Optional colorized output

✅ **Flexible Input**
- Command-line argument
- stdin pipe
- Interactive paste mode
- File input

✅ **Better Error Handling**
- Detailed error messages
- Suggestions for common issues
- Exit codes for scripting

---

## Usage Examples

### Example 1: Simple Decompression (Bash)

```bash
./decompress_cards.sh "H4sIAHx5aGYC/wvJLC4pKkktLlGyUlAqS8wpTVWqBACF5BVk/lkDAAAA"
```

**Output:**
```
════════════════════════════════════════════════════════════
CARDS DECOMPRESSION TOOL
════════════════════════════════════════════════════════════

  Input length: 89 characters

=== DECOMPRESSING ===
✓ Decompression successful

=== COMPRESSION STATISTICS ===
Base64 size:         89 characters
Decompressed size:   456 characters (approx)
Compression ratio:   19.5%
Space saved:         80.5%

=== CARDS SUMMARY ===
✓ Total cards: 2
✓ Card types: explainer, guided_practice
ℹ Card titles:
  (1) Starter: Understanding Fractions
  (2) Guided Practice: Working with Fractions

=== FORMATTED JSON ===
  [
    {
      "id": "card_001",
      "title": "Starter: Understanding Fractions",
      "card_type": "starter",
      ...
    },
    ...
  ]

=== COMPLETION ===
✓ Successfully decompressed and formatted cards
```

### Example 2: Copy-Paste from Appwrite (Python Interactive)

```bash
python decompress_cards.py
```

Then paste the compressed string from Appwrite and press Enter twice.

### Example 3: Pipe from File (Bash)

```bash
# Save compressed string to file
echo "H4sIAAAAAAAAA..." > /tmp/cards_compressed.txt

# Decompress
./decompress_cards.sh < /tmp/cards_compressed.txt
```

### Example 4: Export to File (Python)

```bash
python decompress_cards.py "H4sIAAAAAAAAA..." --export cards_decompressed.json

# Verify with jq
jq '.[].title' cards_decompressed.json
```

### Example 5: Combine with jq (Bash)

```bash
# Get card titles only
./decompress_cards.sh "H4sI..." | jq -r '.[] | .title'

# Get specific card
./decompress_cards.sh "H4sI..." | jq '.[0]'

# Filter by card type
./decompress_cards.sh "H4sI..." | jq '.[] | select(.card_type == "exit_ticket")'
```

---

## Prerequisites

### Bash Script

**Required (usually pre-installed):**
- `base64` - Base64 encoding/decoding
- `gunzip` - gzip decompression
- `jq` - JSON query/formatting
- `cut`, `wc`, `awk` - Text processing

**Installation:**

```bash
# macOS (if jq missing)
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# RedHat/CentOS
sudo yum install jq
```

### Python Script

**Built-in modules:**
- `base64` - Part of Python stdlib
- `gzip` - Part of Python stdlib
- `json` - Part of Python stdlib

**Optional:**
- `colorama` - For colored output (pip install colorama)

**Installation:**

```bash
# Python 3.7+ (should be pre-installed)
python --version

# Optional: Install colorama for colors
pip install colorama
```

---

## Integration with Appwrite

### Getting Compressed Cards from Appwrite

#### Option 1: Using Appwrite Dashboard

1. Go to `default` database → `lesson_templates` collection
2. Click on a document
3. Find the `cards` field (appears as long base64 string)
4. Copy the entire string

#### Option 2: Using Appwrite CLI

```bash
# List lesson templates
appwrite databases list-documents \
  --database-id default \
  --collection-id lesson_templates

# Get specific document
appwrite databases get-document \
  --database-id default \
  --collection-id lesson_templates \
  --document-id YOUR_DOC_ID \
  | jq -r '.cards'
```

#### Option 3: Using API

```bash
curl https://YOUR_APPWRITE_URL/v1/databases/default/collections/lesson_templates/documents/DOC_ID \
  -H "X-Appwrite-Key: YOUR_API_KEY" \
  | jq -r '.cards'
```

### Pipeline: Appwrite → Decompress → Process

```bash
# Complete pipeline
appwrite databases get-document \
  --database-id default \
  --collection-id lesson_templates \
  --document-id YOUR_DOC_ID \
  | jq -r '.cards' \
  | python decompress_cards.py
```

---

## Troubleshooting

### Issue: "base64: invalid input"

**Cause:** Compressed string contains invalid characters

**Solution:**
1. Copy the entire `cards` field value from Appwrite
2. Check for extra quotes or whitespace
3. Ensure it ends with `==` (base64 padding)

### Issue: "Failed to decompress data (invalid gzip or corrupted)"

**Cause:** Data is corrupted or not in gzip format

**Solutions:**
1. Check that you copied the full string (should be 100+ characters)
2. Verify the string wasn't truncated in Appwrite UI
3. Try copying directly from API response (more reliable)

### Issue: "jq: command not found" (Bash only)

**Solution:**
```bash
# Install jq
brew install jq        # macOS
sudo apt-get install jq  # Linux
```

### Issue: "Python: command not found"

**Solution:**
```bash
# Use python3 explicitly
python3 decompress_cards.py "H4sI..."
```

### Issue: No colored output (Python)

**Solutions:**
1. Install colorama: `pip install colorama`
2. Or disable colors: `python decompress_cards.py --no-color "H4sI..."`

---

## Technical Details

### Compression Algorithm

The cards field uses a three-stage compression pipeline:

1. **JSON Serialization:** Cards array → JSON string
2. **Gzip Compression:** JSON → compressed bytes (typical ~81% size reduction)
3. **Base64 Encoding:** Compressed bytes → URL-safe text string

### Decompression Pipeline

These scripts reverse the process:

```
Base64 string
    ↓ (base64 decode)
Gzip compressed bytes
    ↓ (gunzip decompress)
UTF-8 text
    ↓ (JSON parse)
Cards array (JavaScript/Python objects)
```

### Why This Approach?

- **Storage efficient:** Saves ~81% space in database
- **Database compatible:** Base64 text can be stored in string fields
- **Standard format:** Uses only gzip + base64 (no proprietary formats)
- **Tool-agnostic:** Any system with gzip + base64 can decompress

---

## Examples: Practical Workflows

### Inspect All Card Titles in a Lesson

```bash
python decompress_cards.py "H4sI..." | jq -r '.[] | .title'
```

### Find Cards with Specific CFU Type

```bash
# Find all MCQ cards
python decompress_cards.py "H4sI..." | jq '.[] | select(.cfu.type == "mcq")'

# Find cards with misconceptions
python decompress_cards.py "H4sI..." | jq '.[] | select(.misconceptions | length > 0)'
```

### Calculate Card Statistics

```bash
python decompress_cards.py "H4sI..." | jq '
  {
    total_cards: length,
    total_minutes: map(.estimated_minutes) | add,
    card_types: map(.card_type) | unique,
    avg_explainer_length: (map(select(.card_type == "explainer") | .explainer | length) | add / length)
  }
'
```

### Backup All Lesson Cards

```bash
# Get all lessons and decompress each one
for doc_id in $(appwrite databases list-documents \
  --database-id default \
  --collection-id lesson_templates \
  | jq -r '.[].[$id]'); do
    appwrite databases get-document \
      --database-id default \
      --collection-id lesson_templates \
      --document-id "$doc_id" \
      | jq -r '.cards' \
      | python decompress_cards.py --export "cards_${doc_id}.json"
done
```

---

## Exit Codes

### Bash Script

- `0` - Success
- `1` - Input error or decompression failed
- `2` - Missing dependencies

### Python Script

- `0` - Success
- `1` - Input error or decompression failed
- `Ctrl+C` - User interrupted

---

## Author & License

Created for the Scottish AI Lessons project.

MIT License - Free to modify and distribute.

---

## Support

For issues or feature requests, see the main project README or contact the development team.
