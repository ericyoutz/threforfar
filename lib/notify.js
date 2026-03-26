/**
 * Notification helper — Resend (email) + Twilio (SMS)
 *
 * Both functions are fire-and-forget safe: call without await in API routes
 * so notifications never block the response.
 *
 * Required env vars:
 *   RESEND_API_KEY          — from resend.com
 *   RESEND_FROM_EMAIL       — verified sender address, e.g. notifications@yourdomain.com
 *   TWILIO_ACCOUNT_SID      — from twilio.com console
 *   TWILIO_AUTH_TOKEN       — from twilio.com console
 *   TWILIO_FROM_NUMBER      — your Twilio phone number in E.164 format, e.g. +15550001234
 */

// ── Email via Resend ──────────────────────────────────────────────────────────

export async function sendEmailNotification({ to, senderName, chatTitle, messageText }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from = process.env.RESEND_FROM_EMAIL || 'notifications@storycrafter.app';
  const preview = messageText.length > 200 ? messageText.slice(0, 200) + '…' : messageText;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from,
      to,
      subject: `New message in "${chatTitle}"`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
          <div style="background:#111827;color:white;padding:16px 20px;border-radius:12px 12px 0 0">
            <strong style="font-size:18px">StoryCrafter</strong>
          </div>
          <div style="background:#f8fafc;border:1px solid #dbe3ee;border-top:none;padding:24px;border-radius:0 0 12px 12px">
            <p style="margin:0 0 12px">
              <strong>${senderName}</strong> posted a new message in <strong>${chatTitle}</strong>:
            </p>
            <blockquote style="border-left:3px solid #111827;margin:0;padding:12px 16px;background:white;border-radius:0 8px 8px 0;color:#374151">
              ${preview}
            </blockquote>
            <p style="margin:16px 0 0;font-size:13px;color:#64748b">
              Sign in to StoryCrafter to read the full thread and reply.
            </p>
          </div>
        </div>
      `
    });
  } catch (err) {
    console.error('[notify] Email failed:', err?.message || err);
  }
}

// ── SMS via Twilio ────────────────────────────────────────────────────────────

export async function sendSmsNotification({ to, senderName, chatTitle, messageText }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) return;

  // Keep SMS under 160 chars (single segment)
  const preview = messageText.length > 80 ? messageText.slice(0, 80) + '…' : messageText;
  const body = `[StoryCrafter] ${senderName} in "${chatTitle}": ${preview}`;

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(sid, token);
    await client.messages.create({ body, from, to });
  } catch (err) {
    console.error('[notify] SMS failed:', err?.message || err);
  }
}

// ── Combined notifier ─────────────────────────────────────────────────────────

/**
 * Notify all members of a chat about a new message.
 *
 * @param {object} opts
 * @param {object} opts.sender      - User object (id, name, email)
 * @param {object} opts.chat        - Chat object (id, title)
 * @param {string} opts.messageText - The message body
 * @param {Array}  opts.members     - Array of User objects with { email, profile: { phone } }
 */
export async function notifyNewMessage({ sender, chat, messageText, members }) {
  const recipients = members.filter((m) => m.id !== sender.id);
  if (!recipients.length) return;

  const notifications = recipients.flatMap((recipient) => {
    const tasks = [];

    if (recipient.email) {
      tasks.push(
        sendEmailNotification({
          to: recipient.email,
          senderName: sender.name,
          chatTitle: chat.title,
          messageText
        })
      );
    }

    const phone = recipient.profile?.phone;
    if (phone) {
      tasks.push(
        sendSmsNotification({
          to: phone,
          senderName: sender.name,
          chatTitle: chat.title,
          messageText
        })
      );
    }

    return tasks;
  });

  // Fire-and-forget — don't await so the API response is never delayed
  Promise.allSettled(notifications).catch(() => {});
}
