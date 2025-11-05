'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * COMPREHENSIVE Hook to prevent ALL navigation away from page with user confirmation
 *
 * Intercepts:
 * 1. Browser navigation (back/forward/refresh/close tab) - beforeunload
 * 2. Browser back/forward buttons - popstate
 * 3. ALL Next.js Link clicks - global click handler
 * 4. Programmatic router.push() calls - router patching
 *
 * @param shouldPrevent - Whether to prevent navigation (e.g., when session is 'active')
 * @param onNavigationAttempt - Callback when user tries to navigate (show modal)
 * @param allowNavigation - External flag that bypasses prevention when true
 */
export function usePreventNavigation(
  shouldPrevent: boolean,
  onNavigationAttempt: () => void,
  allowNavigation: boolean = false
) {
  const router = useRouter();
  const pathname = usePathname();
  const originalPushRef = useRef<any>(null);
  const originalReplaceRef = useRef<any>(null);
  const isConfirmedNavigationRef = useRef(false);

  // 1. Handle browser beforeunload (refresh, close tab)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldPrevent && !allowNavigation) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires this
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldPrevent, allowNavigation]);

  // 2. Handle browser back/forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      if (shouldPrevent && !allowNavigation && !isConfirmedNavigationRef.current) {
        // Push the current state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
        onNavigationAttempt();
      }
    };

    // Push initial state to enable popstate detection
    if (shouldPrevent && !allowNavigation) {
      window.history.pushState(null, '', window.location.href);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [shouldPrevent, allowNavigation, onNavigationAttempt]);

  // 3. Intercept ALL clicks on links (Next.js Link and regular <a> tags)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleClick = (e: MouseEvent) => {
      if (!shouldPrevent || allowNavigation || isConfirmedNavigationRef.current) {
        return; // Allow navigation
      }

      // Find if clicked element or any parent is a link
      let target = e.target as HTMLElement | null;
      let linkElement: HTMLAnchorElement | null = null;

      // Traverse up to find <a> tag
      while (target && target !== document.body) {
        if (target.tagName === 'A') {
          linkElement = target as HTMLAnchorElement;
          break;
        }
        target = target.parentElement;
      }

      if (!linkElement) return;

      // Allow download links (file downloads should not trigger navigation warning)
      if (linkElement.hasAttribute('download')) {
        return; // Allow download links to pass through
      }

      // Check if it's an internal navigation (same origin)
      const href = linkElement.getAttribute('href');
      if (!href) return;

      // Allow external links, anchors, and javascript: links
      if (
        href.startsWith('http') && !href.startsWith(window.location.origin) ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('blob:') || // Allow blob URLs (used for downloads)
        href.startsWith('data:')    // Allow data URLs (used for downloads)
      ) {
        return; // Allow these to pass through
      }

      // Check if it's navigating away from current page
      const currentPath = pathname;
      const targetPath = href.startsWith('/') ? href : `/${href}`;

      if (targetPath !== currentPath) {
        // This is internal navigation to a different page - intercept it!
        e.preventDefault();
        e.stopPropagation();

        // Store the intended destination
        sessionStorage.setItem('pendingNavigation', targetPath);

        // Show the modal
        onNavigationAttempt();
      }
    };

    // Capture phase to intercept before React handlers
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [shouldPrevent, allowNavigation, onNavigationAttempt, pathname]);

  // 4. Patch router.push() and router.replace() to intercept programmatic navigation
  useEffect(() => {
    if (typeof window === 'undefined' || !router) return;

    // Store original methods
    if (!originalPushRef.current) {
      originalPushRef.current = router.push;
      originalReplaceRef.current = router.replace;
    }

    if (shouldPrevent && !allowNavigation) {
      // Override router.push
      router.push = (href: string, options?: any) => {
        if (isConfirmedNavigationRef.current || allowNavigation) {
          return originalPushRef.current.call(router, href, options);
        }

        // Store and show modal
        sessionStorage.setItem('pendingNavigation', href);
        onNavigationAttempt();
        return Promise.resolve(true); // Return resolved promise to prevent errors
      };

      // Override router.replace
      router.replace = (href: string, options?: any) => {
        if (isConfirmedNavigationRef.current || allowNavigation) {
          return originalReplaceRef.current.call(router, href, options);
        }

        sessionStorage.setItem('pendingNavigation', href);
        onNavigationAttempt();
        return Promise.resolve(true);
      };
    } else {
      // Restore original methods when not preventing
      if (originalPushRef.current) {
        router.push = originalPushRef.current;
      }
      if (originalReplaceRef.current) {
        router.replace = originalReplaceRef.current;
      }
    }

    // Cleanup: restore original methods
    return () => {
      if (originalPushRef.current) {
        router.push = originalPushRef.current;
      }
      if (originalReplaceRef.current) {
        router.replace = originalReplaceRef.current;
      }
    };
  }, [shouldPrevent, allowNavigation, onNavigationAttempt, router]);

  // Update confirmed navigation ref when allowNavigation changes
  useEffect(() => {
    isConfirmedNavigationRef.current = allowNavigation;
  }, [allowNavigation]);
}
