/**
 * Backend Error UI Component
 *
 * Displays clear, actionable error messages when backend is unavailable.
 * This is NOT a fallback mechanism - it's an explicit error state that
 * guides users to fix the deployment configuration.
 *
 * Following the project's anti-pattern policy: NO SILENT FAILURES
 */

import React from "react";
import { BackendUnavailableError } from "@/lib/backend-status";
import { AlertCircle, Server, ExternalLink, Terminal, CheckCircle } from "lucide-react";

interface BackendErrorUIProps {
  error: BackendUnavailableError;
}

export function BackendErrorUI({ error }: BackendErrorUIProps) {
  const isDevelopment = process.env.NODE_ENV !== "production";

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="max-w-2xl w-full space-y-4">
        {/* Main Error Alert */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 shadow-md">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-red-900 mb-2">
                Backend Service Unavailable
              </h2>
              <p className="text-base text-red-700 mb-4">
                {error.getUserMessage()}
              </p>

              {/* Technical Details */}
              {error.details && (
                <div className="bg-red-100 rounded-lg p-4 font-mono text-xs">
                  <div className="font-bold text-red-900 mb-2 flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Technical Details
                  </div>
                  {error.details.url && (
                    <div className="mb-1 text-red-800">
                      <strong>Backend URL:</strong> {error.details.url}
                    </div>
                  )}
                  {error.details.status && (
                    <div className="mb-1 text-red-800">
                      <strong>HTTP Status:</strong> {error.details.status}
                    </div>
                  )}
                  {error.details.error && (
                    <div className="mb-1 text-red-800">
                      <strong>Error:</strong> {error.details.error}
                    </div>
                  )}
                  {error.details.timestamp && (
                    <div className="text-red-800">
                      <strong>Timestamp:</strong> {new Date(error.details.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 shadow-md">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Server className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-blue-900 mb-3">
                How to Fix This
              </h3>
              <ol className="space-y-3 text-sm text-blue-800">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 text-blue-900 font-bold text-xs">
                    1
                  </span>
                  <div>
                    <strong>Deploy the LangGraph backend</strong>
                    <p className="text-blue-700 mt-1">
                      Deploy <code className="bg-blue-100 px-1 py-0.5 rounded">langgraph-agent/</code> to Replit or another service (Railway, Render, Fly.io)
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 text-blue-900 font-bold text-xs">
                    2
                  </span>
                  <div>
                    <strong>Get the backend URL</strong>
                    <p className="text-blue-700 mt-1">
                      Note the public URL of your deployed backend (e.g., <code className="bg-blue-100 px-1 py-0.5 rounded">https://your-backend.replit.app</code>)
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 text-blue-900 font-bold text-xs">
                    3
                  </span>
                  <div>
                    <strong>Update environment variable</strong>
                    <p className="text-blue-700 mt-1">
                      In Replit Secrets, update <code className="bg-blue-100 px-1 py-0.5 rounded">NEXT_PUBLIC_LANGGRAPH_API_URL</code> to your backend URL
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 text-blue-900 font-bold text-xs">
                    4
                  </span>
                  <div>
                    <strong>Restart this deployment</strong>
                    <p className="text-blue-700 mt-1">
                      Restart the frontend to apply the new environment variable
                    </p>
                  </div>
                </li>
              </ol>

              <div className="mt-4 pt-4 border-t border-blue-200">
                <a
                  href="/BACKEND_DEPLOYMENT.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Detailed Backend Deployment Guide
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Features Unavailable */}
        <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-6 shadow-md">
          <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Features Unavailable Without Backend
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-red-500">✗</span>
              <span>Chat functionality</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">✗</span>
              <span>Lesson sessions</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">✗</span>
              <span>Course recommendations</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">✗</span>
              <span>Teaching interactions</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">✗</span>
              <span>Course management</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">✗</span>
              <span>Progress tracking</span>
            </div>
          </div>
        </div>

        {/* What Still Works */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 shadow-md">
          <h4 className="text-sm font-bold text-green-900 mb-3 uppercase flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            What Still Works
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-700">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>User authentication (Appwrite)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Static pages and navigation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>User profile management</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>UI and styling</span>
            </div>
          </div>
        </div>

        {/* Development Mode Notice */}
        {isDevelopment && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 shadow-md">
            <div className="flex items-start gap-3">
              <Terminal className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong className="block mb-1">Development Mode</strong>
                <p>
                  You're running in development mode. Make sure your backend is running locally on the configured port,
                  or update <code className="bg-yellow-100 px-1 py-0.5 rounded">NEXT_PUBLIC_LANGGRAPH_API_URL</code> in your <code className="bg-yellow-100 px-1 py-0.5 rounded">.env.local</code> file.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
