import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
  DEFAULT_PROD_URL;
const FRONTEND_URL = FRONTEND_URL_RAW.replace(/\/+$/, '');
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${FRONTEND_URL}/images/tacticaledge-emblem.png`;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'noreply@tacticaledge.app';
const FROM_NAME = process.env.FROM_NAME || APP_NAME;
const EMAIL_LOGO_CID = 'tacticaledge-logo';

function getEmailLogoAttachment():
  | { filename: string; path: string; cid: string }
  | null {
  const candidates = [
    path.resolve(__dirname, '../../../web/public/images/tacticaledge-emblem.png'),
    path.resolve(__dirname, '../../../web/public/images/TacticalEdge_Emblem.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return {
        filename: path.basename(candidate),
        path: candidate,
        cid: EMAIL_LOGO_CID,
      };
    }
  }

  return null;
}

if (!process.env.FRONTEND_URL && !process.env.APP_URL) {
  console.warn(`[EMAIL] FRONTEND_URL not set, defaulting to ${DEFAULT_PROD_URL}`);
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
  const logoAttachment = getEmailLogoAttachment();
  const logoSrc = logoAttachment ? `cid:${EMAIL_LOGO_CID}` : LOGO_URL;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { display: block; margin: 0 auto 12px; width: 96px; height: 96px; object-fit: contain; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoSrc}" alt="${APP_NAME} logo" class="logo" />
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
    attachments: logoAttachment ? [logoAttachment] : [],
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
  const logoAttachment = getEmailLogoAttachment();
  const logoSrc = logoAttachment ? `cid:${EMAIL_LOGO_CID}` : LOGO_URL;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .logo { display: block; margin: 0 auto 12px; width: 96px; height: 96px; object-fit: contain; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoSrc}" alt="${APP_NAME} logo" class="logo" />
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
    attachments: logoAttachment ? [logoAttachment] : [],
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

export async function sendNewAccountAlertEmail(
  recipients: string[],
  account: {
    userId: string;
    email: string;
    name?: string | null;
    role?: string | null;
    subscriptionPlan?: string | null;
    source: string;
    createdAt: string;
    createdByEmail?: string | null;
  }
): Promise<void> {
  const to = recipients
    .map((value) => value?.trim().toLowerCase())
    .filter((value) => Boolean(value));

  if (to.length === 0) {
    console.warn('[EMAIL] New account alert skipped: no recipients configured');
    return;
  }

  const subject = `New TacticalEdge account: ${account.email}`;
  const displayName = account.name?.trim() || 'Not provided';
  const createdBy = account.createdByEmail || 'Self-signup';

  const text = [
    'A new account was created in TacticalEdge.',
    '',
    `Email: ${account.email}`,
    `Name: ${displayName}`,
    `Role: ${account.role || 'TRIAL'}`,
    `Plan: ${account.subscriptionPlan || 'TRIAL'}`,
    `Source: ${account.source}`,
    `Created by: ${createdBy}`,
    `Created at: ${account.createdAt}`,
    `User ID: ${account.userId}`,
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a; }
        .container { max-width: 680px; margin: 0 auto; padding: 20px; }
        .header { background: #0f766e; color: #ecfeff; padding: 16px 20px; border-radius: 8px 8px 0 0; }
        .content { border: 1px solid #cbd5e1; border-top: 0; border-radius: 0 0 8px 8px; padding: 18px 20px; background: #f8fafc; }
        .row { margin: 6px 0; }
        .label { color: #334155; font-weight: 600; margin-right: 6px; }
        code { background: #e2e8f0; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New Account Created</h2>
        </div>
        <div class="content">
          <div class="row"><span class="label">Email:</span> ${account.email}</div>
          <div class="row"><span class="label">Name:</span> ${displayName}</div>
          <div class="row"><span class="label">Role:</span> ${account.role || 'TRIAL'}</div>
          <div class="row"><span class="label">Plan:</span> ${account.subscriptionPlan || 'TRIAL'}</div>
          <div class="row"><span class="label">Source:</span> ${account.source}</div>
          <div class="row"><span class="label">Created by:</span> ${createdBy}</div>
          <div class="row"><span class="label">Created at:</span> ${account.createdAt}</div>
          <div class="row"><span class="label">User ID:</span> <code>${account.userId}</code></div>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: to.join(','),
    subject,
    text,
    html,
  };

  const mailer = getTransporter();

  if (!SMTP_USER || !SMTP_PASS) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[EMAIL] ⚠️  SMTP not configured - New account alert would be sent:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    console.log(text);
    console.log('═══════════════════════════════════════════════════════════\n');
    return;
  }

  try {
    await mailer.sendMail(mailOptions);
    console.log(`[EMAIL] New account alert sent to ${mailOptions.to}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send new account alert email:', error);
    throw new Error('Failed to send new account alert email');
  }
}
