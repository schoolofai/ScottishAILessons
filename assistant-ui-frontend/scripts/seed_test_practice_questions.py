#!/usr/bin/env python3
"""
Seed Test Practice Questions for lesson_test_simple_addition

Creates 27 simple MCQ questions across 3 blocks for testing the practice_wizard workflow.
All questions are designed to be trivially simple (7-year-old level) for quick workflow testing.

Usage:
    python scripts/seed_test_practice_questions.py

Environment variables (loaded from .env.local):
    NEXT_PUBLIC_APPWRITE_ENDPOINT - Appwrite endpoint URL
    NEXT_PUBLIC_APPWRITE_PROJECT_ID - Project ID
    APPWRITE_API_KEY - Server-side API key
"""

import json
import hashlib
import os
import io
from datetime import datetime, timezone
from typing import Any

# Load environment from .env.local
from dotenv import load_dotenv
load_dotenv('.env.local')

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage
from appwrite.input_file import InputFile
from appwrite.id import ID

# ========================================
# CONFIGURATION
# ========================================
DATABASE_ID = "default"
PRACTICE_BLOCKS_COLLECTION = "practice_blocks"
PRACTICE_QUESTIONS_COLLECTION = "practice_questions"
PRACTICE_CONTENT_BUCKET = "practice_content"
LESSON_TEMPLATE_ID = "lesson_test_simple_addition"
EXECUTION_ID = "test_seed_20250106"
GENERATOR_VERSION = "test_1.0.0"

# ========================================
# BLOCK DEFINITIONS
# ========================================
BLOCKS = [
    {
        "blockId": "block_test_001",
        "blockIndex": 0,
        "title": "Single Digit Addition",
        "explanationPreview": "Learn to add numbers from 1 to 9.",
        "blockData": {
            "explanation": "When we add single digit numbers, we combine small amounts. For example, 2 + 3 means start at 2 and count up 3 more: 3, 4, 5. So 2 + 3 = 5.",
            "worked_example": {
                "problem": "What is 4 + 2?",
                "solution_steps": ["Start at 4", "Count up 2 more: 5, 6", "The answer is 6"],
                "final_answer": "6"
            },
            "key_formulas": [],
            "common_misconceptions": ["Forgetting to count correctly"]
        }
    },
    {
        "blockId": "block_test_002",
        "blockIndex": 1,
        "title": "Double Digit Addition",
        "explanationPreview": "Learn to add numbers like 10 + 5 or 12 + 3.",
        "blockData": {
            "explanation": "When adding double digit numbers, add the ones first, then the tens. For 12 + 5: the ones are 2 + 5 = 7, and the tens stay as 1, so 12 + 5 = 17.",
            "worked_example": {
                "problem": "What is 11 + 4?",
                "solution_steps": ["11 has 1 ten and 1 one", "Add 4 ones: 1 + 4 = 5 ones", "Keep the 1 ten", "Answer: 15"],
                "final_answer": "15"
            },
            "key_formulas": [],
            "common_misconceptions": ["Adding tens and ones incorrectly"]
        }
    },
    {
        "blockId": "block_test_003",
        "blockIndex": 2,
        "title": "Addition Word Problems",
        "explanationPreview": "Solve simple addition stories.",
        "blockData": {
            "explanation": "Word problems tell a story. Look for words like 'total', 'altogether', 'in all', or 'how many' - these usually mean add! Read carefully and find the two numbers to add together.",
            "worked_example": {
                "problem": "Sam has 3 apples. He gets 2 more. How many apples does Sam have now?",
                "solution_steps": ["Sam starts with 3 apples", "He gets 2 more", "Add them: 3 + 2 = 5", "Sam has 5 apples"],
                "final_answer": "5 apples"
            },
            "key_formulas": [],
            "common_misconceptions": ["Not reading the question carefully"]
        }
    }
]

