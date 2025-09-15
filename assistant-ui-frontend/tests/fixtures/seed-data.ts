import type { SchedulingContextForCourse, CourseRecommendation } from '../../types/course-planner';

// Test student profiles
export const testStudents = {
  multiCourseStudent: {
    id: "test-student-123",
    displayName: "Alex McStudent",
    accommodations: ["extra-time", "large-print"]
  },
  singleCourseStudent: {
    id: "test-student-456",
    displayName: "Sam Learner",
    accommodations: []
  }
};

// Test course data
export const testCourses = {
  mathematics: {
    $id: "course-math-123",
    courseId: "C844 73",
    subject: "Applications of Mathematics",
    level: "National 3"
  },
  physics: {
    $id: "course-physics-456",
    courseId: "C845 73",
    subject: "Physics",
    level: "National 3"
  },
  english: {
    $id: "course-english-789",
    courseId: "C846 73",
    subject: "English",
    level: "National 3"
  }
};

// Test lesson templates
export const testLessonTemplates = {
  mathematics: [
    {
      $id: "template-fractions-123",
      title: "Fractions ↔ Decimals ↔ Percents",
      outcomeRefs: ["AOM3.1", "AOM3.2"],
      estMinutes: 45,
      status: "published" as const
    },
    {
      $id: "template-area-456",
      title: "Area and Perimeter",
      outcomeRefs: ["AOM3.3"],
      estMinutes: 30,
      status: "published" as const
    },
    {
      $id: "template-volume-789",
      title: "Volume of 3D Shapes",
      outcomeRefs: ["AOM3.4"],
      estMinutes: 50,
      status: "published" as const
    },
    {
      $id: "template-graphs-012",
      title: "Linear Graphs and Functions",
      outcomeRefs: ["AOM3.5"],
      estMinutes: 35,
      status: "published" as const
    },
    {
      $id: "template-statistics-345",
      title: "Data Analysis and Statistics",
      outcomeRefs: ["AOM3.6"],
      estMinutes: 25,
      status: "published" as const
    }
  ],
  physics: [
    {
      $id: "template-forces-123",
      title: "Forces and Motion",
      outcomeRefs: ["PHY3.1"],
      estMinutes: 50,
      status: "published" as const
    },
    {
      $id: "template-energy-456",
      title: "Energy Transformations",
      outcomeRefs: ["PHY3.2"],
      estMinutes: 40,
      status: "published" as const
    },
    {
      $id: "template-waves-789",
      title: "Sound and Light Waves",
      outcomeRefs: ["PHY3.3"],
      estMinutes: 45,
      status: "published" as const
    }
  ],
  english: [
    {
      $id: "template-writing-123",
      title: "Creative Writing Techniques",
      outcomeRefs: ["ENG3.1"],
      estMinutes: 40,
      status: "published" as const
    },
    {
      $id: "template-reading-456",
      title: "Reading Comprehension Skills",
      outcomeRefs: ["ENG3.2"],
      estMinutes: 35,
      status: "published" as const
    }
  ]
};

// Test mastery scenarios
export const testMasteryScenarios = {
  lowMastery: {
    emaByOutcome: {
      "AOM3.1": 0.3,  // Low mastery
      "AOM3.2": 0.5,  // Low mastery
      "AOM3.3": 0.8,  // Good mastery
      "AOM3.4": 0.2,  // Very low mastery
      "AOM3.5": 0.7,  // Good mastery
      "AOM3.6": 0.9   // Excellent mastery
    }
  },
  mixedMastery: {
    emaByOutcome: {
      "PHY3.1": 0.6,  // Acceptable
      "PHY3.2": 0.4,  // Low mastery
      "PHY3.3": 0.8   // Good mastery
    }
  },
  highMastery: {
    emaByOutcome: {
      "ENG3.1": 0.9,  // Excellent
      "ENG3.2": 0.85  // Excellent
    }
  }
};

// Test routine scenarios
export const testRoutineScenarios = {
  overdueOutcomes: {
    dueAtByOutcome: {
      "AOM3.1": "2025-09-14T10:00:00Z",  // Yesterday - overdue
      "AOM3.2": "2025-09-13T10:00:00Z",  // 2 days ago - overdue
      "AOM3.3": "2025-09-17T10:00:00Z",  // Future - not due yet
      "AOM3.4": "2025-09-12T10:00:00Z",  // 3 days ago - very overdue
      "AOM3.5": "2025-09-18T10:00:00Z",  // Future
      "AOM3.6": "2025-09-20T10:00:00Z"   // Future
    },
    lastTaughtAt: "2025-09-10T14:30:00Z",
    recentTemplateIds: ["template-area-456"] // Recently taught
  },
  currentRoutine: {
    dueAtByOutcome: {
      "PHY3.1": "2025-09-16T10:00:00Z",  // Today/tomorrow
      "PHY3.2": "2025-09-18T10:00:00Z",  // Future
      "PHY3.3": "2025-09-20T10:00:00Z"   // Future
    },
    lastTaughtAt: "2025-09-14T09:15:00Z",
    recentTemplateIds: []
  },
  noOverdue: {
    dueAtByOutcome: {
      "ENG3.1": "2025-09-17T10:00:00Z",  // Future
      "ENG3.2": "2025-09-19T10:00:00Z"   // Future
    },
    lastTaughtAt: "2025-09-13T11:45:00Z",
    recentTemplateIds: ["template-writing-123"]
  }
};

