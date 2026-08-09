import nodemailer from 'nodemailer';

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
};

export const sendMail = async ({ to, subject, text, html, attachments }) => {
  const tx = getTransporter();
  if (!tx) {
    console.log(`[email skipped — configure SMTP_HOST] To: ${to} | ${subject}`);
    return { skipped: true, reason: 'SMTP not configured' };
  }
  try {
    const info = await tx.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@payroll.local',
      to,
      subject,
      text,
      html,
      attachments,
    });
    return { skipped: false, messageId: info.messageId };
  } catch (err) {
    console.error('[email failed]', err.message);
    return { skipped: true, reason: err.message || 'send failed' };
  }
};
