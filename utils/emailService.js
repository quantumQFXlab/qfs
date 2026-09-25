// utils/emailService.js
const nodemailer = require('nodemailer');

// ========== TRANSPORTER ==========
let transporter;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false }
  });

  transporter.verify((err) => {
    if (err) console.error('❌ SMTP verify failed:', err.message);
    else     console.log('✅ SMTP server ready');
  });
} else {
  console.warn('⚠️  No SMTP credentials. Emails will be logged only.');
  transporter = {
    sendMail: async (opts) => {
      console.log('\n=== [MOCK EMAIL] ===');
      console.log('To:', opts.to);
      console.log('Subject:', opts.subject);
      console.log('HTML length:', opts.html?.length || 0);
      console.log('====================\n');
      return { messageId: 'mock-' + Date.now() };
    }
  };
}

// ========== CONSTANTS ==========
const FROM_EMAIL = process.env.FROM_EMAIL || '"QFS" <quantums747@gmail.com>';
const APP_URL    = process.env.APP_URL    || 'http://localhost:3000';
const APP_NAME   = 'Quantum Financial System';
const YEAR       = new Date().getFullYear();

// ========== SHARED HTML WRAPPER ==========
const wrapHtml = ({ title, heading, body, ctaText, ctaUrl, signature, footerNote }) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title || heading || APP_NAME}</title>
<style>
  body { margin:0; padding:0; background:#f4f6fb; font-family:'Segoe UI',Arial,sans-serif; color:#222; }
  .wrap { max-width:600px; margin:30px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.05); }
  .head { background:linear-gradient(135deg,#4b59f5 0%,#6b7aff 100%); padding:28px; text-align:center; }
  .head h1 { margin:0; color:#fff; font-size:22px; letter-spacing:2px; font-weight:800; }
  .head p  { margin:6px 0 0; color:rgba(255,255,255,0.9); font-size:12px; }
  .body { padding:32px 30px; font-size:15px; line-height:1.6; color:#333; }
  .body h2 { color:#0044ff; margin:0 0 12px; font-size:22px; font-weight:700; }
  .body p { margin:0 0 16px; color:#444; }
  .body a { color:#0044ff; }
  .body img { max-width:100%; border-radius:8px; }
  .body ul, .body ol { color:#444; padding-left:20px; }
  .body li { margin-bottom:8px; }
  .btn { display:inline-block; background:#0044ff; color:#fff !important; padding:14px 28px; border-radius:8px; text-decoration:none; font-weight:600; }
  .cta-box { text-align:center; margin:32px 0; }
  .code { background:#f4f6fb; border:1px dashed #0044ff; border-radius:8px; padding:20px; text-align:center; margin:20px 0; }
  .code span { font-family:monospace; font-size:28px; font-weight:700; letter-spacing:8px; color:#0044ff; }
  .divider { height:1px; background:#eee; margin:24px 0; }
  .foot { background:#f9f9f9; padding:20px 30px; text-align:center; color:#888; font-size:12px; }
  .foot a { color:#888; text-decoration:none; margin:0 6px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>QFS</h1>
    <p>${APP_NAME}</p>
  </div>
  <div class="body">
    ${heading ? `<h2>${heading}</h2>` : ''}
    ${body}
    ${ctaText && ctaUrl ? `
      <div class="cta-box">
        <a href="${ctaUrl}" class="btn">${ctaText} →</a>
      </div>
    ` : ''}
    ${signature ? `<div class="divider"></div><p style="font-size:13px;">${signature}</p>` : ''}
  </div>
  <div class="foot">
    <p style="margin:0 0 8px;">© ${YEAR} ${APP_NAME}. All rights reserved.</p>
    <p style="margin:0;">
      <a href="${APP_URL}/dashboard">Dashboard</a> |
      <a href="${APP_URL}/profile">Profile</a> |
      <a href="${APP_URL}/support">Support</a>
    </p>
    ${footerNote ? `<p style="margin:12px 0 0; color:#aaa; font-size:11px;">${footerNote}</p>` : ''}
  </div>
</div>
</body>
</html>
`;

// ========== CORE SEND ==========
const sendMail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html
    });
    console.log(`✅ Email sent to ${to} [${info.messageId}]`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

// ========== 1. WELCOME EMAIL ==========
const sendWelcomeEmail = async (user) => {
  const html = wrapHtml({
    title: 'Welcome to QFS',
    heading: `Welcome aboard, ${user.firstName || 'there'}! 🎉`,
    body: `
      <p>Your QFS account is now fully verified and ready to use.</p>
      <p>Here's what you can do right away:</p>
      <ul>
        <li>Manage multi-currency wallets (USD, BTC, ETH, and more)</li>
        <li>Send and receive money instantly</li>
        <li>Track investments and transactions in real time</li>
        <li>Access 24/7 support from your dashboard</li>
      </ul>
      <p>Need help getting started? Visit our <a href="${APP_URL}/support">Support Center</a> or reply to this email.</p>
      <p>Welcome to the future of finance,<br><strong>The QFS Team</strong></p>
    `,
    ctaText: 'Go to Dashboard',
    ctaUrl: `${APP_URL}/dashboard`
  });

  return sendMail({
    to: user.email,
    subject: `🎉 Welcome to ${APP_NAME}, ${user.firstName || 'Friend'}!`,
    html
  });
};

// ========== 2. EMAIL VERIFICATION ==========
const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${APP_URL}/profile/verify?token=${token}`;
  const html = wrapHtml({
    title: 'Verify Your Email',
    heading: 'Verify your email address',
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>Thanks for signing up with QFS. Please confirm your email address by entering the code below:</p>
      <div class="code"><span>${token}</span></div>
      <p style="color:#888;font-size:13px;">This code expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
    `,
    ctaText: 'Verify Now',
    ctaUrl: verifyUrl
  });

  return sendMail({
    to: user.email,
    subject: 'Verify your QFS account',
    html
  });
};

const sendVerificationResendEmail = async (user, token) => sendVerificationEmail(user, token);

// ========== 3. PASSWORD RESET ==========
const sendPasswordResetEmail = async (user, token) => {
  // If no token, send password-changed confirmation
  if (!token) {
    const html = wrapHtml({
      title: 'Password Changed',
      heading: 'Your password was changed ✅',
      body: `
        <p>Hi ${user.firstName || 'there'},</p>
        <p>Your QFS account password was successfully updated.</p>
        <p>If you didn't make this change, please contact support immediately:
          <a href="${APP_URL}/support">Support Center</a>.
        </p>
      `,
      ctaText: 'Open Dashboard',
      ctaUrl: `${APP_URL}/dashboard`
    });
    return sendMail({
      to: user.email,
      subject: 'Your QFS password was changed',
      html
    });
  }

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const html = wrapHtml({
    title: 'Reset Your Password',
    heading: 'Reset your password 🔒',
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>We received a request to reset your QFS account password. Click the button below to choose a new one:</p>
      <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request a password reset, please ignore this email — your password will remain unchanged.</p>
      <p style="color:#888;font-size:13px;">For security, never share this link with anyone.</p>
    `,
    ctaText: 'Reset Password',
    ctaUrl: resetUrl
  });

  return sendMail({
    to: user.email,
    subject: 'Reset your QFS password',
    html
  });
};

// ========== 4. PROMOTIONAL EMAIL ==========
const sendPromotionalEmail = async (user, promotion) => {
  const html = wrapHtml({
    title: promotion.title || promotion.subject,
    heading: promotion.title || promotion.subject,
    body: `
      ${promotion.promoImage ? `<div style="text-align:center;margin-bottom:16px;"><img src="${promotion.promoImage}" alt="${promotion.title}" style="max-width:100%;border-radius:8px;"></div>` : ''}
      <p>Hi ${user.firstName || 'there'},</p>
      <div>${promotion.content}</div>
      <p>This offer was selected for you.</p>
      <p>Best regards,<br><strong>The QFS Team</strong></p>
    `,
    ctaText: promotion.ctaText || 'Open Dashboard',
    ctaUrl: promotion.ctaUrl || `${APP_URL}/dashboard`
  });

  return sendMail({
    to: user.email,
    subject: promotion.subject,
    html
  });
};

// ========== 5. CUSTOM (ADMIN-COMPOSED) ==========
const sendCustomEmail = async (user, data) => {
  const html = wrapHtml({
    title: data.heading || data.subject,
    heading: data.heading,
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <div>${data.bodyHtml}</div>
    `,
    ctaText: data.ctaText || null,
    ctaUrl: data.ctaUrl || null,
    signature: data.signature || 'The QFS Team',
    footerNote: "You're receiving this because you have a QFS account."
  });

  return sendMail({
    to: user.email,
    subject: data.subject,
    html
  });
};

// ========== 6. BULK SENDER ==========
const sendBulkCustomEmail = async (users, data, onProgress) => {
  const results = { sent: 0, failed: 0, errors: [] };
  const CONCURRENCY = 5;

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(u => sendCustomEmail(u, data))
    );

    batchResults.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value.success) results.sent++;
      else {
        results.failed++;
        results.errors.push({
          email: batch[idx].email,
          error: r.status === 'rejected' ? r.reason : r.value?.error
        });
      }
    });

    if (onProgress) onProgress(results.sent + results.failed, users.length);
  }

  return results;
};

// ========== 7. DEPOSIT CONFIRMATION ==========
const sendDepositConfirmation = async (user, { amount, currency, method, txId, newBalance }) => {
  const html = wrapHtml({
    title: 'Deposit Received',
    heading: 'Deposit confirmed 💰',
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>Your deposit has been received and credited to your wallet.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:10px;color:#888;">Amount</td><td style="padding:10px;text-align:right;font-weight:600;">${amount} ${currency}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:10px;color:#888;">Method</td><td style="padding:10px;text-align:right;font-weight:600;">${method}</td></tr>
        <tr><td style="padding:10px;color:#888;">Transaction ID</td><td style="padding:10px;text-align:right;font-family:monospace;font-size:12px;">${txId}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:10px;color:#888;">New Balance</td><td style="padding:10px;text-align:right;font-weight:600;">${newBalance} ${currency}</td></tr>
      </table>
    `,
    ctaText: 'View Transaction',
    ctaUrl: `${APP_URL}/transactions`
  });

  return sendMail({
    to: user.email,
    subject: `Deposit received — ${amount} ${currency}`,
    html
  });
};

// ========== 8. WITHDRAWAL UPDATE ==========
const sendWithdrawalEmail = async (user, { amount, currency, method, txId, status }) => {
  const statusColor = status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#f59e0b';
  const html = wrapHtml({
    title: 'Withdrawal Update',
    heading: `Withdrawal ${status} 💸`,
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>Your withdrawal request has been <strong style="color:${statusColor};">${status}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:10px;color:#888;">Amount</td><td style="padding:10px;text-align:right;font-weight:600;">${amount} ${currency}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:10px;color:#888;">Method</td><td style="padding:10px;text-align:right;font-weight:600;">${method}</td></tr>
        <tr><td style="padding:10px;color:#888;">Transaction ID</td><td style="padding:10px;text-align:right;font-family:monospace;font-size:12px;">${txId}</td></tr>
      </table>
    `,
    ctaText: 'View Transactions',
    ctaUrl: `${APP_URL}/transactions`
  });

  return sendMail({
    to: user.email,
    subject: `Withdrawal ${status} — ${amount} ${currency}`,
    html
  });
};

// ========== 9. MONEY TRANSFER NOTIFICATION ==========
const sendTransferEmail = async (user, { amount, currency, from, direction, txId }) => {
  const isIncoming = direction === 'incoming';
  const html = wrapHtml({
    title: 'Money Transfer',
    heading: `${isIncoming ? 'Money received' : 'Money sent'} 🔄`,
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>${isIncoming ? 'You received' : 'You sent'} a transfer on QFS:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:10px;color:#888;">Amount</td><td style="padding:10px;text-align:right;font-weight:600;">${amount} ${currency}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:10px;color:#888;">${isIncoming ? 'From' : 'To'}</td><td style="padding:10px;text-align:right;font-weight:600;">${from}</td></tr>
        <tr><td style="padding:10px;color:#888;">Transaction ID</td><td style="padding:10px;text-align:right;font-family:monospace;font-size:12px;">${txId}</td></tr>
      </table>
    `,
    ctaText: 'View Transfer',
    ctaUrl: `${APP_URL}/transactions`
  });

  return sendMail({
    to: user.email,
    subject: isIncoming ? `You received ${amount} ${currency}` : `Transfer sent — ${amount} ${currency}`,
    html
  });
};

// ========== 10. KYC STATUS ==========
const sendKycStatusEmail = async (user, { status, reason }) => {
  const statusColor = status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#f59e0b';
  const html = wrapHtml({
    title: 'KYC Status',
    heading: `Identity verification ${status}`,
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>Your identity verification has been <strong style="color:${statusColor};">${status}</strong>.</p>
      ${reason ? `<p style="color:#888;font-size:13px;"><strong>Reason:</strong> ${reason}</p>` : ''}
      ${status === 'approved' ? '<p>Your account now has full access to all QFS features. 🎉</p>' : ''}
      ${status === 'rejected' ? '<p>Please resubmit the required documents from your profile page.</p>' : ''}
    `,
    ctaText: status === 'rejected' ? 'Resubmit Documents' : 'Open Dashboard',
    ctaUrl: status === 'rejected' ? `${APP_URL}/verification` : `${APP_URL}/dashboard`
  });

  return sendMail({
    to: user.email,
    subject: `KYC verification ${status}`,
    html
  });
};

// ========== 11. SUPPORT TICKET CREATED ==========
const sendSupportTicketEmail = async (user, { ticketId, subject, priority, message }) => {
  const html = wrapHtml({
    title: 'Support Ticket',
    heading: 'Support ticket created 🎫',
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>We've received your support ticket and our team will respond shortly.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr><td style="padding:10px;color:#888;">Ticket ID</td><td style="padding:10px;text-align:right;font-family:monospace;">${ticketId}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:10px;color:#888;">Subject</td><td style="padding:10px;text-align:right;">${subject}</td></tr>
        <tr><td style="padding:10px;color:#888;">Priority</td><td style="padding:10px;text-align:right;">${priority}</td></tr>
      </table>
      <div style="background:#f9f9f9;border-left:3px solid #0044ff;padding:14px;border-radius:6px;color:#444;">${message}</div>
    `,
    ctaText: 'View Ticket',
    ctaUrl: `${APP_URL}/tickets/${ticketId}`
  });

  return sendMail({
    to: user.email,
    subject: `[QFS Support] ${subject} (${ticketId})`,
    html
  });
};

// ========== 12. SUPPORT TICKET REPLY ==========
const sendSupportReplyEmail = async (user, { ticketId, subject, reply }) => {
  const html = wrapHtml({
    title: 'Support Reply',
    heading: 'New reply on your ticket 💬',
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>Our support team has responded to your ticket <strong>${ticketId}</strong>:</p>
      <div style="background:#f4f6fb;border-radius:8px;padding:16px;margin:16px 0;color:#444;">${reply}</div>
    `,
    ctaText: 'View Conversation',
    ctaUrl: `${APP_URL}/tickets/${ticketId}`
  });

  return sendMail({
    to: user.email,
    subject: `Reply to your ticket — ${subject}`,
    html
  });
};

// ========== 13. ACCOUNT DEACTIVATED ==========
const sendAccountDeactivatedEmail = async (user, reason) => {
  const html = wrapHtml({
    title: 'Account Deactivated',
    heading: 'Your account has been deactivated',
    body: `
      <p>Hi ${user.firstName || 'there'},</p>
      <p>Your QFS account has been deactivated by an administrator.</p>
      ${reason ? `<p style="color:#888;"><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>If you believe this is a mistake, please contact support:
        <a href="${APP_URL}/support">Support Center</a>.
      </p>
    `,
    ctaText: 'Contact Support',
    ctaUrl: `${APP_URL}/support`
  });

  return sendMail({
    to: user.email,
    subject: 'Your QFS account has been deactivated',
    html
  });
};

// ========== EXPORTS ==========
module.exports = {
  sendMail,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendVerificationResendEmail,
  sendPasswordResetEmail,
  sendPromotionalEmail,
  sendCustomEmail,
  sendBulkCustomEmail,
  sendDepositConfirmation,
  sendWithdrawalEmail,
  sendTransferEmail,
  sendKycStatusEmail,
  sendSupportTicketEmail,
  sendSupportReplyEmail,
  sendAccountDeactivatedEmail
};