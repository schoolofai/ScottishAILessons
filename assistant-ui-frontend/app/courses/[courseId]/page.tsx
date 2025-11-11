'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { enrollStudentInCourse } from '@/lib/services/enrollment-service';
import { CourseCheatSheetButton } from '@/components/revision-notes/CourseCheatSheetButton';
import {
  ArrowLeft,
  BookOpen,
  Target,
  CheckCircle,
  Loader2,
  Clock,
  Award
} from 'lucide-react';

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [showAllLessons, setShowAllLessons] = useState(false);

  useEffect(() => {
    loadCourseDetails();
  }, [courseId]);

  const loadCourseDetails = async () => {
    try {
      const { Client, Databases, Account, Query } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);
      const account = new Account(client);

      // Get course details - query by courseId field, not document ID
      const coursesResult = await databases.listDocuments('default', 'courses',
        [Query.equal('courseId', courseId)]
      );

      if (coursesResult.documents.length === 0) {
        // Course not found
        setCourse(null);
        setLoading(false);
        return;
      }

      const courseDoc = coursesResult.documents[0];
      setCourse(courseDoc);

      // Get course outcomes
      const outcomesResult = await databases.listDocuments('default', 'course_outcomes',
        [Query.equal('courseId', courseId)]
      );
      setOutcomes(outcomesResult.documents);

      // Get lesson templates (from latest Authored_SOW)
      try {
        const authoredSOWResult = await databases.listDocuments('default', 'Authored_SOW',
          [
            Query.equal('courseId', courseId),
            Query.equal('status', 'published'),
            Query.orderDesc('version'),
            Query.limit(1)
          ]
        );

        if (authoredSOWResult.documents.length > 0) {
          const authoredSOW = authoredSOWResult.documents[0];
          const entries = JSON.parse(authoredSOW.entries || '[]');
          setLessons(entries);
        }
      } catch (err) {
        console.log('No lesson templates found for course');
      }

      // Check enrollment status
      try {
        const user = await account.get();
        const studentsResult = await databases.listDocuments('default', 'students',
          [Query.equal('userId', user.$id)]
        );

        if (studentsResult.documents.length > 0) {
          const student = studentsResult.documents[0];
          setStudentId(student.$id);

          const enrollmentsResult = await databases.listDocuments('default', 'enrollments',
            [
              Query.equal('studentId', student.$id),
              Query.equal('courseId', courseId)
            ]
          );

          setIsEnrolled(enrollmentsResult.documents.length > 0);
        }
      } catch (err) {
        console.log('User not logged in');
      }
    } catch (error) {
      console.error('Failed to load course details:', error);
      setError('Failed to load course details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!studentId) {
      router.push('/login');
      return;
    }

    setEnrolling(true);
    setError(null);

    try {
      const { Client, Databases } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);

      // Use Phase 1 enrollment service
      await enrollStudentInCourse(studentId, courseId, databases);

      console.log('[Course Detail] Enrollment successful');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Enrollment failed:', err);

      if (err.code === 'DUPLICATE_ENROLLMENT') {
        setError('You are already enrolled in this course.');
        setIsEnrolled(true);
      } else if (err.code === 'NO_AUTHORED_SOW') {
        setError('This course is not yet available for enrollment.');
      } else {
        setError('Failed to enroll. Please try again.');
      }
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Course Not Found</h2>
          <p className="text-gray-600 mb-4">The requested course could not be found.</p>
          <Button onClick={() => router.push('/courses/catalog')}>
            Browse All Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/courses/catalog')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Catalog
          </Button>

          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2">
                {course.subject}
              </h1>
              <p className="text-xl text-gray-600 mb-4">
                {course.level}
              </p>
              <p className="text-gray-700 mb-4">
                {course.description || 'Scottish Curriculum Framework aligned course with personalized AI teaching.'}
              </p>

              {/* Course Cheat Sheet Button */}
              <div className="mt-4">
                <CourseCheatSheetButton
                  courseId={courseId}
                  isAvailable={null} // Will check availability automatically
                  onClick={() => {}}
                />
              </div>
            </div>

            <div className="flex-shrink-0">
              {isEnrolled ? (
                <Button
                  size="lg"
                  onClick={() => router.push('/dashboard')}
                  className="gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  {enrolling ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>
                      <Award className="h-5 w-5" />
                      Enroll Now
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Learning Outcomes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Learning Outcomes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {outcomes.length > 0 ? (
                  <ul className="space-y-3">
                    {outcomes.map((outcome, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{outcome.unitTitle || outcome.title || `Outcome ${index + 1}`}</p>
                          <p className="text-sm text-gray-600">{outcome.outcomeTitle || outcome.outcomeId || ''}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600">
                    Learning outcomes will be displayed here.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Lesson Preview */}
            {lessons.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    Course Structure ({lessons.length} lessons)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(showAllLessons ? lessons : lessons.slice(0, 5)).map((lesson: any, index: number) => {
                      // Helper function to get lesson type badge styling
                      const getLessonTypeBadge = (type: string) => {
                        const typeMap: Record<string, { label: string; className: string }> = {
                          'teach': { label: 'Teach', className: 'bg-blue-100 text-blue-700' },
                          'check-in': { label: 'Check-in', className: 'bg-yellow-100 text-yellow-700' },
                          'practice': { label: 'Practice', className: 'bg-green-100 text-green-700' },
                          'revision': { label: 'Revision', className: 'bg-purple-100 text-purple-700' },
                          'assessment': { label: 'Assessment', className: 'bg-red-100 text-red-700' },
                        };
                        return typeMap[type?.toLowerCase()] || { label: type || 'Lesson', className: 'bg-gray-100 text-gray-700' };
                      };

                      const typeBadge = getLessonTypeBadge(lesson.lesson_type);

                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex-shrink-0">
                            {lesson.order || index + 1}
                          </span>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <span className="text-sm flex-1 truncate">
                              {lesson.label || lesson.lessonTemplateRef || `Lesson ${index + 1}`}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${typeBadge.className}`}>
                              {typeBadge.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {lessons.length > 5 && (
                      <button
                        onClick={() => setShowAllLessons(!showAllLessons)}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-center pt-2 w-full transition-colors"
                      >
                        {showAllLessons
                          ? 'Show less'
                          : `+ ${lessons.length - 5} more lessons`}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Course Info */}
            <Card>
              <CardHeader>
                <CardTitle>Course Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <span>Self-paced learning</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Target className="h-5 w-5 text-gray-400" />
                  <span>{outcomes.length} learning outcomes</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <BookOpen className="h-5 w-5 text-gray-400" />
                  <span>{lessons.length} lessons</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Award className="h-5 w-5 text-gray-400" />
                  <span>Scottish Curriculum aligned</span>
                </div>
              </CardContent>
            </Card>

            {/* CTA Card */}
            {!isEnrolled && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Ready to start learning?</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Enroll now and get instant access to personalized AI-powered lessons.
                  </p>
                  <Button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {enrolling ? 'Enrolling...' : 'Enroll Now'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
