'use client';

import { useParams } from 'next/navigation';
import { CourseProgressView } from '@/components/progress/CourseProgressView';

export default function ProgressPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  return <CourseProgressView courseId={courseId} />;
}
