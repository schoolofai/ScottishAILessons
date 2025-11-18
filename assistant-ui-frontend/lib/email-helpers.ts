/**
 * Email helper functions for sending transactional emails.
 *
 * Currently implemented as stubs that log to console.
 * To integrate with an actual email service (Resend/SendGrid),
 * replace the stub implementations with API calls.
 *
 * All functions follow best-effort pattern:
 * - Catch all errors
 * - Log failures with details
 * - Never throw (to avoid disrupting main flow)
 */

// Email template types for future email service integration
type EmailTemplate = 'payment-failed' | 'subscription-cancelled';

interface EmailData {
  to: string;
  template: EmailTemplate;
  variables: Record<string, string>;
}

/**
 * Core email sending function (stub implementation).
 * Replace with actual email service integration (Resend/SendGrid).
 */
async function sendEmail(data: EmailData): Promise<void> {
  // Stub implementation - log the email that would be sent
  console.log('[Email] Would send email:', {
    to: data.to,
    template: data.template,
    variables: data.variables,
    timestamp: new Date().toISOString()
  });

  // Simulate async operation
  await Promise.resolve();

  // Future implementation example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'Scottish AI Lessons <noreply@scottishailessons.com>',
  //   to: data.to,
  //   subject: getSubjectForTemplate(data.template),
  //   html: renderTemplate(data.template, data.variables)
  // });
}

/**
 * Send payment failure notification email.
 * Notifies user that their payment method failed.
 *
 * @param userEmail - User's email address
 * @param userName - User's display name
 */
export async function sendPaymentFailedEmail(
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    await sendEmail({
      to: userEmail,
      template: 'payment-failed',
      variables: {
        userName,
        updatePaymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings/billing`,
        supportEmail: 'support@scottishailessons.com'
      }
    });

    console.log('[Email] Payment failed notification sent successfully', {
      recipient: userEmail,
      userName
    });
  } catch (error) {
    // Best-effort: log failure but DO NOT throw
    console.error('[Email] Failed to send payment failed notification:', {
      error: error instanceof Error ? error.message : String(error),
      recipient: userEmail,
      userName,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Send subscription cancellation confirmation email.
 * Confirms that user's subscription has been cancelled.
 *
 * @param userEmail - User's email address
 * @param userName - User's display name
 */
export async function sendSubscriptionCancelledEmail(
  userEmail: string,
  userName: string
): Promise<void> {
  try {
    await sendEmail({
      to: userEmail,
      template: 'subscription-cancelled',
      variables: {
        userName,
        resubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing`,
        supportEmail: 'support@scottishailessons.com'
      }
    });

    console.log('[Email] Subscription cancelled confirmation sent successfully', {
      recipient: userEmail,
      userName
    });
  } catch (error) {
    // Best-effort: log failure but DO NOT throw
    console.error('[Email] Failed to send subscription cancelled confirmation:', {
      error: error instanceof Error ? error.message : String(error),
      recipient: userEmail,
      userName,
      timestamp: new Date().toISOString()
    });
  }
}
