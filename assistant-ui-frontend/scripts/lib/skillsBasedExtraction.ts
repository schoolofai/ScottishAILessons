/**
 * Skills-Based Course Extraction Library
 *
 * This module handles extraction of course outcomes from skills-based course structures
 * (National 5 and above) where the SQA data uses a skills_framework instead of
 * traditional unit→outcome hierarchy.
 *
 * Key Features:
 * - Dual-unit creation: Generates both TOPIC_ and SKILL_ documents
 * - Many-to-many support: Handles skills referenced by multiple topics
 * - Cross-cutting skills: Supports skills that apply across all topics (e.g., Reasoning)
 *
 * Architecture:
 * 1. Topic-as-Unit documents: Represent curriculum structure (navigation)
 * 2. Skill-as-Unit documents: Represent atomic competencies (mastery tracking)
 */

export interface SkillFramework {
  knowledge_understanding: string[];
  skills: Skill[];
}

export interface Skill {
  name: string;
  description: string;
  examples: string[];
}

export interface TopicArea {
  title: string;
  content_points: string[];
  skills_assessed: string[];
  marking_guidance: string | null;
}

export interface CourseOutcomeImport {
  courseId: string;
  courseSqaCode: string;
  unitCode: string;
  unitTitle: string;
  scqfCredits: number;
  outcomeId: string;
  outcomeTitle: string;
  assessmentStandards: string; // JSON string
  teacherGuidance: string;
  keywords: string[];
}

/**
 * Normalize a title/name into a valid unit code
 *
 * Examples:
 *   "Working with surds" → "WORKING_WITH_SURDS"
 *   "Algebraic skills" → "ALGEBRAIC_SKILLS"
 *   "Sine & cosine rules" → "SINE_COSINE_RULES"
 *
 * @param title - Human-readable title to normalize
 * @returns Uppercase snake_case unit code
 */
export function normalizeToUnitCode(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^\w\s]/g, '') // Remove non-alphanumeric except spaces
    .replace(/\s+/g, '_')     // Replace spaces with underscores
    .replace(/_+/g, '_')      // Collapse multiple underscores
    .replace(/^_|_$/g, '');   // Trim leading/trailing underscores
}

/**
 * Generate teacher guidance for a topic area document
 *
 * Formats:
 * - Topic overview with skill count
 * - Content points list (if available)
 * - Marking guidance (if available)
 *
 * @param topicArea - Topic area from course structure
 * @returns Markdown-formatted teacher guidance
 */
export function generateTopicGuidance(topicArea: TopicArea): string {
  const skillCount = topicArea.skills_assessed?.length || 0;
  const contentPoints = topicArea.content_points || [];

  let guidance = `**Topic Overview**: ${topicArea.title}\n\n`;
  guidance += `This topic area groups ${skillCount} related skill${skillCount !== 1 ? 's' : ''}.\n\n`;

  if (contentPoints.length > 0) {
    guidance += `**Content Points**:\n`;
    contentPoints.forEach(point => {
      guidance += `- ${point}\n`;
    });
    guidance += `\n`;
  }

  if (topicArea.marking_guidance) {
    guidance += `**Marking Guidance**: ${topicArea.marking_guidance}\n`;
  }

  return guidance.trim();
}

/**
 * Generate teacher guidance for a skill document
 *
 * Formats:
 * - Skill name and description
 * - Parent topics (topics that reference this skill)
 * - Examples (if available)
 *
 * @param skill - Skill from skills framework
 * @param parentTopics - List of topic titles that reference this skill
 * @returns Markdown-formatted teacher guidance
 */
export function generateSkillGuidance(skill: Skill, parentTopics: string[]): string {
  let guidance = `**${skill.name}**\n\n`;
  guidance += `${skill.description}\n\n`;

  if (parentTopics.length > 0) {
    guidance += `**Parent Topics**: ${parentTopics.join(', ')}\n\n`;
  }

  if (skill.examples && skill.examples.length > 0) {
    guidance += `**Examples**:\n`;
    skill.examples.forEach(example => {
      guidance += `- ${example}\n`;
    });
  }

  return guidance.trim();
}