# ========================================
# QUESTION DEFINITIONS (27 QUESTIONS)
# ========================================
QUESTIONS = [
    # === BLOCK 1: Single Digit Addition ===
    # Easy (3 questions)
    {
        "questionId": "q_test_b1_e1",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "easy",
        "stemPreview": "What is 1 + 1?",
        "optionsPreview": "A) 1  B) 2  C) 3  D) 11",
        "questionData": {
            "stem": "What is 1 + 1?",
            "options": ["1", "2", "3", "11"],
            "correct_answer": "2",
            "acceptable_answers": ["2", "two"],
            "solution": "1 + 1 = 2. Count: start at 1, go up 1 more = 2.",
            "hints": ["Start at 1 and count one more", "Use your fingers if it helps"]
        }
    },
    {
        "questionId": "q_test_b1_e2",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "easy",
        "stemPreview": "What is 2 + 2?",
        "optionsPreview": "A) 2  B) 3  C) 4  D) 22",
        "questionData": {
            "stem": "What is 2 + 2?",
            "options": ["2", "3", "4", "22"],
            "correct_answer": "4",
            "acceptable_answers": ["4", "four"],
            "solution": "2 + 2 = 4. Two plus two equals four.",
            "hints": ["Think of 2 pairs", "Count: 1, 2, 3, 4"]
        }
    },
    {
        "questionId": "q_test_b1_e3",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "easy",
        "stemPreview": "What is 3 + 1?",
        "optionsPreview": "A) 3  B) 4  C) 5  D) 31",
        "questionData": {
            "stem": "What is 3 + 1?",
            "options": ["3", "4", "5", "31"],
            "correct_answer": "4",
            "acceptable_answers": ["4", "four"],
            "solution": "3 + 1 = 4. Start at 3, count up 1 more = 4.",
            "hints": ["Start at 3", "Go up just 1"]
        }
    },
    # Medium (3 questions)
    {
        "questionId": "q_test_b1_m1",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "medium",
        "stemPreview": "What is 4 + 3?",
        "optionsPreview": "A) 6  B) 7  C) 8  D) 43",
        "questionData": {
            "stem": "What is 4 + 3?",
            "options": ["6", "7", "8", "43"],
            "correct_answer": "7",
            "acceptable_answers": ["7", "seven"],
            "solution": "4 + 3 = 7. Count from 4: 5, 6, 7.",
            "hints": ["Start at 4", "Count up 3 more"]
        }
    },
    {
        "questionId": "q_test_b1_m2",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "medium",
        "stemPreview": "What is 5 + 3?",
        "optionsPreview": "A) 7  B) 8  C) 9  D) 53",
        "questionData": {
            "stem": "What is 5 + 3?",
            "options": ["7", "8", "9", "53"],
            "correct_answer": "8",
            "acceptable_answers": ["8", "eight"],
            "solution": "5 + 3 = 8. Five plus three equals eight.",
            "hints": ["Think of 5 fingers plus 3 more", "Count from 5"]
        }
    },
    {
        "questionId": "q_test_b1_m3",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "medium",
        "stemPreview": "What is 6 + 2?",
        "optionsPreview": "A) 7  B) 8  C) 9  D) 62",
        "questionData": {
            "stem": "What is 6 + 2?",
            "options": ["7", "8", "9", "62"],
            "correct_answer": "8",
            "acceptable_answers": ["8", "eight"],
            "solution": "6 + 2 = 8. Start at 6, go up 2: 7, 8.",
            "hints": ["Start at 6", "Count 2 more"]
        }
    },
    # Hard (3 questions)
    {
        "questionId": "q_test_b1_h1",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "hard",
        "stemPreview": "What is 7 + 2?",
        "optionsPreview": "A) 8  B) 9  C) 10  D) 72",
        "questionData": {
            "stem": "What is 7 + 2?",
            "options": ["8", "9", "10", "72"],
            "correct_answer": "9",
            "acceptable_answers": ["9", "nine"],
            "solution": "7 + 2 = 9. Seven plus two equals nine.",
            "hints": ["Start at 7", "Count: 8, 9"]
        }
    },
    {
        "questionId": "q_test_b1_h2",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "hard",
        "stemPreview": "What is 5 + 4?",
        "optionsPreview": "A) 8  B) 9  C) 10  D) 54",
        "questionData": {
            "stem": "What is 5 + 4?",
            "options": ["8", "9", "10", "54"],
            "correct_answer": "9",
            "acceptable_answers": ["9", "nine"],
            "solution": "5 + 4 = 9. Five plus four equals nine.",
            "hints": ["5 + 5 = 10, so 5 + 4 is one less", "Count from 5"]
        }
    },
    {
        "questionId": "q_test_b1_h3",
        "blockId": "block_test_001",
        "blockTitle": "Single Digit Addition",
        "difficulty": "hard",
        "stemPreview": "What is 6 + 3?",
        "optionsPreview": "A) 8  B) 9  C) 10  D) 63",
        "questionData": {
            "stem": "What is 6 + 3?",
            "options": ["8", "9", "10", "63"],
            "correct_answer": "9",
            "acceptable_answers": ["9", "nine"],
            "solution": "6 + 3 = 9. Six plus three equals nine.",
            "hints": ["Start at 6", "Count: 7, 8, 9"]
        }
    },

    # === BLOCK 2: Double Digit Addition ===
    # Easy (3 questions)
    {
        "questionId": "q_test_b2_e1",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "easy",
        "stemPreview": "What is 10 + 1?",
        "optionsPreview": "A) 10  B) 11  C) 12  D) 101",
        "questionData": {
            "stem": "What is 10 + 1?",
            "options": ["10", "11", "12", "101"],
            "correct_answer": "11",
            "acceptable_answers": ["11", "eleven"],
            "solution": "10 + 1 = 11. Ten plus one equals eleven.",
            "hints": ["10 is one ten", "Add 1 to get eleven"]
        }
    },
    {
        "questionId": "q_test_b2_e2",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "easy",
        "stemPreview": "What is 10 + 2?",
        "optionsPreview": "A) 11  B) 12  C) 13  D) 102",
        "questionData": {
            "stem": "What is 10 + 2?",
            "options": ["11", "12", "13", "102"],
            "correct_answer": "12",
            "acceptable_answers": ["12", "twelve"],
            "solution": "10 + 2 = 12. Ten plus two equals twelve.",
            "hints": ["10 is one ten", "Add 2 to the ones place"]
        }
    },
    {
        "questionId": "q_test_b2_e3",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "easy",
        "stemPreview": "What is 10 + 5?",
        "optionsPreview": "A) 14  B) 15  C) 16  D) 105",
        "questionData": {
            "stem": "What is 10 + 5?",
            "options": ["14", "15", "16", "105"],
            "correct_answer": "15",
            "acceptable_answers": ["15", "fifteen"],
            "solution": "10 + 5 = 15. Ten plus five equals fifteen.",
            "hints": ["Start at 10", "Count up 5"]
        }
    },
    # Medium (3 questions)
    {
        "questionId": "q_test_b2_m1",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "medium",
        "stemPreview": "What is 11 + 2?",
        "optionsPreview": "A) 12  B) 13  C) 14  D) 112",
        "questionData": {
            "stem": "What is 11 + 2?",
            "options": ["12", "13", "14", "112"],
            "correct_answer": "13",
            "acceptable_answers": ["13", "thirteen"],
            "solution": "11 + 2 = 13. Eleven plus two equals thirteen.",
            "hints": ["11 has 1 + 1 in the ones", "Add 2 more ones"]
        }
    },
    {
        "questionId": "q_test_b2_m2",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "medium",
        "stemPreview": "What is 12 + 3?",
        "optionsPreview": "A) 14  B) 15  C) 16  D) 123",
        "questionData": {
            "stem": "What is 12 + 3?",
            "options": ["14", "15", "16", "123"],
            "correct_answer": "15",
            "acceptable_answers": ["15", "fifteen"],
            "solution": "12 + 3 = 15. Twelve plus three equals fifteen.",
            "hints": ["12 has 2 ones", "2 + 3 = 5 ones"]
        }
    },
    {
        "questionId": "q_test_b2_m3",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "medium",
        "stemPreview": "What is 14 + 2?",
        "optionsPreview": "A) 15  B) 16  C) 17  D) 142",
        "questionData": {
            "stem": "What is 14 + 2?",
            "options": ["15", "16", "17", "142"],
            "correct_answer": "16",
            "acceptable_answers": ["16", "sixteen"],
            "solution": "14 + 2 = 16. Fourteen plus two equals sixteen.",
            "hints": ["14 has 4 ones", "4 + 2 = 6 ones"]
        }
    },
    # Hard (3 questions)
    {
        "questionId": "q_test_b2_h1",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "hard",
        "stemPreview": "What is 13 + 4?",
        "optionsPreview": "A) 16  B) 17  C) 18  D) 134",
        "questionData": {
            "stem": "What is 13 + 4?",
            "options": ["16", "17", "18", "134"],
            "correct_answer": "17",
            "acceptable_answers": ["17", "seventeen"],
            "solution": "13 + 4 = 17. Thirteen plus four equals seventeen.",
            "hints": ["13 has 3 ones", "3 + 4 = 7 ones"]
        }
    },
    {
        "questionId": "q_test_b2_h2",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "hard",
        "stemPreview": "What is 15 + 3?",
        "optionsPreview": "A) 17  B) 18  C) 19  D) 153",
        "questionData": {
            "stem": "What is 15 + 3?",
            "options": ["17", "18", "19", "153"],
            "correct_answer": "18",
            "acceptable_answers": ["18", "eighteen"],
            "solution": "15 + 3 = 18. Fifteen plus three equals eighteen.",
            "hints": ["15 has 5 ones", "5 + 3 = 8 ones"]
        }
    },
    {
        "questionId": "q_test_b2_h3",
        "blockId": "block_test_002",
        "blockTitle": "Double Digit Addition",
        "difficulty": "hard",
        "stemPreview": "What is 16 + 2?",
        "optionsPreview": "A) 17  B) 18  C) 19  D) 162",
        "questionData": {
            "stem": "What is 16 + 2?",
            "options": ["17", "18", "19", "162"],
            "correct_answer": "18",
            "acceptable_answers": ["18", "eighteen"],
            "solution": "16 + 2 = 18. Sixteen plus two equals eighteen.",
            "hints": ["16 has 6 ones", "6 + 2 = 8 ones"]
        }
    },

    # === BLOCK 3: Word Problems ===
    # Easy (3 questions)
    {
        "questionId": "q_test_b3_e1",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "easy",
        "stemPreview": "Sam has 2 apples. He gets 1 more. How many apples does Sam have?",
        "optionsPreview": "A) 2  B) 3  C) 4  D) 21",
        "questionData": {
            "stem": "Sam has 2 apples. He gets 1 more. How many apples does Sam have?",
            "options": ["2", "3", "4", "21"],
            "correct_answer": "3",
            "acceptable_answers": ["3", "three", "3 apples"],
            "solution": "Sam has 2 apples + 1 more = 3 apples.",
            "hints": ["Sam starts with 2", "He gets 1 more, so add"]
        }
    },
    {
        "questionId": "q_test_b3_e2",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "easy",
        "stemPreview": "There are 3 birds. 2 more birds come. How many birds are there now?",
        "optionsPreview": "A) 4  B) 5  C) 6  D) 32",
        "questionData": {
            "stem": "There are 3 birds. 2 more birds come. How many birds are there now?",
            "options": ["4", "5", "6", "32"],
            "correct_answer": "5",
            "acceptable_answers": ["5", "five", "5 birds"],
            "solution": "3 birds + 2 more birds = 5 birds.",
            "hints": ["Start with 3 birds", "More birds come, so add"]
        }
    },
    {
        "questionId": "q_test_b3_e3",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "easy",
        "stemPreview": "Mia has 4 toys. She gets 1 more toy. How many toys does Mia have?",
        "optionsPreview": "A) 4  B) 5  C) 6  D) 41",
        "questionData": {
            "stem": "Mia has 4 toys. She gets 1 more toy. How many toys does Mia have?",
            "options": ["4", "5", "6", "41"],
            "correct_answer": "5",
            "acceptable_answers": ["5", "five", "5 toys"],
            "solution": "4 toys + 1 more toy = 5 toys.",
            "hints": ["Mia starts with 4", "She gets more, so add"]
        }
    },
    # Medium (3 questions)
    {
        "questionId": "q_test_b3_m1",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "medium",
        "stemPreview": "Tom has 5 stickers. His friend gives him 3 more. How many stickers does Tom have in total?",
        "optionsPreview": "A) 7  B) 8  C) 9  D) 53",
        "questionData": {
            "stem": "Tom has 5 stickers. His friend gives him 3 more. How many stickers does Tom have in total?",
            "options": ["7", "8", "9", "53"],
            "correct_answer": "8",
            "acceptable_answers": ["8", "eight", "8 stickers"],
            "solution": "5 stickers + 3 stickers = 8 stickers.",
            "hints": ["Tom starts with 5", "He gets 3 more"]
        }
    },
    {
        "questionId": "q_test_b3_m2",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "medium",
        "stemPreview": "There are 4 cats and 4 dogs. How many animals are there altogether?",
        "optionsPreview": "A) 7  B) 8  C) 9  D) 44",
        "questionData": {
            "stem": "There are 4 cats and 4 dogs. How many animals are there altogether?",
            "options": ["7", "8", "9", "44"],
            "correct_answer": "8",
            "acceptable_answers": ["8", "eight", "8 animals"],
            "solution": "4 cats + 4 dogs = 8 animals altogether.",
            "hints": ["'Altogether' means add", "4 + 4 = ?"]
        }
    },
    {
        "questionId": "q_test_b3_m3",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "medium",
        "stemPreview": "Amy has 6 crayons. Ben has 2 crayons. How many crayons do they have in all?",
        "optionsPreview": "A) 7  B) 8  C) 9  D) 62",
        "questionData": {
            "stem": "Amy has 6 crayons. Ben has 2 crayons. How many crayons do they have in all?",
            "options": ["7", "8", "9", "62"],
            "correct_answer": "8",
            "acceptable_answers": ["8", "eight", "8 crayons"],
            "solution": "6 crayons + 2 crayons = 8 crayons in all.",
            "hints": ["'In all' means add everything", "6 + 2 = ?"]
        }
    },
    # Hard (3 questions)
    {
        "questionId": "q_test_b3_h1",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "hard",
        "stemPreview": "There are 7 red balloons and 2 blue balloons at the party. How many balloons are there in total?",
        "optionsPreview": "A) 8  B) 9  C) 10  D) 72",
        "questionData": {
            "stem": "There are 7 red balloons and 2 blue balloons at the party. How many balloons are there in total?",
            "options": ["8", "9", "10", "72"],
            "correct_answer": "9",
            "acceptable_answers": ["9", "nine", "9 balloons"],
            "solution": "7 red balloons + 2 blue balloons = 9 balloons total.",
            "hints": ["'Total' means add all together", "7 + 2 = ?"]
        }
    },
    {
        "questionId": "q_test_b3_h2",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "hard",
        "stemPreview": "Jack picks 5 flowers. Then he picks 4 more flowers. How many flowers did Jack pick altogether?",
        "optionsPreview": "A) 8  B) 9  C) 10  D) 54",
        "questionData": {
            "stem": "Jack picks 5 flowers. Then he picks 4 more flowers. How many flowers did Jack pick altogether?",
            "options": ["8", "9", "10", "54"],
            "correct_answer": "9",
            "acceptable_answers": ["9", "nine", "9 flowers"],
            "solution": "5 flowers + 4 flowers = 9 flowers altogether.",
            "hints": ["Jack picks flowers twice", "Add both amounts"]
        }
    },
    {
        "questionId": "q_test_b3_h3",
        "blockId": "block_test_003",
        "blockTitle": "Addition Word Problems",
        "difficulty": "hard",
        "stemPreview": "There are 6 children playing. 3 more children join them. How many children are playing now?",
        "optionsPreview": "A) 8  B) 9  C) 10  D) 63",
        "questionData": {
            "stem": "There are 6 children playing. 3 more children join them. How many children are playing now?",
            "options": ["8", "9", "10", "63"],
            "correct_answer": "9",
            "acceptable_answers": ["9", "nine", "9 children"],
            "solution": "6 children + 3 children = 9 children playing now.",
            "hints": ["More children join", "That means add"]
        }
    }
]


