'use client';

import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/ui/header';
import { CourseDetailView } from '@/components/dashboard/CourseDetailView';

/**
 * Course Detail Page
 *
 * Displays the full course content for a specific course including:
 * - Course header with progress
 * - Exam tools (Mock Exam, Past Papers, NAT5+)
 * - Spaced Repetition panel
 * - AI Recommendations
 * - Course Curriculum
 *
 * URL: /dashboard/course/[courseId]
 */
export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();

  const courseId = params.courseId as string;

  const handleBack = () => {
    router.push('/dashboard');
  };

  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <CourseDetailView
          courseId={courseId}
          onBack={handleBack}
        />
      </main>
    </div>
  );
}
