'use client';

import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{
        background: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'var(--wizard-border-light)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="p-2 rounded-xl transition-all duration-200 group-hover:scale-105"
            style={{ background: 'var(--wizard-green-bg)' }}
          >
            <GraduationCap
              className="h-6 w-6"
              style={{ color: 'var(--wizard-green)' }}
            />
          </div>
          <span
            className="text-xl font-bold hidden sm:block"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
          >
            Scottish AI Lessons
          </span>
          {/* Mobile short name */}
          <span
            className="text-xl font-bold sm:hidden"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--wizard-text)' }}
          >
            SAIL
          </span>
        </Link>

        {/* Right side buttons */}
        <div className="flex items-center gap-3">
          {/* Login - Ghost Button */}
          <Link href="/login">
            <button
              className="
                px-4 py-2 rounded-xl font-semibold text-sm
                transition-all duration-200
                hover:bg-[var(--wizard-bg)]
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--wizard-text-secondary)',
              }}
            >
              Login
            </button>
          </Link>

          {/* Get Started - Primary Button */}
          <Link href="/signup">
            <button
              className="
                px-4 py-2 rounded-xl text-white font-semibold text-sm
                transition-all duration-200
                hover:-translate-y-0.5
                active:translate-y-0
              "
              style={{
                fontFamily: 'var(--font-body)',
                background: 'var(--wizard-green)',
                boxShadow: '0 2px 0 var(--wizard-green-dark)',
              }}
            >
              Get Started
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
