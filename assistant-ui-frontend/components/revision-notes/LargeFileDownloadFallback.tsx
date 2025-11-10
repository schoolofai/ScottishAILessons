'use client';

import React from 'react';
import { LargeFileDownloadFallbackProps } from '@/specs/003-revision-notes-frontend/contracts/RevisionNotesComponents';

/**
 * LargeFileDownloadFallback - UI for files exceeding 5MB threshold
 *
 * Prevents browser freezing by offering download instead of inline rendering
 * for large markdown files (>5MB as per FR-019).
 *
 * Displays:
 * - File size warning
 * - Download button with file metadata
 * - Explanation of why inline rendering is disabled
 */
export function LargeFileDownloadFallback({
  fileName,
  fileSize,
  downloadUrl,
  className = ''
}: LargeFileDownloadFallbackProps) {
  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formattedSize = formatFileSize(fileSize);
  const thresholdSize = formatFileSize(5 * 1024 * 1024); // 5MB

  return (
    <div className={`large-file-download-fallback ${className}`}>
      <div className="p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
        {/* Large file icon */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="text-6xl">📦</div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Large File Detected
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This revision note file is <strong>{formattedSize}</strong>, which exceeds the {thresholdSize} inline rendering limit.
            </p>
          </div>

          {/* File metadata */}
          <div className="w-full max-w-md p-4 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">File Name:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                  {fileName}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">File Size:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {formattedSize}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Format:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  Markdown (.md)
                </dd>
              </div>
            </dl>
          </div>

          {/* Download button */}
          <a
            href={downloadUrl}
            download={fileName}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-md transition-colors shadow-sm"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Download File</span>
          </a>

          {/* Explanation */}
          <div className="max-w-md text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
            <p>
              To prevent performance issues, we recommend downloading large files and viewing them in a dedicated markdown viewer.
            </p>
            <p className="italic">
              Inline rendering is disabled for files over {thresholdSize} to ensure smooth browser performance.
            </p>
          </div>

          {/* Suggested viewers */}
          <details className="w-full max-w-md">
            <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:underline">
              Recommended Markdown Viewers
            </summary>
            <div className="mt-2 p-3 bg-white dark:bg-gray-700 rounded text-xs space-y-1 border border-gray-200 dark:border-gray-600">
              <p><strong>Desktop:</strong> Typora, Mark Text, Visual Studio Code</p>
              <p><strong>Online:</strong> StackEdit, Dillinger</p>
              <p><strong>Browser Extension:</strong> Markdown Viewer (Chrome/Firefox)</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
