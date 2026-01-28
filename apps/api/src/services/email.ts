import nodemailer from 'nodemailer';
import crypto from 'crypto';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'noreply@acitraining.com';
const FROM_NAME = process.env.FROM_NAME || 'ACI Training Platform';

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
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to ACI Training Platform</h1>
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
          <p>© ${new Date().getFullYear()} ACI Training Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to ACI Training Platform!
    
    Hi ${name || 'there'},
    
    Thank you for signing up! Please verify your email address by visiting:
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, you can safely ignore this email.
    
    © ${new Date().getFullYear()} ACI Training Platform. All rights reserved.
  `;

  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to: email,
    subject: 'Verify your email address - ACI Training Platform',
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
    console.log('  FROM_EMAIL=noreply@acitraining.com');
    console.log('  FROM_NAME=ACI Training Platform');
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
