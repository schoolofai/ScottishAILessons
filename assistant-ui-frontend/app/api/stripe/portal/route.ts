/**
 * API Route: Stripe Customer Portal Session
 *
 * Endpoint: POST /api/stripe/portal
 * Purpose: Create Stripe billing portal session for subscription management
 * Authentication: Requires active Appwrite session (httpOnly cookie)
 *
 * Contract: specs/004-stripe-subscription-paywall/contracts/04-customer-portal.md
 *
 * Following constitution principles:
 * - Fast fail: Throw exceptions for missing customer ID or inactive subscriptions
 * - No fallback mechanisms: Users without subscriptions get clear error messages
 * - No caching: Fresh database queries for current subscription state
 */

import { NextResponse } from 'next/server';
import { createSessionClient, createAdminClient, appwriteConfig } from '@/lib/server/appwrite';
import { createStripeClient } from '@/lib/stripe-helpers';
import { Query } from 'node-appwrite';

export async function POST(request: Request) {
  try {
    console.log('[Portal] Creating customer portal session...');

    // Step 1: Get authenticated user from Appwrite session (httpOnly cookie)
    let user;
    try {
      const { account } = await createSessionClient();
      user = await account.get();
    } catch (error: any) {
      console.error('[Portal] Authentication failed:', error);
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    const userId = user.$id;
    console.log(`[Portal] User authenticated: ${userId}`);

    // Step 2: Get student record to find Stripe customer ID (use admin client for database access)
    const { databases } = await createAdminClient();
    const students = await databases.listDocuments(
      appwriteConfig.databaseId,
      'students',
      [Query.equal('userId', userId)]
    );

    if (students.documents.length === 0) {
      console.error(`[Portal] No student record found for user ${userId}`);
      return NextResponse.json(
        { error: 'Student record not found. Please contact support.' },
        { status: 404 }
      );
    }

    const studentDoc = students.documents[0];
    const stripeCustomerId = studentDoc.stripeCustomerId;
    const subscriptionStatus = studentDoc.subscriptionStatus;

    console.log(`[Portal] Student subscription status: ${subscriptionStatus}`);

    // Step 3: Verify user has a Stripe customer ID
    if (!stripeCustomerId) {
      console.error(`[Portal] No Stripe customer ID for user ${userId}`);
      return NextResponse.json(
        {
          error: 'No subscription found. Please subscribe first.',
          reason: 'missing_customer_id'
        },
        { status: 400 }
      );
    }

    // Step 4: Verify subscription is active or past_due (allow portal for payment updates)
    const allowedStatuses = ['active', 'payment_failed', 'past_due', 'cancelled'];
    if (!allowedStatuses.includes(subscriptionStatus)) {
      console.error(`[Portal] Invalid subscription status: ${subscriptionStatus}`);
      return NextResponse.json(
        {
          error: 'No active subscription found. Please subscribe first.',
          reason: 'invalid_subscription_status',
          currentStatus: subscriptionStatus
        },
        { status: 400 }
      );
    }

    // Step 5: Create Stripe billing portal session
    const stripe = createStripeClient();

    // Get return URL from request or default to dashboard
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`;

    console.log(`[Portal] Creating portal session for customer ${stripeCustomerId}`);
    console.log(`[Portal] Return URL: ${returnUrl}`);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    console.log(`[Portal] ✅ Portal session created: ${portalSession.id}`);

    return NextResponse.json({
      url: portalSession.url,
      sessionId: portalSession.id
    });

  } catch (error: any) {
    console.error('[Portal] Unexpected error:', error);

    // Handle Stripe-specific errors
    if (error.type?.startsWith('Stripe')) {
      return NextResponse.json(
        {
          error: `Stripe error: ${error.message}`,
          stripeErrorType: error.type
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Portal session creation failed: ${error.message}` },
      { status: 500 }
    );
  }
}
