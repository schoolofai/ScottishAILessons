/**
 * API Route: Create Stripe Checkout Session
 *
 * Endpoint: POST /api/stripe/checkout
 * Purpose: Create Stripe Checkout Session for monthly subscription purchase
 * Authentication: Required (Appwrite session)
 *
 * Contract: specs/004-stripe-subscription-paywall/contracts/01-create-checkout-session.md
 *
 * Following constitution principles:
 * - Fast fail: Throw exceptions for missing config or invalid state
 * - No fallback mechanisms: Immediate error on auth failure
 * - No caching: Fresh data queries for each request
 */

import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createStripeClient } from '@/lib/stripe-helpers';
import { createSessionClient, appwriteConfig } from '@/lib/server/appwrite';
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Step 0: Rate limiting - Prevent checkout session abuse
    // MUST come before authentication to prevent brute force attempts
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.PAYMENT,
      endpoint: '/api/stripe/checkout'
    });

    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Step 1: Authenticate and get user using SSR session client
    const user = await getUserDocument();

    // Step 2: Validate environment configuration
    validateStripeConfig();

    // Step 3: Check user doesn't already have active subscription
    await checkExistingSubscription(user);

    // Step 4: Create Stripe Checkout Session
    const session = await createCheckoutSession(user);

    // Step 5: Return session ID and redirect URL
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url!
    });

  } catch (error: any) {
    console.error('[Checkout API] Error:', error);

    // Differentiate error types for appropriate status codes
    if (error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error.message.includes('already has an active subscription')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: `Failed to create checkout session: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Get user document with subscription status
 * Uses SSR session client - automatically handles authentication
 * @throws {Error} If user not authenticated or document cannot be fetched
 */
async function getUserDocument() {
  // createSessionClient() throws if no session found
  const { account, databases } = await createSessionClient();

  try {
    const user = await account.get();

    // Query students collection by userId field
    // Session client respects row-level permissions
    const students = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.studentsCollectionId,
      [Query.equal('userId', user.$id)]
    );

    if (students.documents.length === 0) {
      throw new Error(`No student record found for user ${user.$id}`);
    }

    return students.documents[0];
  } catch (error: any) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
}

/**
 * Validate required Stripe environment variables
 * @throws {Error} If STRIPE_PRICE_ID or NEXT_PUBLIC_APP_URL is missing
 */
function validateStripeConfig() {
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!priceId) {
    throw new Error(
      'STRIPE_PRICE_ID environment variable is not configured. ' +
      'Follow specs/004-stripe-subscription-paywall/quickstart.md to set up Stripe product.'
    );
  }

  if (!appUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL environment variable is not configured. ' +
      'Add it to .env.local (e.g., http://localhost:3000)'
    );
  }
}

/**
 * Check if user already has an active subscription
 * @throws {Error} If user subscription status is 'active'
 */
async function checkExistingSubscription(userDoc: any) {
  if (userDoc.subscriptionStatus === 'active') {
    throw new Error('User already has an active subscription');
  }
}

/**
 * Create Stripe Checkout Session for subscription purchase
 */
async function createCheckoutSession(user: any) {
  const stripe = createStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    client_reference_id: user.userId, // Auth account ID from student document
    line_items: [{
      price: process.env.STRIPE_PRICE_ID!,
      quantity: 1,
    }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
    metadata: {
      userId: user.userId, // Auth account ID for webhook processing
      subscriptionType: 'monthly_ai_access',
      environment: process.env.NODE_ENV || 'development'
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required'
  });

  return session;
}
