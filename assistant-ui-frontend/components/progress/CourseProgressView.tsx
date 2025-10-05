'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getCourseProgress, getMasteryLabel } from '@/lib/services/progress-service';
import { Button } from '../ui/button';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { CourseProgress } from '@/lib/services/progress-service';
import { ProgressPageSkeleton } from '../ui/LoadingSkeleton';

// Lazy load heavy components
const MasteryBreakdown = dynamic(() => import('./MasteryBreakdown').then(mod => ({ default: mod.MasteryBreakdown })), {
  loading: () => <div className="bg-white rounded-lg shadow p-6 animate-pulse h-64" />,
  ssr: false
});

const SessionHistory = dynamic(() => import('./SessionHistory').then(mod => ({ default: mod.SessionHistory })), {
  loading: () => <div className="bg-white rounded-lg shadow p-6 animate-pulse h-64" />,
  ssr: false
});

const CompletionModal = dynamic(() => import('./CompletionModal').then(mod => ({ default: mod.CompletionModal })), {
  ssr: false
});

interface CourseProgressViewProps {
  courseId: string;
}

export function CourseProgressView({ courseId }: CourseProgressViewProps) {
  const router = useRouter();
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Decode courseId from URL parameter (handles spaces and special chars)
  const decodedCourseId = decodeURIComponent(courseId);

  useEffect(() => {
    loadProgress();
  }, [decodedCourseId]);

  const loadProgress = async () => {
    try {
      const { Databases, Client, Account, Query } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);
      const account = new Account(client);

      const user = await account.get();
      const studentsResult = await databases.listDocuments('default', 'students',
        [Query.equal('userId', user.$id)]
      );

      const student = studentsResult.documents[0];
      setStudentId(student.$id);

      const progressData = await getCourseProgress(student.$id, decodedCourseId, databases);
      setProgress(progressData);

      // Show completion modal if just completed
      if (progressData.progressPercentage === 100) {
        setShowCompletionModal(true);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!progress) return;

    // Generate PDF report
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Course Progress Report', 20, 20);

    doc.setFontSize(12);
    doc.text(`Course: ${progress.courseName}`, 20, 40);
    doc.text(`Progress: ${progress.progressPercentage.toFixed(1)}%`, 20, 50);
    doc.text(`Average Mastery: ${progress.averageMastery.toFixed(2)} (${getMasteryLabel(progress.averageMastery)})`, 20, 60);
    doc.text(`Lessons Completed: ${progress.completedLessons} / ${progress.totalLessons}`, 20, 70);
    doc.text(`Time Remaining: ~${Math.round(progress.estimatedTimeRemaining / 60)} hours`, 20, 80);

    if (progress.lastActivity) {
      doc.text(`Last Activity: ${new Date(progress.lastActivity).toLocaleDateString()}`, 20, 90);
    }

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 280);

    doc.save(`progress-${decodedCourseId}.pdf`);
  };

  if (loading || !progress || !studentId) {
    return <ProgressPageSkeleton />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-3">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-2xl sm:text-3xl font-bold">{progress.courseName}</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">Detailed Progress Report</p>
      </div>

      {/* Overall progress summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm text-gray-600 mb-2">Overall Progress</h3>
          <p className="text-2xl sm:text-3xl font-bold">{progress.progressPercentage.toFixed(1)}%</p>
          <p className="text-sm text-gray-600 mt-1">
            {progress.completedLessons} of {progress.totalLessons} lessons
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm text-gray-600 mb-2">Average Mastery</h3>
          <p className="text-2xl sm:text-3xl font-bold">{progress.averageMastery.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">
            {getMasteryLabel(progress.averageMastery)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm text-gray-600 mb-2">Time Remaining</h3>
          <p className="text-2xl sm:text-3xl font-bold">
            ~{Math.round(progress.estimatedTimeRemaining / 60)}h
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Estimated
          </p>
        </div>
      </div>

      {/* Mastery breakdown */}
      <MasteryBreakdown studentId={studentId} courseId={decodedCourseId} />

      {/* Session history */}
      <SessionHistory studentId={studentId} courseId={decodedCourseId} />

      {/* Export button */}
      <div className="mt-6 sm:mt-8">
        <Button onClick={handleExport} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Export Progress Report (PDF)
        </Button>
      </div>

      {/* Completion modal */}
      {showCompletionModal && (
        <CompletionModal
          courseName={progress.courseName}
          averageMastery={progress.averageMastery}
          onClose={() => setShowCompletionModal(false)}
        />
      )}
    </div>
  );
}
