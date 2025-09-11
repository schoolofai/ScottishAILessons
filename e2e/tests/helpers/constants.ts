/**
 * Constants and configuration for Scottish AI Lessons E2E tests
 * Based on comprehensive testing documented in playwright-e2e-test-log.md
 */

// Test user credentials (pre-configured in system)
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@scottishailessons.com',
  password: process.env.TEST_USER_PASSWORD || 'red12345'
} as const;

// Lesson configuration
export const LESSON_CONFIG = {
  subject: process.env.LESSON_SUBJECT || 'National 3',
  topic: process.env.LESSON_TOPIC || 'Applications of Mathematics',
  name: process.env.LESSON_NAME || 'Fractions ↔ Decimals ↔ Percentages in Money'
} as const;

// Session IDs for testing
export const TEST_SESSIONS = {
  completed: process.env.COMPLETED_SESSION_ID || '68baa782001b883a1113',
  // Fresh sessions are created dynamically during tests
} as const;

// UI Selectors (based on actual testing)
export const SELECTORS = {
  // Authentication
  loginLink: 'role=link[name="Login"]',
  emailInput: 'role=textbox[name="Email"]',
  passwordInput: 'role=textbox[name="Password"]',
  loginButton: 'role=button[name="Login"]',
  
  // Navigation
  dashboardLink: 'role=link[name="Dashboard"]',
  startLessonButton: 'role=button[name="Start Lesson"]',
  
  // Chat interface
  messageInput: '[placeholder="Send a message..."]',
  sendButton: 'role=button[name="Send message"]',
  
  // Lesson navigation
  previousButton: 'role=button[name="Previous"]',
  nextButton: 'role=button[name="Next"]',
  
  // General content
  breadcrumbs: 'main > div > div:first-child',
  chatMessages: 'main div[role="main"] > div > div',
} as const;

// AI Response Patterns (extracted from test log)
export const AI_PATTERNS = {
  // Success feedback patterns
  success: [
    /Great job!/i,
    /correctly/i,
    /excellent work/i,
    /well done/i,
    /fantastic/i,
    /perfect/i
  ],
  
  // Error handling patterns
  error: [
    /Thank you for your attempt/i,
    /looks like.*mix-up/i,
    /Here's a helpful hint/i,
    /try again/i,
    /off track/i,
    /different/i
  ],
  
  // Completion patterns
  completion: [
    /Congratulations.*completing.*cards/i,
    /fantastic achievement/i,
    /completed all.*cards/i,
    /great work/i
  ],
  
  // Post-completion summary patterns
  summary: [
    /Performance Analysis/i,
    /accuracy.*%/i,
    /Areas for Improvement/i,
    /Recommendations/i,
    /Retry Recommendation/i,
    /Learning Patterns/i
  ]
} as const;

// Test answers based on documented lesson flow
export const TEST_ANSWERS = {
  // Correct answers for happy path
  correct: [
    '1/5',        // Fraction conversion: 0.2 → 1/5
    '£16.20',     // Discount calculation: £18.00 with 10% off
    '2'           // Unit price comparison: 1kg £2.80 is cheaper
  ],
  
  // Wrong answers for error handling testing
  wrong: [
    '£16.20',     // Wrong format for fraction question
    'Hello! Can you tell me about fractions?', // Off-topic response
    '500g for £1.50', // Wrong choice for comparison question
    'I need help'     // Help request
  ],
  
  // Post-completion queries
  postCompletion: [
    'Can I learn more about this topic?',
    'What\'s next?',
    'How did I do?',
    'Can you give me a summary?'
  ]
} as const;

// Timing configuration (in milliseconds)
export const TIMEOUTS = {
  aiResponse: parseInt(process.env.AI_RESPONSE_TIMEOUT || '15000'),
  streamingDelay: parseInt(process.env.AI_STREAMING_DELAY || '2000'),
  pageLoad: parseInt(process.env.PAGE_LOAD_TIMEOUT || '30000'),
  shortWait: 1000,
  mediumWait: 3000,
  longWait: 5000
} as const;

// Expected lesson structure
export const LESSON_STRUCTURE = {
  totalCards: 3,
  cardTitles: [
    'Equivalences Warm-up',
    '10% Discount', 
    'Best Deal Comparison'
  ],
  questionTypes: [
    'fraction-conversion',
    'discount-calculation',
    'unit-price-comparison'
  ]
} as const;