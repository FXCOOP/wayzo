import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email notification when a plan is ready
 * @param {string} to - Recipient email address
 * @param {string} planUrl - URL to view the plan
 */
export async function sendPlanReadyEmail(to, planUrl) {
  if (!process.env.RESEND_API_KEY) {
    console.log('⚠️  RESEND_API_KEY not set, skipping email');
    return;
  }

  try {
    const result = await resend.emails.send({
      from: 'Wayzo <hello@wayzo.online>',
      to,
      subject: '✨ Your Wayzo trip plan is ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f9fafb">
          <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 32px;text-align:center">
              <h1 style="margin:0;color:white;font-size:32px;font-weight:700">✨ Your Plan is Ready!</h1>
            </div>

            <!-- Content -->
            <div style="padding:40px 32px">
              <p style="margin:0 0 24px 0;font-size:18px;color:#1f2937;line-height:1.6">
                Great news! Your personalized travel itinerary has been generated and is ready to explore.
              </p>

              <p style="margin:0 0 32px 0;font-size:16px;color:#6b7280;line-height:1.6">
                Your plan includes detailed daily itineraries, budget breakdowns, booking recommendations, and everything you need for an amazing trip.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:40px 0">
                <a href="${planUrl}" style="display:inline-block;padding:16px 40px;background:#667eea;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:18px;box-shadow:0 4px 12px rgba(102,126,234,0.4)">
                  View My Plan →
                </a>
              </div>

              <!-- Features -->
              <div style="background:#f9fafb;border-radius:8px;padding:24px;margin:32px 0">
                <p style="margin:0 0 16px 0;font-size:14px;color:#374151;font-weight:600">Your plan includes:</p>
                <ul style="margin:0;padding:0 0 0 20px;color:#6b7280;font-size:14px;line-height:2">
                  <li>Day-by-day itinerary</li>
                  <li>Budget breakdown & recommendations</li>
                  <li>Hotel & activity booking links</li>
                  <li>Download as PDF</li>
                  <li>Export to calendar</li>
                </ul>
              </div>

              <p style="margin:32px 0 0 0;font-size:14px;color:#9ca3af;line-height:1.6">
                Saved plans are available anytime in your dashboard at
                <a href="${process.env.PUBLIC_BASE_URL}/backoffice.html" style="color:#667eea;text-decoration:none">wayzo.online/backoffice.html</a>
              </p>
            </div>

            <!-- Footer -->
            <div style="background:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb">
              <p style="margin:0;font-size:12px;color:#9ca3af">
                Made with ❤️ by <a href="${process.env.PUBLIC_BASE_URL}" style="color:#667eea;text-decoration:none">Wayzo</a>
              </p>
            </div>

          </div>
        </body>
        </html>
      `,
    });

    console.log('✅ Email sent successfully:', { to, messageId: result.id });
    return result;
  } catch (e) {
    console.error('❌ Resend email error:', e);
    // Don't throw - we don't want email failures to break the API
  }
}
