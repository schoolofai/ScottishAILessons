"""Practice Question Upserter - Persists generated questions and blocks to Appwrite.

Handles:
1. Uploading large content (question data, block data) to storage bucket
2. Creating/updating documents in practice_questions and practice_blocks collections
3. Content hash-based deduplication to avoid duplicate uploads

Uses the pattern from lesson_upserter.py and storage_uploader.py.
"""

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from io import BytesIO

from appwrite.exception import AppwriteException

from ..models.practice_question_models import (
    ExtractedBlock,
    GeneratedQuestion,
    ConceptBlockContent,
    QuestionContent
)

logger = logging.getLogger(__name__)

# Storage bucket for practice content
PRACTICE_CONTENT_BUCKET_ID = "practice_content"

# Collections
PRACTICE_QUESTIONS_COLLECTION = "practice_questions"
PRACTICE_BLOCKS_COLLECTION = "practice_blocks"


def _get_appwrite_client(mcp_config_path: str):
    """Initialize Appwrite client from MCP config.

    Args:
        mcp_config_path: Path to .mcp.json

    Returns:
        Tuple of (client, project_id)

    Raises:
        ValueError: If credentials missing
    """
    from appwrite.client import Client

    config_path = Path(mcp_config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

    with open(config_path) as f:
        mcp_config = json.load(f)

    appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
    args = appwrite_config.get("args", [])

    endpoint = None
    api_key = None
    project_id = None

    for arg in args:
        if arg.startswith("APPWRITE_ENDPOINT="):
            endpoint = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_API_KEY="):
            api_key = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_PROJECT_ID="):
            project_id = arg.split("=", 1)[1]

    if not all([endpoint, api_key, project_id]):
        raise ValueError("Missing Appwrite credentials in MCP config")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    return client, project_id


def _generate_doc_id(content: str, max_length: int = 36) -> str:
    """Generate deterministic document ID from content.

    Args:
        content: Content to hash
        max_length: Maximum ID length (Appwrite limit is 36)

    Returns:
        MD5 hash truncated to max_length
    """
    return hashlib.md5(content.encode()).hexdigest()[:max_length]


class PracticeQuestionUpserter:
    """Upserts practice questions and blocks to Appwrite.

    Handles:
    - Storage bucket uploads for large content
    - Document creation/updates with deduplication
    - Error handling with fail-fast pattern
    """

    def __init__(self, mcp_config_path: str = ".mcp.json"):
        """Initialize upserter.

        Args:
            mcp_config_path: Path to MCP config file
        """
        self.mcp_config_path = mcp_config_path
        self._client = None
        self._databases = None
        self._storage = None
        self.database_id = "default"

    def _init_client(self):
        """Lazily initialize Appwrite client."""
        if self._client is None:
            from appwrite.services.databases import Databases
            from appwrite.services.storage import Storage

            self._client, _ = _get_appwrite_client(self.mcp_config_path)
            self._databases = Databases(self._client)
            self._storage = Storage(self._client)

    async def _upload_to_storage(
        self,
        content: Dict[str, Any],
        file_id: str,
        bucket_id: str = PRACTICE_CONTENT_BUCKET_ID
    ) -> str:
        """Upload JSON content to storage bucket.

        Args:
            content: Dict to serialize as JSON
            file_id: Deterministic file ID
            bucket_id: Storage bucket ID

        Returns:
            File ID of uploaded content

        Raises:
            RuntimeError: If upload fails
        """
        self._init_client()
        from appwrite.input_file import InputFile

        # Serialize content to JSON
        content_json = json.dumps(content, indent=2)
        content_bytes = content_json.encode('utf-8')

        # Create InputFile from bytes
        input_file = InputFile.from_bytes(
            content_bytes,
            filename=f"{file_id}.json",
            mime_type="application/json"
        )

        try:
            # Try to create new file
            result = self._storage.create_file(
                bucket_id=bucket_id,
                file_id=file_id,
                file=input_file
            )
            logger.debug(f"Uploaded new file: {file_id}")
            return result['$id']

        except Exception as e:
            if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                # File already exists - this is fine (idempotent)
                logger.debug(f"File already exists: {file_id}")
                return file_id
            else:
                raise RuntimeError(f"Storage upload failed: {e}")

    async def _get_existing_document(
        self,
        collection_id: str,
        document_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get existing document if it exists.

        Args:
            collection_id: Collection ID
            document_id: Document ID

        Returns:
            Document data or None if not found
        """
        self._init_client()

        try:
            return self._databases.get_document(
                database_id=self.database_id,
                collection_id=collection_id,
                document_id=document_id
            )
        except AppwriteException as e:
            # 404 means document doesn't exist yet - return None for upsert logic
            if e.code == 404:
                return None
            raise
        except Exception as e:
            # Fallback for other exception types
            if 'not found' in str(e).lower() or '404' in str(e):
                return None
            raise

    async def upsert_blocks(
        self,
        lesson_template_id: str,
        blocks: List[ExtractedBlock],
        execution_id: str
    ) -> List[str]:
        """Upsert extracted blocks to practice_blocks collection.

        Uses content_hash for deduplication - skips if hash matches.

        Args:
            lesson_template_id: Source lesson template ID
            blocks: List of extracted concept blocks
            execution_id: Execution ID for tracking

        Returns:
            List of document IDs created/updated
        """
        self._init_client()
        logger.info(f"Upserting {len(blocks)} blocks for {lesson_template_id}")

        doc_ids = []

        for idx, block in enumerate(blocks):
            # Generate deterministic document ID
            doc_id_content = f"{lesson_template_id}:{block.block_id}"
            doc_id = _generate_doc_id(doc_id_content)

            # Compute content hash
            content_hash = block.compute_content_hash()

            # Check if block already exists with same hash
            existing = await self._get_existing_document(
                PRACTICE_BLOCKS_COLLECTION, doc_id
            )

            if existing and existing.get("contentHash") == content_hash:
                logger.debug(f"Block {block.block_id} unchanged, skipping")
                doc_ids.append(doc_id)
                continue

            # Upload large content to storage
            storage_content = block.get_storage_content()
            file_id_content = f"block:{lesson_template_id}:{block.block_id}"
            file_id = _generate_doc_id(file_id_content)

            await self._upload_to_storage(
                storage_content.model_dump(),
                file_id
            )

            # Build document data
            doc_data = {
                "lessonTemplateId": lesson_template_id,
                "blockId": block.block_id,
                "blockIndex": idx,
                "title": block.title,
                "explanationPreview": block.explanation_preview,
                "blockDataFileId": file_id,
                "outcomeRefs": json.dumps(block.outcome_refs),
                "contentHash": content_hash,
                "generatorVersion": "1.0.0",
                "executionId": execution_id,
                "generatedAt": datetime.utcnow().isoformat()
            }

            # Create or update document
            try:
                if existing:
                    self._databases.update_document(
                        database_id=self.database_id,
                        collection_id=PRACTICE_BLOCKS_COLLECTION,
                        document_id=doc_id,
                        data=doc_data
                    )
                    logger.debug(f"Updated block: {doc_id}")
                else:
                    self._databases.create_document(
                        database_id=self.database_id,
                        collection_id=PRACTICE_BLOCKS_COLLECTION,
                        document_id=doc_id,
                        data=doc_data
                    )
                    logger.debug(f"Created block: {doc_id}")

                doc_ids.append(doc_id)

            except Exception as e:
                raise RuntimeError(f"Failed to upsert block {block.block_id}: {e}")

        logger.info(f"✅ Upserted {len(doc_ids)} blocks")
        return doc_ids

    async def upsert_questions(
        self,
        lesson_template_id: str,
        questions: List[GeneratedQuestion],
        execution_id: str
    ) -> List[str]:
        """Upsert generated questions to practice_questions collection.

        Args:
            lesson_template_id: Source lesson template ID
            questions: List of generated questions
            execution_id: Execution ID for tracking

        Returns:
            List of document IDs created/updated
        """
        self._init_client()
        logger.info(f"Upserting {len(questions)} questions for {lesson_template_id}")

        doc_ids = []

        for question in questions:
            # Generate deterministic document ID
            content_hash = question.compute_content_hash()
            doc_id_content = f"{lesson_template_id}:{question.block_id}:{question.difficulty}:{content_hash[:16]}"
            doc_id = _generate_doc_id(doc_id_content)

            # Check if question already exists
            existing = await self._get_existing_document(
                PRACTICE_QUESTIONS_COLLECTION, doc_id
            )

            if existing and existing.get("contentHash") == content_hash:
                logger.debug(f"Question {question.question_id} unchanged, skipping")
                doc_ids.append(doc_id)
                continue

            # Upload large content to storage
            storage_content = question.get_storage_content()
            file_id_content = f"question:{lesson_template_id}:{question.question_id}"
            file_id = _generate_doc_id(file_id_content)

            await self._upload_to_storage(
                storage_content.model_dump(),
                file_id
            )

            # Build document data
            doc_data = {
                "lessonTemplateId": lesson_template_id,
                "blockId": question.block_id,
                "blockTitle": question.block_title,
                "difficulty": question.difficulty,
                "questionType": question.question_type,
                "stemPreview": question.stem_preview,
                "optionsPreview": question.options_preview,
                "questionDataFileId": file_id,
                "contentHash": content_hash,
                "diagramRequired": question.diagram_needed,
                "diagramFileId": question.diagram_file_id,
                "diagramTool": question.diagram_tool,
                "generatorVersion": "1.0.0",
                "executionId": execution_id,
                "generatedAt": datetime.utcnow().isoformat(),
                "status": "published"
            }

            # Create or update document
            try:
                if existing:
                    self._databases.update_document(
                        database_id=self.database_id,
                        collection_id=PRACTICE_QUESTIONS_COLLECTION,
                        document_id=doc_id,
                        data=doc_data
                    )
                    logger.debug(f"Updated question: {doc_id}")
                else:
                    self._databases.create_document(
                        database_id=self.database_id,
                        collection_id=PRACTICE_QUESTIONS_COLLECTION,
                        document_id=doc_id,
                        data=doc_data
                    )
                    logger.debug(f"Created question: {doc_id}")

                doc_ids.append(doc_id)

            except Exception as e:
                raise RuntimeError(
                    f"Failed to upsert question {question.question_id}: {e}"
                )

        logger.info(f"✅ Upserted {len(doc_ids)} questions")
        return doc_ids

    async def check_content_exists(
        self,
        lesson_template_id: str
    ) -> Tuple[bool, int, int, bool]:
        """Check if blocks, questions, and diagrams exist for a lesson template.

        Args:
            lesson_template_id: Lesson template document ID

        Returns:
            Tuple of (content_exists: bool, block_count: int, question_count: int, diagrams_exist: bool)
        """
        self._init_client()
        from appwrite.query import Query

        # Query practice_blocks for this lesson
        blocks_result = self._databases.list_documents(
            database_id=self.database_id,
            collection_id=PRACTICE_BLOCKS_COLLECTION,
            queries=[Query.equal("lessonTemplateId", lesson_template_id)]
        )
        block_count = blocks_result.get("total", 0)

        # Query practice_questions for this lesson
        questions_result = self._databases.list_documents(
            database_id=self.database_id,
            collection_id=PRACTICE_QUESTIONS_COLLECTION,
            queries=[
                Query.equal("lessonTemplateId", lesson_template_id),
                Query.limit(100)  # Need documents to check diagram fields
            ]
        )
        question_count = questions_result.get("total", 0)

        # Check if any questions have diagrams (diagramFileId is set)
        diagrams_exist = False
        for doc in questions_result.get("documents", []):
            if doc.get("diagramFileId"):
                diagrams_exist = True
                break

        content_exists = block_count > 0 and question_count > 0
        logger.info(
            f"Content check for {lesson_template_id}: "
            f"content_exists={content_exists}, blocks={block_count}, "
            f"questions={question_count}, diagrams_exist={diagrams_exist}"
        )
        return (content_exists, block_count, question_count, diagrams_exist)

    async def delete_lesson_content(
        self,
        lesson_template_id: str
    ) -> Dict[str, int]:
        """Delete ALL blocks, questions, and storage files for a lesson.

        Args:
            lesson_template_id: Lesson template document ID

        Returns:
            Dict with counts of deleted items
        """
        self._init_client()
        from appwrite.query import Query

        deleted = {"blocks": 0, "questions": 0, "storage_files": 0}

        # 1. Get all questions and delete them + their storage files
        questions_result = self._databases.list_documents(
            database_id=self.database_id,
            collection_id=PRACTICE_QUESTIONS_COLLECTION,
            queries=[
                Query.equal("lessonTemplateId", lesson_template_id),
                Query.limit(100)
            ]
        )

        for q in questions_result.get("documents", []):
            # Delete question data file from storage
            if q.get("questionDataFileId"):
                try:
                    self._storage.delete_file(
                        bucket_id=PRACTICE_CONTENT_BUCKET_ID,
                        file_id=q["questionDataFileId"]
                    )
                    deleted["storage_files"] += 1
                except Exception as e:
                    logger.debug(f"Storage file not found or already deleted: {e}")

            # Delete diagram file if exists
            if q.get("diagramFileId"):
                try:
                    self._storage.delete_file(
                        bucket_id=PRACTICE_CONTENT_BUCKET_ID,
                        file_id=q["diagramFileId"]
                    )
                    deleted["storage_files"] += 1
                except Exception as e:
                    logger.debug(f"Diagram file not found or already deleted: {e}")

            # Delete question document
            try:
                self._databases.delete_document(
                    database_id=self.database_id,
                    collection_id=PRACTICE_QUESTIONS_COLLECTION,
                    document_id=q["$id"]
                )
                deleted["questions"] += 1
            except Exception as e:
                logger.error(f"Failed to delete question {q['$id']}: {e}")
                raise RuntimeError(f"Failed to delete question: {e}")

        # 2. Get all blocks and delete them + their storage files
        blocks_result = self._databases.list_documents(
            database_id=self.database_id,
            collection_id=PRACTICE_BLOCKS_COLLECTION,
            queries=[
                Query.equal("lessonTemplateId", lesson_template_id),
                Query.limit(100)
            ]
        )

        for b in blocks_result.get("documents", []):
            # Delete block data file from storage
            if b.get("blockDataFileId"):
                try:
                    self._storage.delete_file(
                        bucket_id=PRACTICE_CONTENT_BUCKET_ID,
                        file_id=b["blockDataFileId"]
                    )
                    deleted["storage_files"] += 1
                except Exception as e:
                    logger.debug(f"Block storage file not found or already deleted: {e}")

            # Delete block document
            try:
                self._databases.delete_document(
                    database_id=self.database_id,
                    collection_id=PRACTICE_BLOCKS_COLLECTION,
                    document_id=b["$id"]
                )
                deleted["blocks"] += 1
            except Exception as e:
                logger.error(f"Failed to delete block {b['$id']}: {e}")
                raise RuntimeError(f"Failed to delete block: {e}")

        logger.info(
            f"🗑️ Deleted: {deleted['blocks']} blocks, "
            f"{deleted['questions']} questions, {deleted['storage_files']} files"
        )
        return deleted

    async def load_existing_questions(
        self,
        lesson_template_id: str
    ) -> List[GeneratedQuestion]:
        """Load existing questions from Appwrite and convert to GeneratedQuestion objects.

        Args:
            lesson_template_id: Lesson template document ID

        Returns:
            List of GeneratedQuestion objects
        """
        self._init_client()
        from appwrite.query import Query

        questions = []

        # Fetch all questions for this lesson
        result = self._databases.list_documents(
            database_id=self.database_id,
            collection_id=PRACTICE_QUESTIONS_COLLECTION,
            queries=[
                Query.equal("lessonTemplateId", lesson_template_id),
                Query.limit(100)
            ]
        )

        for doc in result.get("documents", []):
            # Load full question data from storage
            question_data = {}
            if doc.get("questionDataFileId"):
                try:
                    file_content = self._storage.get_file_download(
                        bucket_id=PRACTICE_CONTENT_BUCKET_ID,
                        file_id=doc["questionDataFileId"]
                    )
                    # Handle both bytes and dict responses from Appwrite SDK
                    if isinstance(file_content, bytes):
                        question_data = json.loads(file_content.decode("utf-8"))
                    elif isinstance(file_content, dict):
                        question_data = file_content
                    else:
                        question_data = json.loads(str(file_content))
                except Exception as e:
                    logger.warning(f"Could not load question data file: {e}")

            # Parse outcomeRefs if it's a JSON string
            outcome_refs = doc.get("outcomeRefs", [])
            if isinstance(outcome_refs, str):
                try:
                    outcome_refs = json.loads(outcome_refs)
                except json.JSONDecodeError:
                    outcome_refs = []

            # Parse options from storage data
            options = question_data.get("options")
            if options and isinstance(options, list):
                from ..models.practice_question_models import MultipleChoiceOption
                options = [
                    MultipleChoiceOption(**opt) if isinstance(opt, dict) else opt
                    for opt in options
                ]

            # Reconstruct GeneratedQuestion
            q = GeneratedQuestion(
                question_id=doc.get("$id"),
                block_id=doc.get("blockId"),
                block_title=doc.get("blockTitle", ""),
                difficulty=doc.get("difficulty"),
                question_type=doc.get("questionType"),
                stem_preview=doc.get("stemPreview", ""),
                options_preview=doc.get("optionsPreview"),
                stem=question_data.get("stem", doc.get("stemPreview", "")),
                options=options,
                correct_answer=question_data.get("correct_answer", ""),
                acceptable_answers=question_data.get("acceptable_answers"),
                solution=question_data.get("solution", ""),
                hints=question_data.get("hints", []),
                diagram_needed=doc.get("diagramRequired", False),
                diagram_tool=doc.get("diagramTool", "NONE"),
                diagram_file_id=doc.get("diagramFileId"),
                diagram_json=doc.get("diagramJson"),
                outcome_refs=outcome_refs,
                curriculum_topic=doc.get("curriculumTopic")
            )
            questions.append(q)

        logger.info(f"📂 Loaded {len(questions)} existing questions")
        return questions

    async def update_diagram_fields(
        self,
        questions: List[GeneratedQuestion]
    ) -> int:
        """Update ONLY diagram-related fields for existing questions.

        Args:
            questions: Questions with updated diagram fields

        Returns:
            Count of updated documents
        """
        self._init_client()
        updated = 0

        for q in questions:
            # Only update questions that have diagrams
            if not q.diagram_file_id and not q.diagram_needed:
                continue

            try:
                # Note: diagramJson is stored in storage file, not as collection attribute
                self._databases.update_document(
                    database_id=self.database_id,
                    collection_id=PRACTICE_QUESTIONS_COLLECTION,
                    document_id=q.question_id,
                    data={
                        "diagramRequired": q.diagram_needed,
                        "diagramTool": q.diagram_tool,
                        "diagramFileId": q.diagram_file_id
                    }
                )
                updated += 1
                logger.debug(f"Updated diagram for {q.question_id}")
            except Exception as e:
                logger.error(f"Failed to update diagram for {q.question_id}: {e}")
                raise RuntimeError(f"Failed to update diagram fields: {e}")

        logger.info(f"📊 Updated diagram fields for {updated} questions")
        return updated


async def run_practice_content_upsert(
    mcp_config_path: str,
    lesson_template_id: str,
    blocks: List[ExtractedBlock],
    questions: List[GeneratedQuestion],
    execution_id: str
) -> Dict[str, Any]:
    """Convenience function to upsert both blocks and questions.

    Args:
        mcp_config_path: Path to MCP config
        lesson_template_id: Source lesson template ID
        blocks: Extracted concept blocks
        questions: Generated questions
        execution_id: Execution ID

    Returns:
        Dict with counts of created documents
    """
    upserter = PracticeQuestionUpserter(mcp_config_path)

    block_ids = await upserter.upsert_blocks(
        lesson_template_id, blocks, execution_id
    )

    question_ids = await upserter.upsert_questions(
        lesson_template_id, questions, execution_id
    )

    return {
        "blocks_upserted": len(block_ids),
        "questions_upserted": len(question_ids),
        "block_ids": block_ids,
        "question_ids": question_ids
    }
