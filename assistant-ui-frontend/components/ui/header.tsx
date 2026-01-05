"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useLogout';
import { useIsAdmin } from '@/lib/utils/adminCheck';
import { useServerAuth } from '@/hooks/useServerAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionPaywallModal, type PriceInfo } from '@/components/dashboard/SubscriptionPaywallModal';
import { GraduationCap, Settings, Crown, User } from 'lucide-react';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState<PriceInfo | null>(null);

  const router = useRouter();
  const { logout, isLoading } = useLogout();
  const { isAdmin } = useIsAdmin();
  const { isAuthenticated } = useServerAuth(); // Use server-side session check
  const { hasAccess, isLoading: isLoadingSubscription, refetch } = useSubscription();

  // Prefetch subscription price for instant modal display
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchSubscriptionPrice = async () => {
      try {
        const response = await fetch('/api/stripe/product-info');
        if (response.ok) {
          const data = await response.json();
          setSubscriptionPrice(data);
        }
      } catch (error) {
        // Silently fail - modal will use fallback price
      }
    };

    fetchSubscriptionPrice();
  }, [isAuthenticated]);

  // Force fresh subscription status check on mount to bypass SWR cache
  useEffect(() => {
    if (!isAuthenticated) return;
    refetch();
  }, [isAuthenticated, refetch]);

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
  };

  const handleLogoClick = () => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Logo/Title */}
      <div
        onClick={handleLogoClick}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleLogoClick();
          }
        }}
      >
        <GraduationCap className="h-8 w-8 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Scottish AI Lessons</h1>
      </div>

      {/* Upgrade to Pro Button - Only for authenticated non-subscribed users */}
      {isAuthenticated && !isLoadingSubscription && !hasAccess && (
        <button
          onClick={() => setShowPaywallModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
          data-testid="upgrade-button"
        >
          <Crown className="h-4 w-4" />
          <span className="hidden sm:inline">Upgrade to Pro</span>
          <span className="sm:hidden">Pro</span>
        </button>
      )}

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

              {/* Account Link */}
              <Link
                href="/account"
                onClick={() => setIsMenuOpen(false)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                data-testid="account-link"
              >
                <User className="h-4 w-4" />
                Account Settings
              </Link>

              {/* Admin Panel Link */}
              {isAdmin && (
                <>
                  <Link
                    href="/admin"
                    onClick={() => setIsMenuOpen(false)}
                    className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Admin Panel
                  </Link>
                </>
              )}

              <div className="border-b border-gray-100" />

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

      {/* Subscription Paywall Modal */}
      <SubscriptionPaywallModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        priceInfo={subscriptionPrice}
      />
    </header>
  );
}