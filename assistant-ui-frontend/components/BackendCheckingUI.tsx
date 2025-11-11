/**
 * Backend Checking UI Component
 *
 * Shows a loading state while checking backend availability.
 * This provides immediate feedback to users during the health check.
 */

import React from "react";
import { Loader2, Server } from "lucide-react";

interface BackendCheckingUIProps {
  message?: string;
}

export function BackendCheckingUI({ message = "Checking backend connection..." }: BackendCheckingUIProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="max-w-md w-full">
        <div className="bg-white border-2 border-blue-200 rounded-lg p-8 shadow-lg">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Animated Icon */}
            <div className="relative">
              <Server className="h-16 w-16 text-blue-500" />
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin absolute -bottom-2 -right-2" />
            </div>

            {/* Loading Message */}
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">
                Connecting to Backend
              </h2>
              <p className="text-sm text-gray-600">
                {message}
              </p>
            </div>

            {/* Loading Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full animate-pulse w-2/3"></div>
            </div>

            {/* Hint */}
            <p className="text-xs text-gray-500 mt-4">
              This usually takes just a few seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