// Complete scheduling contexts for different scenarios
export const testSchedulingContexts: Record<string, SchedulingContextForCourse> = {
  mathematicsOverdue: {
    student: testStudents.multiCourseStudent,
    course: testCourses.mathematics,
    sow: {
      entries: [
        { order: 1, lessonTemplateId: "template-fractions-123" },
        { order: 2, lessonTemplateId: "template-area-456" },
        { order: 3, lessonTemplateId: "template-volume-789" },
        { order: 4, lessonTemplateId: "template-graphs-012" },
        { order: 5, lessonTemplateId: "template-statistics-345" }
      ]
    },
    templates: testLessonTemplates.mathematics,
    mastery: testMasteryScenarios.lowMastery,
    routine: testRoutineScenarios.overdueOutcomes,
    constraints: {
      maxBlockMinutes: 25,
      avoidRepeatWithinDays: 3,
      preferOverdue: true,
      preferLowEMA: true
    }
  },
  physicsCurrent: {
    student: testStudents.multiCourseStudent,
    course: testCourses.physics,
    sow: {
      entries: [
        { order: 1, lessonTemplateId: "template-forces-123" },
        { order: 2, lessonTemplateId: "template-energy-456" },
        { order: 3, lessonTemplateId: "template-waves-789" }
      ]
    },
    templates: testLessonTemplates.physics,
    mastery: testMasteryScenarios.mixedMastery,
    routine: testRoutineScenarios.currentRoutine,
    constraints: {
      maxBlockMinutes: 25,
      avoidRepeatWithinDays: 3,
      preferOverdue: true,
      preferLowEMA: true
    }
  },
  englishAdvanced: {
    student: testStudents.multiCourseStudent,
    course: testCourses.english,
    sow: {
      entries: [
        { order: 1, lessonTemplateId: "template-writing-123" },
        { order: 2, lessonTemplateId: "template-reading-456" }
      ]
    },
    templates: testLessonTemplates.english,
    mastery: testMasteryScenarios.highMastery,
    routine: testRoutineScenarios.noOverdue,
    constraints: {
      maxBlockMinutes: 25,
      avoidRepeatWithinDays: 3,
      preferOverdue: true,
      preferLowEMA: true
    }
  }
};

// Expected recommendation results for testing
export const expectedRecommendations: Record<string, CourseRecommendation> = {
  mathematicsOverdue: {
    courseId: "C844 73",
    generatedAt: "2025-09-15T15:00:00Z",
    graphRunId: "test-run-id-math-123",
    candidates: [
      {
        lessonTemplateId: "template-volume-789", // Highest score: overdue + low mastery
        title: "Volume of 3D Shapes",
        targetOutcomeIds: ["AOM3.4"],
        estimatedMinutes: 50,
        priorityScore: 0.60, // 0.40 (overdue) + 0.25 (low mastery) - 0.05 (long)
        reasons: ["overdue", "low mastery", "long lesson"],
        flags: []
      },
      {
        lessonTemplateId: "template-fractions-123", // Second: overdue + low mastery
        title: "Fractions ↔ Decimals ↔ Percents",
        targetOutcomeIds: ["AOM3.1", "AOM3.2"],
        estimatedMinutes: 45,
        priorityScore: 0.60, // 0.40 (overdue) + 0.25 (low mastery) - 0.05 (long)
        reasons: ["overdue", "low mastery", "early order", "long lesson"],
        flags: []
      },
      {
        lessonTemplateId: "template-graphs-012", // Third: early order
        title: "Linear Graphs and Functions",
        targetOutcomeIds: ["AOM3.5"],
        estimatedMinutes: 35,
        priorityScore: 0.12, // 0.15 (early order) - 0.05 (long) - 0.02 (adjusted)
        reasons: ["early order", "long lesson"],
        flags: []
      }
    ],
    rubric: "Overdue>LowEMA>Order | -Recent -TooLong"
  },
  physicsCurrent: {
    courseId: "C845 73",
    generatedAt: "2025-09-15T15:00:00Z",
    graphRunId: "test-run-id-physics-456",
    candidates: [
      {
        lessonTemplateId: "template-energy-456", // Top: low mastery + reasonable length
        title: "Energy Transformations",
        targetOutcomeIds: ["PHY3.2"],
        estimatedMinutes: 40,
        priorityScore: 0.20, // 0.25 (low mastery) - 0.05 (long)
        reasons: ["low mastery", "long lesson"],
        flags: []
      },
      {
        lessonTemplateId: "template-forces-123", // Second: early order but long
        title: "Forces and Motion",
        targetOutcomeIds: ["PHY3.1"],
        estimatedMinutes: 50,
        priorityScore: 0.10, // 0.15 (early order) - 0.05 (long)
        reasons: ["early order", "long lesson"],
        flags: []
      }
    ],
    rubric: "Overdue>LowEMA>Order | -Recent -TooLong"
  }
};

// Test session creation data
export const testSessionData = {
  validSession: {
    sessionId: "test-session-abc123",
    threadId: "test-thread-def456",
    lessonTemplateId: "template-fractions-123",
    status: "created",
    createdAt: "2025-09-15T15:00:00Z"
  },
  invalidSession: {
    error: "Lesson template not found",
    statusCode: 404
  }
};

// Test API error scenarios
export const testErrorScenarios = {
  serverError: {
    status: 500,
    message: "Internal server error",
    details: "Course manager service unavailable"
  },
  authError: {
    status: 401,
    message: "Unauthorized",
    details: "Invalid or expired session"
  },
  notFoundError: {
    status: 404,
    message: "Course not found",
    details: "Student not enrolled in specified course"
  },
  validationError: {
    status: 400,
    message: "Invalid request parameters",
    details: "Course ID format is invalid"
  }
};