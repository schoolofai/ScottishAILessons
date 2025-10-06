"use client";

import { useState } from 'react';
import { useLogout } from '@/hooks/useLogout';
import { GraduationCap } from 'lucide-react';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout, isLoading } = useLogout();

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Logo/Title */}
      <div className="flex items-center gap-2">
        <GraduationCap className="h-8 w-8 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Scottish AI Lessons</h1>
      </div>

      {/* User Menu */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
          data-testid="user-menu"
        >
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">U</span>
          </div>
          <svg
            className={`w-4 h-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsMenuOpen(false)}
            />
            
            {/* Menu Content */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
              <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                Signed in as User
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                data-testid="logout-button"
              >
                {isLoading ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}