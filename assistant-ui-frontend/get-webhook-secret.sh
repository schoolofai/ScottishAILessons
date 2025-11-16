#!/bin/bash
# Script to capture Stripe webhook secret
# This will start stripe listen and capture the initial output containing the webhook secret

echo "Starting Stripe webhook forwarding..."
echo "This will forward webhooks from Stripe to http://localhost:3000/api/stripe/webhook"
echo ""
echo "Press Ctrl+C when you're done testing to stop the webhook listener"
echo ""
echo "================================================================"
echo ""

# Run stripe listen and tee the output to both terminal and a log file
stripe listen --forward-to localhost:3000/api/stripe/webhook 2>&1 | tee stripe-webhook.log