# ========================================
# UTILITY FUNCTIONS
# ========================================

def generate_file_id(content: str) -> str:
    """Generate deterministic file ID from content (max 36 chars for Appwrite)."""
    return hashlib.md5(content.encode()).hexdigest()[:32]


def generate_content_hash(block_id: str, difficulty: str, stem: str, answer: str) -> str:
    """Generate content hash for deduplication."""
    content = f"{block_id}|{difficulty}|{stem}|{answer}"
    return hashlib.sha256(content.encode()).hexdigest()


def upload_json_to_storage(storage: Storage, data: dict, file_id: str) -> None:
    """Upload JSON data to practice_content bucket."""
    json_bytes = json.dumps(data, indent=2).encode('utf-8')

    # Create a BytesIO object for the file
    file_stream = io.BytesIO(json_bytes)

    try:
        # Try to delete existing file first (idempotent)
        try:
            storage.delete_file(PRACTICE_CONTENT_BUCKET, file_id)
            print(f"    Deleted existing file: {file_id}")
        except Exception:
            pass  # File doesn't exist, that's fine

        # Create the file
        input_file = InputFile.from_bytes(json_bytes, f"{file_id}.json")
        storage.create_file(PRACTICE_CONTENT_BUCKET, file_id, input_file)
        print(f"    Uploaded file: {file_id}")

    except Exception as e:
        raise RuntimeError(f"Failed to upload file {file_id}: {e}")


