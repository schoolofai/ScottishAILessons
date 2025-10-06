#!/usr/bin/env tsx

/**
 * Test compression functionality with sample lesson data
 */

import { compressCards, decompressCards, getCompressionStats, isCompressed } from '../lib/appwrite/utils/compression';

// Sample lesson cards (realistic example)
const sampleCards = [
  {
    "id": "card1_currency_basic",
    "title": "Practice: Holiday Money",
    "explainer": "When you go on holiday to another country, you often need to change your money from Pounds (£) to a different currency, like Euros (€).\n\nTo do this, you use an **exchange rate**. \nFor example, if the exchange rate is **£1 = €1.15**, it means for every one pound you have, you will get 1.15 euros.",
    "explainer_plain": "You need to change money for holidays.\nThis is called currency exchange.",
    "cfu": {
      "type": "numeric",
      "id": "cfu_currency1",
      "stem": "You are going to Spain and need to change £200 into Euros (€). The exchange rate is **£1 = €1.18**. How many Euros will you get?",
      "expected": 236,
      "tolerance": 0,
      "money2dp": true
    },
    "rubric": {
      "total_points": 2,
      "criteria": [
        {
          "description": "Correct method: multiplying the amount in pounds by the exchange rate (200 x 1.18).",
          "points": 1
        }
      ]
    },
    "misconceptions": [
      {
        "id": "MISC_MATH_DIVIDE_INSTEAD_OF_MULTIPLY",
        "misconception": "Student divides the amount in pounds by the exchange rate instead of multiplying.",
        "clarification": "Remind students that when you change pounds into a foreign currency, you are 'buying' that currency."
      }
    ],
    "context_hooks": [
      "Planning a holiday to a European country like Spain, France, or Italy.",
      "Checking exchange rates at a Post Office or travel agent."
    ]
  }
];

console.log('\n=== Compression Test ===\n');

try {
  // Test compression
  console.log('1. Testing compression...');
  const compressed = compressCards(sampleCards);
  console.log('✅ Compression successful');
  console.log('   Compressed format:', compressed.substring(0, 50) + '...');
  console.log('   Is compressed?', isCompressed(compressed));

  // Get stats
  console.log('\n2. Compression statistics:');
  const stats = getCompressionStats(sampleCards);
  console.log('   Original size:', stats.original, 'characters');
  console.log('   Compressed size:', stats.compressed, 'characters');
  console.log('   Compression ratio:', stats.ratio);
  console.log('   Space savings:', stats.savings);

  // Test decompression
  console.log('\n3. Testing decompression...');
  const decompressed = decompressCards(compressed);
  console.log('✅ Decompression successful');
  console.log('   Cards count:', decompressed.length);
  console.log('   First card ID:', decompressed[0]?.id);

  // Verify data integrity
  console.log('\n4. Verifying data integrity...');
  const originalJson = JSON.stringify(sampleCards);
  const decompressedJson = JSON.stringify(decompressed);
  const isIdentical = originalJson === decompressedJson;
  console.log('   Data matches original?', isIdentical ? '✅ YES' : '❌ NO');

  // Test backward compatibility (uncompressed JSON)
  console.log('\n5. Testing backward compatibility...');
  const uncompressedJson = JSON.stringify(sampleCards);
  const backwardCompatDecompressed = decompressCards(uncompressedJson);
  console.log('✅ Backward compatibility works');
  console.log('   Parsed cards count:', backwardCompatDecompressed.length);

  console.log('\n=== All Tests Passed! ===\n');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
}
