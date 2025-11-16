/**
 * API Route: Get Stripe Product Information
 *
 * Endpoint: GET /api/stripe/product-info
 * Purpose: Fetch current product price and metadata from Stripe
 * Authentication: Not required (public product information)
 *
 * Returns formatted price information for display in paywall modal
 * Implements fast-fail principle - throws on configuration errors
 *
 * Following constitution principles:
 * - Fast fail: Immediate error on missing STRIPE_PRICE_ID
 * - No caching: Fresh price fetch from Stripe each time
 * - Function limit: Endpoint handler <50 lines
 */

import { NextResponse } from 'next/server';
import { createStripeClient } from '@/lib/stripe-helpers';

export async function GET() {
  try {
    // Validate price ID configuration
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      throw new Error(
        'STRIPE_PRICE_ID environment variable is not configured. ' +
        'Add it to .env.local following specs/004-stripe-subscription-paywall/quickstart.md'
      );
    }

    // Create Stripe client and fetch price details
    const stripe = createStripeClient();
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'] // Include product metadata
    });

    // Validate price data
    if (!price.unit_amount) {
      throw new Error(`Price ${priceId} has no unit_amount configured`);
    }

    if (!price.recurring) {
      throw new Error(`Price ${priceId} is not a recurring subscription price`);
    }

    // Format amount (Stripe stores in cents/pence)
    const amount = price.unit_amount / 100;

    // Get currency symbol
    const currencySymbols: Record<string, string> = {
      'usd': '$',
      'gbp': '£',
      'eur': '€',
      'cad': 'CA$',
      'aud': 'A$',
      'jpy': '¥',
      'inr': '₹'
    };

    const symbol = currencySymbols[price.currency.toLowerCase()] ||
                   price.currency.toUpperCase() + ' ';

    // Format for display
    const formatted = `${symbol}${amount.toFixed(2)}`;

    // Extract product name if available
    const productName = typeof price.product === 'object' && price.product !== null
      ? price.product.name
      : 'Subscription';

    // Return formatted response
    return NextResponse.json({
      amount,
      currency: price.currency.toUpperCase(),
      symbol,
      formatted,
      interval: price.recurring.interval,
      intervalCount: price.recurring.interval_count || 1,
      productName,
      priceId: price.id
    });

  } catch (error: any) {
    console.error('[Product Info API] Error:', error);

    // Return appropriate error status
    if (error.message.includes('not configured')) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: `Invalid Stripe Price ID: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch product info: ${error.message}` },
      { status: 500 }
    );
  }
}
