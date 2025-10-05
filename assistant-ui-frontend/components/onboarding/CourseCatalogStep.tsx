'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Loader2, BookOpen, CheckCircle } from 'lucide-react';

interface CourseCatalogStepProps {
  onNext: (data?: { firstCourseId?: string }) => void;
  onBack: () => void;
  onSkip?: () => void;
}

export function CourseCatalogStep({ onNext, onBack, onSkip }: CourseCatalogStepProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const { Client, Databases } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);

      // Get all published courses
      const coursesResult = await databases.listDocuments('default', 'courses');
      setCourses(coursesResult.documents);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    onNext(selectedCourseId ? { firstCourseId: selectedCourseId } : undefined);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading courses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Choose Your First Course</h2>
        <p className="text-gray-600">
          Select a course to get started, or skip to browse the full catalog later
        </p>
      </div>

      {/* Course grid */}
      <div className="grid md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {courses.map(course => (
          <div
            key={course.courseId}
            onClick={() => setSelectedCourseId(course.courseId)}
            className={`
              relative p-4 border-2 rounded-lg cursor-pointer transition-all
              ${selectedCourseId === course.courseId
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 bg-white'
              }
            `}
          >
            {selectedCourseId === course.courseId && (
              <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-blue-600" />
            )}

            <div className="flex items-start gap-3">
              <BookOpen className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">
                  {course.subject} - {course.level}
                </h3>
                <p className="text-sm text-gray-600">
                  {course.description || 'Scottish curriculum aligned course'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-8 text-gray-600">
          <p>No courses available at the moment.</p>
          <p className="text-sm mt-2">Please check back later.</p>
        </div>
      )}

      {/* Selection info */}
      {selectedCourseId && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            ✓ Selected: {courses.find(c => c.courseId === selectedCourseId)?.subject} - {' '}
            {courses.find(c => c.courseId === selectedCourseId)?.level}
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>

        <div className="space-x-2">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip}>
              Browse catalog later
            </Button>
          )}
          <Button
            onClick={handleContinue}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!selectedCourseId && !onSkip}
          >
            {selectedCourseId ? 'Continue with selected course →' : 'Skip →'}
          </Button>
        </div>
      </div>
    </div>
  );
}