def create_blocks(databases: Databases, storage: Storage) -> None:
    """Create practice blocks with storage files."""
    print(f"\nCreating {len(BLOCKS)} blocks...")

    for block in BLOCKS:
        print(f"  Processing block: {block['blockId']} - {block['title']}")

        # 1. Upload block data to storage
        file_id = generate_file_id(f"block:{LESSON_TEMPLATE_ID}:{block['blockId']}")
        upload_json_to_storage(storage, block["blockData"], file_id)

        # 2. Create block document
        content_hash = hashlib.sha256(json.dumps(block["blockData"]).encode()).hexdigest()

        doc_data = {
            "lessonTemplateId": LESSON_TEMPLATE_ID,
            "blockId": block["blockId"],
            "blockIndex": block["blockIndex"],
            "title": block["title"],
            "explanationPreview": block["explanationPreview"],
            "blockDataFileId": file_id,
            "outcomeRefs": "[]",
            "contentHash": content_hash,
            "generatorVersion": GENERATOR_VERSION,
            "executionId": EXECUTION_ID,
            "generatedAt": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000+00:00')
        }

        doc_id = generate_file_id(f"doc:block:{LESSON_TEMPLATE_ID}:{block['blockId']}")

        try:
            # Try to delete existing document first (idempotent)
            try:
                databases.delete_document(DATABASE_ID, PRACTICE_BLOCKS_COLLECTION, doc_id)
                print(f"    Deleted existing document: {doc_id}")
            except Exception:
                pass  # Document doesn't exist, that's fine

            databases.create_document(DATABASE_ID, PRACTICE_BLOCKS_COLLECTION, doc_id, doc_data)
            print(f"    Created document: {doc_id}")

        except Exception as e:
            raise RuntimeError(f"Failed to create block document {doc_id}: {e}")