/**
 * Find which topic areas reference a given skill
 *
 * Handles many-to-many relationships where:
 * - Most skills belong to one topic
 * - Cross-cutting skills (e.g., Reasoning) belong to multiple topics
 *
 * @param skillName - Name of the skill to search for
 * @param topicAreas - Array of all topic areas
 * @returns Array of topic titles that reference this skill
 */
export function findParentTopics(skillName: string, topicAreas: TopicArea[]): string[] {
  return topicAreas
    .filter(topic => topic.skills_assessed?.includes(skillName))
    .map(topic => topic.title);
}

/**
 * Extract keywords from skill name and description
 *
 * @param skillName - Name of the skill
 * @param description - Description text
 * @returns Array of unique keywords (length > 3 characters)
 */
function extractKeywordsFromSkill(skillName: string, description: string): string[] {
  const keywords = new Set<string>();

  // Extract from skill name
  const nameWords = skillName
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);

  nameWords.forEach(word => keywords.add(word));

  // Extract from description (first 5 significant words)
  const descWords = description
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 4);

  descWords.slice(0, 5).forEach(word => keywords.add(word));

  return Array.from(keywords);
}

/**
 * Extract keywords from topic title
 *
 * @param topicTitle - Title of the topic area
 * @returns Array of unique keywords (length > 3 characters)
 */
function extractKeywordsFromTopic(topicTitle: string): string[] {
  const keywords = new Set<string>();

  const words = topicTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);

  words.forEach(word => keywords.add(word));

  return Array.from(keywords);
}

/**
 * Extract course outcomes from a skills-based course structure
 *
 * This is the main entry point for processing National 5+ courses that use
 * the skills_framework structure instead of traditional units.
 *
 * Creates two types of documents:
 * 1. TOPIC_ documents: One per topic area (for navigation/grouping)
 * 2. SKILL_ documents: One per skill (for granular mastery tracking)
 *
 * Example Output:
 * For National 5 Mathematics (6 topics + 41 skills):
 * - 6 TOPIC_ documents (TOPIC_NUMERICAL_SKILLS, TOPIC_ALGEBRAIC_SKILLS, etc.)
 * - 41 SKILL_ documents (SKILL_WORKING_WITH_SURDS, SKILL_ROUNDING, etc.)
 *
 * @param courseId - Internal course ID (e.g., "course_c84775")
 * @param courseSqaCode - Official SQA course code (e.g., "C847 75")
 * @param skillsFramework - Skills framework from course_structure
 * @param topicAreas - Topic areas from course_structure
 * @returns Array of course outcome import objects
 * @throws Error if skills_framework is invalid or missing required fields
 */
