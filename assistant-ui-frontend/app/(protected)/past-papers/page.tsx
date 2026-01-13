'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/ui/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronRight, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface SubjectLevel {
  name: string;
  years: number[];
}

interface SubjectNavigation {
  name: string;
  levels: SubjectLevel[];
}

export default function PastPapersPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectNavigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBrowseData() {
      try {
        setLoading(true);
        const response = await fetch('/api/past-papers/browse');

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch browse data');
        }

        const data = await response.json();
        setSubjects(data.subjects || []);
        logger.info('Loaded browse data', { subjectCount: data.subjects?.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        logger.error('Failed to load browse data', { error: message });
      } finally {
        setLoading(false);
      }
    }

    fetchBrowseData();
  }, []);

  const handleLevelClick = (subject: string, level: string) => {
    // URL encode the subject and level
    const encodedSubject = encodeURIComponent(subject);
    const encodedLevel = encodeURIComponent(level);
    router.push(`/past-papers/${encodedSubject}/${encodedLevel}`);
  };

  if (loading) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Loading past papers...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gray-50">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-600 font-medium">Error loading past papers</p>
                <p className="text-gray-600 mt-2">{error}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              Past Paper Walkthroughs
            </h1>
            <p className="text-gray-600 mt-2">
              Examiner-aligned solutions with step-by-step marking guidance
            </p>
          </div>

          {/* Subjects Grid */}
          {subjects.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-600">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No past papers available yet.</p>
                  <p className="text-sm mt-2">Check back soon for new content.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {subjects.map((subject) => (
                <Card key={subject.name} className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {subject.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {subject.levels.map((level) => (
                        <Button
                          key={level.name}
                          variant="outline"
                          className="h-auto p-4 flex flex-col items-start justify-start text-left hover:bg-blue-50 hover:border-blue-300"
                          onClick={() => handleLevelClick(subject.name, level.name)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-gray-900">
                              {level.name}
                            </span>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {level.years.slice(0, 5).map((year) => (
                              <Badge key={year} variant="secondary" className="text-xs">
                                {year}
                              </Badge>
                            ))}
                            {level.years.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{level.years.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
