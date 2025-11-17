/**
 * Subscription Paywall Modal
 *
 * Displays when non-subscribed users attempt to access AI features
 * Shows subscription benefits and redirects to Stripe Checkout
 *
 * T040: Modal component with benefits display
 * T041: Subscribe button click handler calling checkout API
 */

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export interface PriceInfo {
  amount: number;
  currency: string;
  symbol: string;
  formatted: string;
  interval: string;
  intervalCount: number;
  productName: string;
}

interface SubscriptionPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceInfo?: PriceInfo | null;
}

export function SubscriptionPaywallModal({ isOpen, onClose, priceInfo }: SubscriptionPaywallModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // T041: Call checkout API to create Stripe session
      // Authentication handled via httpOnly cookie (no client-side session needed)
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('[Paywall] Subscribe error:', err);
      setError(err.message || 'Failed to start subscription process');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Unlock AI-Powered Learning
          </h2>
          <p className="text-gray-600">
            Get unlimited access to personalized AI tutoring and interactive lessons
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-6 space-y-3">
          <BenefitItem text="Unlimited AI tutor sessions" />
          <BenefitItem text="Personalized lesson recommendations" />
          <BenefitItem text="Real-time feedback and hints" />
          <BenefitItem text="Progress tracking and mastery assessment" />
        </div>

        {/* Pricing */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-baseline justify-center">
            <span className="text-3xl font-bold text-blue-900">
              {priceInfo?.formatted || '£9.99'}
            </span>
            <span className="text-gray-600 ml-2">
              /{priceInfo?.interval || 'month'}
            </span>
          </div>
          <p className="text-center text-sm text-gray-600 mt-1">
            Cancel anytime
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Subscribe button */}
        <button
          onClick={handleSubscribe}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          data-testid="subscribe-btn"
        >
          {isLoading ? 'Redirecting to checkout...' : 'Subscribe Now'}
        </button>

        {/* Security note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Secure payment processing powered by Stripe
        </p>
      </div>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex items-start">
      <svg
        className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-gray-700">{text}</span>
    </div>
  );
}