export function extractOutcomesFromSkillsBased(
  courseId: string,
  courseSqaCode: string,
  skillsFramework: SkillFramework,
  topicAreas: TopicArea[]
): CourseOutcomeImport[] {

  // Validation
  if (!skillsFramework || !skillsFramework.skills) {
    throw new Error('Invalid skills_framework: missing skills array');
  }

  if (!topicAreas || topicAreas.length === 0) {
    throw new Error('No topic_areas found in course structure');
  }

  const outcomes: CourseOutcomeImport[] = [];

  // ═══════════════════════════════════════════════════════════════
  // PART 1: Create Topic-as-Unit documents (navigation/grouping)
  // ═══════════════════════════════════════════════════════════════

  console.log(`   📦 Processing ${topicAreas.length} topic areas...`);

  for (const topicArea of topicAreas) {
    const topicUnitCode = `TOPIC_${normalizeToUnitCode(topicArea.title)}`;
    const skillsList = topicArea.skills_assessed || [];

    // Create assessment standard that lists all skills in this topic
    const topicOverviewDesc = skillsList.length > 0
      ? `This topic covers: ${skillsList.join(', ')}`
      : 'This topic area contains no specific skills.';

    const topicOutcome: CourseOutcomeImport = {
      courseId,
      courseSqaCode,
      unitCode: topicUnitCode,
      unitTitle: topicArea.title,
      scqfCredits: 0, // Topic areas don't have SCQF credits
      outcomeId: topicUnitCode, // Same as unitCode for topic documents
      outcomeTitle: topicArea.title,
      assessmentStandards: JSON.stringify([{
        code: 'TOPIC_OVERVIEW',
        desc: topicOverviewDesc,
        skills_list: skillsList,
        marking_guidance: topicArea.marking_guidance || ''
      }]),
      teacherGuidance: generateTopicGuidance(topicArea),
      keywords: extractKeywordsFromTopic(topicArea.title)
    };

    outcomes.push(topicOutcome);
    console.log(`      ✅ Topic: ${topicArea.title} (${skillsList.length} skills)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // PART 2: Create Skill-as-Unit documents (granular tracking)
  // ═══════════════════════════════════════════════════════════════

  console.log(`   📦 Processing ${skillsFramework.skills.length} skills...`);

  for (const skill of skillsFramework.skills) {
    const skillUnitCode = `SKILL_${normalizeToUnitCode(skill.name)}`;

    // Find which topic areas reference this skill (many-to-many)
    const parentTopics = findParentTopics(skill.name, topicAreas);

    // Create assessment standard from skill description
    const skillOutcome: CourseOutcomeImport = {
      courseId,
      courseSqaCode,
      unitCode: skillUnitCode,
      unitTitle: skill.name,
      scqfCredits: 0, // Skills don't have individual SCQF credits
      outcomeId: skillUnitCode, // Same as unitCode for skill documents
      outcomeTitle: skill.name,
      assessmentStandards: JSON.stringify([{
        code: 'AS1',
        desc: skill.description,
        skills_list: [],
        marking_guidance: ''
      }]),
      teacherGuidance: generateSkillGuidance(skill, parentTopics),
      keywords: extractKeywordsFromSkill(skill.name, skill.description)
    };

    outcomes.push(skillOutcome);

    // Log with parent topic info
    if (parentTopics.length > 0) {
      console.log(`      ✅ Skill: ${skill.name} (${parentTopics.length} parent${parentTopics.length !== 1 ? 's' : ''})`);
    } else {
      console.log(`      ⚠️  Skill: ${skill.name} (NO PARENT TOPICS)`);
    }
  }

  console.log(`   📊 Generated ${outcomes.length} course outcomes (${topicAreas.length} topics + ${skillsFramework.skills.length} skills)`);

  return outcomes;
}

/**
 * Validate skills-based course structure
 *
 * Checks:
 * - All skills referenced in topic_areas exist in skills_framework
 * - No orphaned skills (skills with no parent topics) - WARNING only
 * - No duplicate skill names
 *
 * @param skillsFramework - Skills framework to validate
 * @param topicAreas - Topic areas to validate
 * @returns Validation result with errors and warnings
 */
export function validateSkillsBasedStructure(
  skillsFramework: SkillFramework,
  topicAreas: TopicArea[]
): { isValid: boolean; errors: string[]; warnings: string[] } {

  const errors: string[] = [];
  const warnings: string[] = [];

  // Build index of skill names
  const skillNames = new Set(skillsFramework.skills.map(s => s.name));

  // Check for duplicate skill names
  const duplicateSkills = skillsFramework.skills
    .map(s => s.name)
    .filter((name, index, arr) => arr.indexOf(name) !== index);

  if (duplicateSkills.length > 0) {
    errors.push(`Duplicate skill names found: ${duplicateSkills.join(', ')}`);
  }

  // Check that all skills referenced in topic_areas exist
  for (const topicArea of topicAreas) {
    for (const skillName of topicArea.skills_assessed || []) {
      if (!skillNames.has(skillName)) {
        errors.push(`Topic "${topicArea.title}" references non-existent skill: "${skillName}"`);
      }
    }
  }

  // Warn about orphaned skills (skills not referenced by any topic)
  const referencedSkills = new Set<string>();
  topicAreas.forEach(topic => {
    (topic.skills_assessed || []).forEach(skill => referencedSkills.add(skill));
  });

  for (const skill of skillsFramework.skills) {
    if (!referencedSkills.has(skill.name)) {
      warnings.push(`Skill "${skill.name}" is not referenced by any topic area`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
