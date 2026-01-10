'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIsAdmin } from '@/lib/utils/adminCheck';
import { Header } from '@/components/ui/header';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import Link from 'next/link';

/**
 * Pipeline Run Summary from checkpoint files
 */
interface PipelineRun {
  run_id: string;
  pipeline: string;
  subject: string;
  level: string;
  course_id?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at: string;
  updated_at?: string;
  last_completed_step?: string;
  next_step?: string;
  total_cost_usd: number;
  total_tokens: number;
  error?: string;
  steps_completed: number;
}

/**
 * DevOps Pipeline Dashboard - View and manage content authoring pipelines
 * Only accessible to admin users
 */
export default function DevOpsDashboard() {
  const { isAdmin, loading: authLoading } = useIsAdmin();
  const router = useRouter();
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch pipeline runs
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const response = await fetch('/api/devops/runs');
        if (!response.ok) {
          throw new Error('Failed to fetch pipeline runs');
        }
        const data = await response.json();
        setRuns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && isAdmin) {
      fetchRuns();
    }
  }, [authLoading, isAdmin]);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  if (authLoading) {
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

  // Calculate summary stats
  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const inProgressRuns = runs.filter(r => r.status === 'in_progress').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const totalCost = runs.reduce((sum, r) => sum + (r.total_cost_usd || 0), 0);

  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Page Header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Content Pipeline Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Monitor and manage content authoring pipelines
              </p>
            </div>
            <a
              href="https://smith.langchain.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Open LangSmith
            </a>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <SummaryCard title="Total Runs" value={totalRuns} icon="🚀" />
            <SummaryCard title="Completed" value={completedRuns} icon="✅" color="text-green-600" />
            <SummaryCard title="In Progress" value={inProgressRuns} icon="⏳" color="text-blue-600" />
            <SummaryCard title="Failed" value={failedRuns} icon="❌" color="text-red-600" />
            <SummaryCard title="Total Cost" value={`$${totalCost.toFixed(2)}`} icon="💰" />
          </div>

          {/* Recent Runs Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Recent Pipeline Runs</h2>
            </div>

            {loading ? (
              <div className="p-6">
                <InlineLoadingSkeleton />
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-600">
                Error loading runs: {error}
              </div>
            ) : runs.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No pipeline runs found. Start a new run with:
                <pre className="mt-2 p-3 bg-gray-100 rounded text-sm">
                  ./devops/pipeline.sh lessons --subject mathematics --level national_5
                </pre>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Run ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject / Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {runs.map(run => (
                      <PipelineRunRow key={run.run_id} run={run} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <QuickActionCard
                title="View Reports"
                description="Browse generated reports and metrics"
                href="/api/devops/reports"
                icon="📊"
              />
              <QuickActionCard
                title="View Logs"
                description="Access pipeline execution logs"
                href="/api/devops/logs"
                icon="📝"
              />
              <QuickActionCard
                title="Documentation"
                description="Pipeline usage and configuration"
                href="https://github.com/schoolofai/ScottishAILessons/blob/main/docs/devops/content-authoring-pipelines.md"
                icon="📚"
                external
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Summary Card Component
 */
function SummaryCard({
  title,
  value,
  icon,
  color = 'text-gray-900'
}: {
  title: string;
  value: string | number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Pipeline Run Row Component
 */
function PipelineRunRow({ run }: { run: PipelineRun }) {
  const statusColors = {
    pending: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700'
  };

  const steps = ['seed', 'sow', 'lessons', 'diagrams'];
  const lastStepIndex = run.last_completed_step
    ? steps.indexOf(run.last_completed_step)
    : -1;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <Link
          href={`/devops/runs/${run.run_id}`}
          className="font-mono text-sm text-blue-600 hover:underline"
        >
          {run.run_id}
        </Link>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="font-medium">{run.subject}</span>
        <span className="text-gray-500"> / {run.level}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[run.status]}`}>
          {run.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex gap-1">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`w-8 h-2 rounded ${
                index <= lastStepIndex
                  ? run.status === 'failed' && index === lastStepIndex + 1
                    ? 'bg-red-400'
                    : 'bg-green-400'
                  : 'bg-gray-200'
              }`}
              title={step}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {run.steps_completed}/4 steps
        </p>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        ${(run.total_cost_usd || 0).toFixed(2)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(run.started_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-2">
          <Link
            href={`/devops/runs/${run.run_id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            View
          </Link>
          {(run.status === 'failed' || run.status === 'in_progress') && (
            <button
              onClick={() => navigator.clipboard.writeText(
                `./devops/pipeline.sh lessons --resume ${run.run_id}`
              )}
              className="text-sm text-gray-500 hover:text-gray-700"
              title="Copy resume command"
            >
              Copy Resume
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Quick Action Card Component
 */
function QuickActionCard({
  title,
  description,
  href,
  icon,
  external = false
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
  external?: boolean;
}) {
  const linkProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <a
      href={href}
      {...linkProps}
      className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </a>
  );
}