def create_questions(databases: Databases, storage: Storage) -> None:
    """Create practice questions with storage files."""
    print(f"\nCreating {len(QUESTIONS)} questions...")

    for q in QUESTIONS:
        print(f"  Processing question: {q['questionId']} ({q['difficulty']})")

        # 1. Upload question data to storage
        file_id = generate_file_id(f"question:{LESSON_TEMPLATE_ID}:{q['questionId']}")
        upload_json_to_storage(storage, q["questionData"], file_id)

        # 2. Create question document
        content_hash = generate_content_hash(
            q["blockId"], q["difficulty"],
            q["questionData"]["stem"], q["questionData"]["correct_answer"]
        )

        doc_data = {
            "lessonTemplateId": LESSON_TEMPLATE_ID,
            "blockId": q["blockId"],
            "blockTitle": q["blockTitle"],
            "difficulty": q["difficulty"],
            "questionType": "multiple_choice",
            "contentHash": content_hash,
            "questionDataFileId": file_id,
            "diagramRequired": False,
            "generatorVersion": GENERATOR_VERSION,
            "generatedAt": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000+00:00'),
            "stemPreview": q["stemPreview"],
            "optionsPreview": q["optionsPreview"],
            "executionId": EXECUTION_ID,
            "status": "published"
        }

        doc_id = generate_file_id(f"doc:question:{LESSON_TEMPLATE_ID}:{q['questionId']}")

        try:
            # Try to delete existing document first (idempotent)
            try:
                databases.delete_document(DATABASE_ID, PRACTICE_QUESTIONS_COLLECTION, doc_id)
                print(f"    Deleted existing document: {doc_id}")
            except Exception:
                pass  # Document doesn't exist, that's fine

            databases.create_document(DATABASE_ID, PRACTICE_QUESTIONS_COLLECTION, doc_id, doc_data)
            print(f"    Created document: {doc_id}")

        except Exception as e:
            raise RuntimeError(f"Failed to create question document {doc_id}: {e}")


