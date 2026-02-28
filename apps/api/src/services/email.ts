import nodemailer from 'nodemailer';
import crypto from 'crypto';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const APP_NAME = process.env.APP_NAME || 'TacticalEdge';
const DEFAULT_PROD_URL = 'https://tacticaledge.app';
const FRONTEND_URL_RAW =
  process.env.FRONTEND_URL ||
  process.env.APP_URL ||
  (process.env.NODE_ENV === 'production' ? DEFAULT_PROD_URL : 'http://localhost:3000');
const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/+$/, '');
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${FRONTEND_URL}/images/logo.png`;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'noreply@tacticaledge.app';
const FROM_NAME = process.env.FROM_NAME || APP_NAME;

if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL && !process.env.APP_URL) {
  console.warn(`[EMAIL] FRONTEND_URL not set in production, defaulting to ${DEFAULT_PROD_URL}`);
}

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  // For development, use console logging if no SMTP configured
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[EMAIL] SMTP not configured, emails will be logged to console');
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendVerificationEmail(
  email: string,
  name: string | null,
  verificationToken: string
): Promise<void> {
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { display: block; margin: 0 auto 12px; width: 72px; height: 72px; object-fit: contain; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${LOGO_URL}" alt="${APP_NAME} logo" class="logo" />
          <h1>Welcome to ${APP_NAME}</h1>
        </div>
        <div class="content">
          <p>Hi ${name || 'there'},</p>
          <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to ${APP_NAME}!
    
    Hi ${name || 'there'},
    
    Thank you for signing up! Please verify your email address by visiting:
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, you can safely ignore this email.
    
    © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
  `;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: `Verify your email address - ${APP_NAME}`,
    text,
    html,
  };

  const mailer = getTransporter();

  if (!SMTP_USER || !SMTP_PASS) {
    // Development mode: log to console with clear instructions
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[EMAIL] ⚠️  SMTP not configured - Email would be sent:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Verification URL:', verificationUrl);
    console.log('');
    console.log('To enable email sending, configure SMTP in .env:');
    console.log('  SMTP_HOST=smtp.gmail.com');
    console.log('  SMTP_PORT=587');
    console.log('  SMTP_USER=your-email@gmail.com');
    console.log('  SMTP_PASS=your-app-password');
    console.log('  FROM_EMAIL=noreply@tacticaledge.app');
    console.log(`  FROM_NAME=${APP_NAME}`);
    console.log('  FRONTEND_URL=https://tacticaledge.app');
    console.log('═══════════════════════════════════════════════════════════\n');
    // In development, we still want to create the token so users can verify manually
    // The token is already created in the calling function, so we just return here
    return;
  }

  try {
    await mailer.sendMail(mailOptions);
    console.log(`[EMAIL] Verification email sent to ${email}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function sendPasswordResetEmail(
  email: string,
  name: string | null,
  resetToken: string
): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { display: block; margin: 0 auto 12px; width: 72px; height: 72px; object-fit: contain; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${LOGO_URL}" alt="${APP_NAME} logo" class="logo" />
          <h1>Reset your password</h1>
        </div>
        <div class="content">
          <p>Hi ${name || 'there'},</p>
          <p>We received a request to reset the password for your ${APP_NAME} account.</p>
          <p>If you made this request, click the button below to choose a new password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6b7280; font-size: 12px;">${resetUrl}</p>
          <p>This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Reset your password - ${APP_NAME}

    Hi ${name || 'there'},

    We received a request to reset the password for your ${APP_NAME} account.

    If you made this request, visit this link to choose a new password:
    ${resetUrl}

    This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.

    © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
  `;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: `Reset your password - ${APP_NAME}`,
    text,
    html,
  };

  const mailer = getTransporter();

  if (!SMTP_USER || !SMTP_PASS) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[EMAIL] ⚠️  SMTP not configured - Password reset email would be sent:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('To:', email);
    console.log('Subject:', mailOptions.subject);
    console.log('Reset URL:', resetUrl);
    console.log('═══════════════════════════════════════════════════════════\n');
    return;
  }

  try {
    await mailer.sendMail(mailOptions);
    console.log(`[EMAIL] Password reset email sent to ${email}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}
