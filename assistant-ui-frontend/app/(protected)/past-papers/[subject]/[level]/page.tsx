'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/ui/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  ChevronRight,
  Loader2,
  Calculator,
  Clock,
  BookOpen,
  Home,
  FolderOpen
} from 'lucide-react';
import { logger } from '@/lib/logger';

interface PaperItem {
  paperId: string;
  subject: string;
  level: string;
  year: number;
  paperCode: string;
  totalMarks: number;
  questionCount: number;
  calculatorAllowed: boolean;
  hasWalkthroughs: boolean;
}

interface Props {
  params: Promise<{
    subject: string;
    level: string;
  }>;
}

export default function SubjectLevelPage({ params }: Props) {
  const { subject: encodedSubject, level: encodedLevel } = use(params);
  const subject = decodeURIComponent(encodedSubject);
  const level = decodeURIComponent(encodedLevel);

  const router = useRouter();
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPapers() {
      try {
        setLoading(true);
        const url = `/api/past-papers?subject=${encodeURIComponent(subject)}&level=${encodeURIComponent(level)}`;
        const response = await fetch(url);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch papers');
        }

        const data = await response.json();
        setPapers(data.papers || []);
        logger.info('Loaded papers', { count: data.papers?.length, subject, level });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        logger.error('Failed to load papers', { error: message });
      } finally {
        setLoading(false);
      }
    }

    fetchPapers();
  }, [subject, level]);

  // Group papers by year
  const papersByYear = papers.reduce((acc, paper) => {
    if (!acc[paper.year]) {
      acc[paper.year] = [];
    }
    acc[paper.year].push(paper);
    return acc;
  }, {} as Record<number, PaperItem[]>);

  // Sort years descending
  const sortedYears = Object.keys(papersByYear)
    .map(Number)
    .sort((a, b) => b - a);

  const handlePaperClick = (paper: PaperItem) => {
    router.push(
      `/past-papers/${encodedSubject}/${encodedLevel}/${paper.year}/${encodeURIComponent(paper.paperCode)}`
    );
  };

  if (loading) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Loading papers...</p>
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
                <p className="text-red-600 font-medium">Error loading papers</p>
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
          {/* Breadcrumb Navigation */}
          <nav className="mb-6 flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 gap-1.5 px-2"
              onClick={() => router.push('/dashboard')}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 gap-1.5 px-2"
              onClick={() => router.push('/past-papers')}
            >
              <FolderOpen className="h-4 w-4" />
              Past Papers
            </Button>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <span className="text-gray-900 font-medium px-2">
              {subject} - {level}
            </span>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              {subject} - {level}
            </h1>
            <p className="text-gray-600 mt-2">
              {papers.length} paper{papers.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {/* Papers by Year */}
          {papers.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-600">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No papers found for this subject and level.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {sortedYears.map((year) => (
                <div key={year}>
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {year}
                    </Badge>
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {papersByYear[year].map((paper) => (
                      <Card
                        key={paper.paperId}
                        className="cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300"
                        onClick={() => handlePaperClick(paper)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                Paper {paper.paperCode}
                              </h3>
                              <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="h-4 w-4" />
                                  {paper.questionCount} questions
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {paper.totalMarks} marks
                                </span>
                                {paper.calculatorAllowed && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <Calculator className="h-4 w-4" />
                                    Calculator
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