def main() -> None:
    """Main entry point."""
    print("=" * 60)
    print("Seed Test Practice Questions")
    print("=" * 60)

    # Get environment variables
    endpoint = os.environ.get("NEXT_PUBLIC_APPWRITE_ENDPOINT")
    project_id = os.environ.get("NEXT_PUBLIC_APPWRITE_PROJECT_ID")
    api_key = os.environ.get("APPWRITE_API_KEY")

    if not all([endpoint, project_id, api_key]):
        raise ValueError(
            "Missing environment variables. Ensure .env.local contains:\n"
            "  - NEXT_PUBLIC_APPWRITE_ENDPOINT\n"
            "  - NEXT_PUBLIC_APPWRITE_PROJECT_ID\n"
            "  - APPWRITE_API_KEY"
        )

    print(f"\nConfiguration:")
    print(f"  Endpoint: {endpoint}")
    print(f"  Project: {project_id}")
    print(f"  Database: {DATABASE_ID}")
    print(f"  Lesson Template: {LESSON_TEMPLATE_ID}")
    print(f"  Execution ID: {EXECUTION_ID}")

    # Initialize Appwrite client
    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    databases = Databases(client)
    storage = Storage(client)

    # Create blocks and questions
    create_blocks(databases, storage)
    create_questions(databases, storage)

    # Summary
    print("\n" + "=" * 60)
    print("Done! Test data created successfully.")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  - Blocks created: {len(BLOCKS)}")
    print(f"  - Questions created: {len(QUESTIONS)}")
    print(f"  - Storage files created: {len(BLOCKS) + len(QUESTIONS)}")
    print(f"\nTest the practice wizard at:")
    print(f"  http://localhost:3000/practice_wizard/{LESSON_TEMPLATE_ID}")


if __name__ == "__main__":
    main()
