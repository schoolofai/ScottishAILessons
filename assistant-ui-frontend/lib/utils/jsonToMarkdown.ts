/**
 * Convert JSON hierarchy to structured markdown
 * Uses JSON structure to create sections and subsections
 */
export function jsonToMarkdown(data: any, depth: number = 1): string {
  let markdown = '';

  function formatKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  function processValue(key: string, value: any, currentDepth: number) {
    const heading = '#'.repeat(Math.min(currentDepth, 6)); // Max 6 levels

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        markdown += `${heading} ${formatKey(key)}\n\n`;

        // Handle array of objects vs primitives
        if (value.length === 0) {
          markdown += '*No items*\n\n';
        } else if (typeof value[0] === 'object' && value[0] !== null) {
          // Array of objects - treat each as a subsection
          value.forEach((item, index) => {
            markdown += `${heading}# Item ${index + 1}\n\n`;
            Object.entries(item).forEach(([k, v]) => {
              processValue(k, v, currentDepth + 2);
            });
          });
        } else {
          // Array of primitives - render as list
          value.forEach((item, index) => {
            markdown += `${index + 1}. ${String(item)}\n`;
          });
          markdown += '\n';
        }
      } else {
        // Object - recursively process properties
        markdown += `${heading} ${formatKey(key)}\n\n`;
        Object.entries(value).forEach(([k, v]) => {
          processValue(k, v, currentDepth + 1);
        });
      }
    } else {
      // Primitive value - render as key-value pair
      markdown += `**${formatKey(key)}:** ${formatPrimitiveValue(value)}\n\n`;
    }
  }

  function formatPrimitiveValue(value: any): string {
    if (value === null || value === undefined) {
      return '*Not provided*';
    }
    if (typeof value === 'boolean') {
      return value ? '✓ Yes' : '✗ No';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'string') {
      // Preserve line breaks in strings
      return value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
    }
    return String(value);
  }

  // Process top-level keys
  Object.entries(data).forEach(([key, value]) => {
    processValue(key, value, depth);
  });

  return markdown;
}
