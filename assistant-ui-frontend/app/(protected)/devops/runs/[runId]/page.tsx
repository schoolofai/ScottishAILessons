'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useIsAdmin } from '@/lib/utils/adminCheck';
import { Header } from '@/components/ui/header';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import Link from 'next/link';

/**
 * Step State from checkpoint
 */
interface StepState {
  step: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  outputs?: Record<string, unknown>;
  metrics?: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
  error?: string;
  execution_id?: string;
  workspace_path?: string;
}

/**
 * Full Pipeline Run Detail
 */
interface PipelineRunDetail {
  run_id: string;
  pipeline: string;
  subject: string;
  level: string;
  course_id?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  updated_at?: string;
  completed_steps: StepState[];
  last_completed_step?: string;
  next_step?: string;
  total_cost_usd: number;
  total_tokens: number;
  error?: string;
}

/**
 * DevOps Run Detail Page - View detailed information about a pipeline run
 */
export default function RunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const { isAdmin, loading: authLoading } = useIsAdmin();
  const router = useRouter();
  const [run, setRun] = useState<PipelineRunDetail | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'logs' | 'reports'>('steps');

  // Fetch run details
  useEffect(() => {
    const fetchRunDetail = async () => {
      try {
        const response = await fetch(`/api/devops/runs/${runId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch run details');
        }
        const data = await response.json();
        setRun(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && isAdmin && runId) {
      fetchRunDetail();
    }
  }, [authLoading, isAdmin, runId]);

  // Fetch logs when logs tab is active
  useEffect(() => {
    const fetchLogs = async () => {
      if (activeTab !== 'logs' || !runId) return;

      try {
        const response = await fetch(`/api/devops/runs/${runId}/logs`);
        if (response.ok) {
          const data = await response.text();
          setLogs(data);
        }
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    };

    fetchLogs();
  }, [activeTab, runId]);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-7xl mx-auto p-6">
            <InlineLoadingSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  if (error || !run) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-7xl mx-auto p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">Error: {error || 'Run not found'}</p>
              <Link href="/devops" className="text-blue-600 hover:underline mt-2 block">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const statusColors = {
    pending: 'bg-gray-100 text-gray-700 border-gray-300',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-300',
    completed: 'bg-green-100 text-green-700 border-green-300',
    failed: 'bg-red-100 text-red-700 border-red-300'
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Breadcrumb */}
          <nav className="mb-4">
            <Link href="/devops" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </nav>

          {/* Page Header */}
          <div className="mb-6 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">Run: {runId}</h1>
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${statusColors[run.status]}`}>
                  {run.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-gray-600 mt-2">
                {run.subject} / {run.level}
                {run.course_id && ` • Course: ${run.course_id}`}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {(run.status === 'failed' || run.status === 'in_progress') && (
                <button
                  onClick={() => navigator.clipboard.writeText(
                    `./devops/pipeline.sh lessons --resume ${runId}`
                  )}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copy Resume Command
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Started</p>
              <p className="text-lg font-medium">{formatDate(run.started_at)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Steps Completed</p>
              <p className="text-lg font-medium">{run.completed_steps?.length || 0} / 4</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Cost</p>
              <p className="text-lg font-medium">${(run.total_cost_usd || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Tokens</p>
              <p className="text-lg font-medium">{(run.total_tokens || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Error Banner */}
          {run.error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-700 font-medium">Error</h3>
              <p className="text-red-600 mt-1">{run.error}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex gap-4 px-6">
                {(['steps', 'logs', 'reports'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-4 border-b-2 font-medium text-sm capitalize ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {/* Steps Tab */}
              {activeTab === 'steps' && (
                <div className="space-y-4">
                  {['seed', 'sow', 'lessons', 'diagrams'].map((stepName, index) => {
                    const step = run.completed_steps?.find(s => s.step === stepName);
                    const isCompleted = step?.status === 'completed';
                    const isFailed = step?.status === 'failed';
                    const isPending = !step;

                    return (
                      <div
                        key={stepName}
                        className={`border rounded-lg p-4 ${
                          isCompleted
                            ? 'border-green-200 bg-green-50'
                            : isFailed
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? 'bg-green-500 text-white'
                                : isFailed
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                            }`}>
                              {isCompleted ? '✓' : isFailed ? '✗' : index + 1}
                            </div>
                            <div>
                              <h3 className="font-medium capitalize">{stepName}</h3>
                              {step?.started_at && (
                                <p className="text-sm text-gray-500">
                                  Started: {formatDate(step.started_at)}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            {step?.duration_seconds && (
                              <p className="text-sm text-gray-600">
                                Duration: {formatDuration(step.duration_seconds)}
                              </p>
                            )}
                            {step?.metrics?.cost_usd && (
                              <p className="text-sm text-gray-600">
                                Cost: ${step.metrics.cost_usd.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Step Outputs */}
                        {step?.outputs && Object.keys(step.outputs).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-sm font-medium text-gray-700 mb-2">Outputs:</p>
                            <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(step.outputs, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Step Error */}
                        {step?.error && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            <p className="text-sm font-medium text-red-700">Error:</p>
                            <p className="text-sm text-red-600">{step.error}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Logs Tab */}
              {activeTab === 'logs' && (
                <div>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
                    {logs || 'No logs available. Pipeline may not have started yet.'}
                  </pre>
                </div>
              )}

              {/* Reports Tab */}
              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Summary Report</h3>
                    <a
                      href={`/api/devops/runs/${runId}/reports/summary`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View summary.json
                    </a>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Metrics Report</h3>
                    <a
                      href={`/api/devops/runs/${runId}/reports/metrics`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View metrics.json
                    </a>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Event Stream</h3>
                    <a
                      href={`/api/devops/runs/${runId}/reports/events`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View events.jsonl
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
