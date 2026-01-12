'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GripVertical, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { Button } from './button';

interface SplitPanelLayoutProps {
  /** Content for the left sidebar */
  sidebar: React.ReactNode;
  /** Main content area */
  content: React.ReactNode;
  /** Optional header content (sticky at top) */
  header?: React.ReactNode;
  /** Initial sidebar width in pixels (default: 280) */
  sidebarWidth?: number;
  /** Minimum sidebar width in pixels (default: 200) */
  sidebarMinWidth?: number;
  /** Maximum sidebar width in pixels (default: 400) */
  sidebarMaxWidth?: number;
  /** Enable sidebar resizing (default: true) */
  resizable?: boolean;
  /** Use drawer on mobile instead of hiding sidebar (default: true) */
  mobileDrawer?: boolean;
  /** Custom class for the container */
  className?: string;
  /** Callback when sidebar width changes */
  onSidebarResize?: (width: number) => void;
  /** Control drawer state externally */
  drawerOpen?: boolean;
  /** Callback when drawer state changes */
  onDrawerOpenChange?: (open: boolean) => void;
}

/**
 * SplitPanelLayout - A responsive split-panel layout component.
 *
 * Features:
 * - Resizable sidebar on desktop
 * - Slide-out drawer on mobile
 * - Sticky header support
 * - Smooth animations
 *
 * Visual structure:
 * ```
 * ┌─────────────────────────────────────────────┐
 * │  {header}                                   │
 * ├──────────────┬──────────────────────────────┤
 * │  {sidebar}   │  {content}                   │
 * │              │                              │
 * │  resizable ──┤                              │
 * │              │                              │
 * └──────────────┴──────────────────────────────┘
 * ```
 */
export function SplitPanelLayout({
  sidebar,
  content,
  header,
  sidebarWidth: initialWidth = 280,
  sidebarMinWidth = 200,
  sidebarMaxWidth = 400,
  resizable = true,
  mobileDrawer = true,
  className,
  onSidebarResize,
  drawerOpen: externalDrawerOpen,
  onDrawerOpenChange,
}: SplitPanelLayoutProps) {
  const isDesktop = useIsDesktop();
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);

  // Use external drawer state if provided, otherwise use internal
  const drawerOpen = externalDrawerOpen ?? internalDrawerOpen;
  const setDrawerOpen = onDrawerOpenChange ?? setInternalDrawerOpen;

  const containerRef = useRef<HTMLDivElement>(null);

  // Handle resize drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!resizable) return;
      e.preventDefault();
      setIsResizing(true);
    },
    [resizable]
  );

  // Handle resize movement
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // Clamp to min/max
      const clampedWidth = Math.min(
        Math.max(newWidth, sidebarMinWidth),
        sidebarMaxWidth
      );

      setSidebarWidth(clampedWidth);
      onSidebarResize?.(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarMinWidth, sidebarMaxWidth, onSidebarResize]);

  // Close drawer when switching to desktop
  useEffect(() => {
    if (isDesktop && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [isDesktop, drawerOpen, setDrawerOpen]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-dvh flex flex-col bg-gradient-to-br from-slate-50 via-cyan-50/30 to-emerald-50/30',
        className
      )}
    >
      {/* Header */}
      {header && (
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-200">
          <div className="flex items-center gap-3 px-4 h-14">
            {/* Mobile menu button */}
            {!isDesktop && mobileDrawer && (
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden -ml-2"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {header}
          </div>
        </header>
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar */}
        {isDesktop && (
          <aside
            className="bg-white/50 border-r border-gray-200 overflow-hidden flex flex-col"
            style={{ width: sidebarWidth }}
          >
            <div className="flex-1 overflow-y-auto">{sidebar}</div>

            {/* Resize handle */}
            {resizable && (
              <div
                className={cn(
                  'absolute top-0 bottom-0 w-1 cursor-col-resize z-10',
                  'hover:bg-blue-400/50 transition-colors',
                  isResizing && 'bg-blue-500'
                )}
                style={{ left: sidebarWidth - 2 }}
                onMouseDown={handleMouseDown}
                role="separator"
                aria-label="Resize sidebar"
              >
                <div
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2',
                    'w-4 h-8 flex items-center justify-center rounded',
                    'opacity-0 hover:opacity-100 transition-opacity',
                    isResizing && 'opacity-100'
                  )}
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Mobile Drawer Overlay */}
        {!isDesktop && mobileDrawer && drawerOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-30 transition-opacity"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer */}
            <aside
              className={cn(
                'fixed inset-y-0 left-0 z-40 w-[280px] max-w-[80vw]',
                'bg-white shadow-xl',
                'transform transition-transform duration-300 ease-out',
                drawerOpen ? 'translate-x-0' : '-translate-x-full'
              )}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between p-4 border-b">
                <span className="font-semibold text-gray-800">Navigation</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto">{sidebar}</div>
            </aside>
          </>
        )}

        {/* Content Area */}
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            isResizing && 'select-none'
          )}
        >
          {content}
        </main>
      </div>
    </div>
  );
}

/**
 * SplitPanelHeader - Convenience component for the header section.
 * Use within the header prop of SplitPanelLayout.
 */
interface SplitPanelHeaderProps {
  /** Left side content (usually back button + title) */
  left?: React.ReactNode;
  /** Center content (optional) */
  center?: React.ReactNode;
  /** Right side content (usually actions) */
  right?: React.ReactNode;
  className?: string;
}

export function SplitPanelHeader({
  left,
  center,
  right,
  className,
}: SplitPanelHeaderProps) {
  return (
    <div className={cn('flex-1 flex items-center justify-between', className)}>
      <div className="flex items-center gap-3 min-w-0 flex-1">{left}</div>
      {center && (
        <div className="hidden sm:flex items-center justify-center flex-shrink-0">
          {center}
        </div>
      )}
      <div className="flex items-center gap-2 flex-shrink-0">{right}</div>
    </div>
  );
}

/**
 * SplitPanelSidebar - Convenience component for sidebar with sticky header/footer.
 */
interface SplitPanelSidebarProps {
  /** Sticky header content */
  header?: React.ReactNode;
  /** Scrollable body content */
  children: React.ReactNode;
  /** Sticky footer content */
  footer?: React.ReactNode;
  className?: string;
}

export function SplitPanelSidebar({
  header,
  children,
  footer,
  className,
}: SplitPanelSidebarProps) {
  return (
    <nav className={cn('h-full flex flex-col', className)}>
      {/* Sticky Header */}
      {header && (
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10">
          {header}
        </div>
      )}

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto">{children}</div>

      {/* Sticky Footer */}
      {footer && (
        <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-gray-100 z-10">
          {footer}
        </div>
      )}
    </nav>
  );
}

/**
 * SplitPanelContent - Convenience component for the main content area.
 */
interface SplitPanelContentProps {
  children: React.ReactNode;
  /** Maximum width of content (default: 4xl / 56rem) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full',
};

export function SplitPanelContent({
  children,
  maxWidth = '4xl',
  className,
}: SplitPanelContentProps) {
  return (
    <div
      className={cn(
        'mx-auto px-4 sm:px-6 py-6',
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}

export default SplitPanelLayout;
