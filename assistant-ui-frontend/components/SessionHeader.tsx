"use client";

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SessionContext } from './MyAssistant';

interface SessionHeaderProps {
  sessionContext?: SessionContext;
}

export function SessionHeader({ sessionContext }: SessionHeaderProps) {
  if (!sessionContext) {
    return (
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <h1 className="text-xl font-semibold text-gray-900">Assistant</h1>
      </header>
    );
  }

  const { lesson_snapshot } = sessionContext;
  
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center space-x-3">
        <Link 
          href="/dashboard" 
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          Dashboard
        </Link>
        
        <div className="text-gray-400">→</div>
        
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>National 3</span>
            <span>•</span>
            <span>Applications of Mathematics</span>
            <span>•</span>
            <span className="font-medium text-gray-900">
              {lesson_snapshot?.title || 'Lesson'}
            </span>
          </div>
          
        </div>
      </div>
    </header>
  );
}