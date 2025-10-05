'use client';

import { useState, useEffect } from 'react';
import { OutcomeMasteryChart } from './OutcomeMasteryChart';
import { getOutcomeMasteryBreakdown } from '@/lib/services/progress-service';
import { TrendingUp, Loader2 } from 'lucide-react';

interface MasteryBreakdownProps {
  studentId: string;
  courseId: string;
}

export function MasteryBreakdown({ studentId, courseId }: MasteryBreakdownProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMasteryData();
  }, [studentId, courseId]);

  const loadMasteryData = async () => {
    try {
      const { Client, Databases } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);

      const masteryData = await getOutcomeMasteryBreakdown(studentId, courseId, databases);
      setData(masteryData);
    } catch (error) {
      console.error('Failed to load mastery breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        Outcome Mastery Breakdown
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <OutcomeMasteryChart data={data} />
      )}
    </div>
  );
}
