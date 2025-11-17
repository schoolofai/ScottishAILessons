/**
 * API Route: Get Subscription Status
 *
 * Endpoint: GET /api/stripe/subscription-status
 * Purpose: Check current user's subscription status for access control
 * Authentication: Required (Appwrite session)
 *
 * Contract: specs/004-stripe-subscription-paywall/contracts/03-subscription-status.md
 *
 * Following constitution principles:
 * - Fast fail: Throw exceptions for auth failures
 * - No caching: Fresh database query every time (security-critical)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { createSessionClient, appwriteConfig } from '@/lib/server/appwrite';
import { rateLimit, RateLimitPresets } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Step 0: Rate limiting - Prevent subscription status abuse
    // Use READ preset (more lenient) since this is a read-only operation
    const rateLimitResult = await rateLimit(request, {
      ...RateLimitPresets.READ,
      endpoint: '/api/stripe/subscription-status'
    });

    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Step 1: Authenticate and get user using SSR session client
    const user = await getUserDocument();

    // Step 2: Compute hasAccess
    const hasAccess = user.testUserFlag === true || user.subscriptionStatus === 'active';

    // Step 3: Fetch subscription details if exists
    let subscription = null;
    if (user.stripeSubscriptionId) {
      subscription = await getSubscriptionDetails(user.stripeSubscriptionId);
    }

    // Step 4: Return status response (T037)
    return NextResponse.json({
      status: user.subscriptionStatus || 'inactive',
      hasAccess,
      testUserFlag: user.testUserFlag || false,
      subscriptionExpiresAt: user.subscriptionExpiresAt || null,
      stripeCustomerId: user.stripeCustomerId || null,
      stripeSubscriptionId: user.stripeSubscriptionId || null,
      subscription
    });

  } catch (error: any) {
    console.error('[Subscription Status API] Error:', error);

    if (error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch subscription status: ${error.message}` },
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
    // Student document IDs ≠ Account IDs, so we must query by userId
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
 * Get subscription details from subscriptions collection
 */
async function getSubscriptionDetails(stripeSubscriptionId: string) {
  try {
    // Use session client to respect permissions
    const { databases } = await createSessionClient();

    const subscriptions = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.subscriptionsCollectionId,
      [Query.equal('stripeSubscriptionId', stripeSubscriptionId)]
    );

    if (subscriptions.documents.length === 0) {
      return null;
    }

    const sub = subscriptions.documents[0];

    return {
      planType: sub.planType,
      billingCycle: sub.billingCycle,
      paymentStatus: sub.paymentStatus,
      nextBillingDate: sub.nextBillingDate,
      lastPaymentDate: sub.lastPaymentDate
    };
  } catch (error) {
    console.error('[Subscription Status API] Failed to fetch subscription details:', error);
    return null; // Best-effort - return null if subscription lookup fails
  }
}
