import nodemailer from 'nodemailer';
import { env } from '../config/env';

interface LoginAlertOptions {
    to: string;
    userName: string;
    ipAddress?: string;
    userAgent?: string;
    loginTime?: Date;
}

interface GenericEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

// Create reusable transporter
const createTransporter = () => {
    if (!env.SMTP_USER || !env.SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE, // true for 465, false for other ports
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    });
};

/**
 * Send a generic transactional email
 */
export async function sendEmail(options: GenericEmailOptions): Promise<boolean> {
    const transporter = createTransporter();

    if (!transporter) {
        console.log(`📨 [Email Service - Fallback Mode] (SMTP not configured in .env)`);
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);
        return true;
    }

    try {
        await transporter.sendMail({
            from: env.EMAIL_FROM,
            to: options.to,
            subject: options.subject,
            text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
            html: options.html,
        });
        console.log(`📧 Email sent successfully to ${options.to}`);
        return true;
    } catch (error: any) {
        console.error(`❌ Failed to send email to ${options.to}:`, error?.message || error);
        return false;
    }
}

/**
 * Send Login Security Alert Email
 */
export async function sendLoginAlertEmail(options: LoginAlertOptions): Promise<boolean> {
    const timeFormatted = (options.loginTime || new Date()).toLocaleString('en-US', {
        timeZone: 'UTC',
        dateStyle: 'full',
        timeStyle: 'long',
    });

    const subject = `🛡️ Security Alert: New Login to CityCare Pro`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
            .header p { margin: 6px 0 0 0; opacity: 0.9; font-size: 14px; }
            .content { padding: 32px 24px; }
            .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
            .info-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; }
            .info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px dashed #e2e8f0; }
            .info-row:last-child { border-bottom: none; }
            .label { color: #64748b; font-weight: 500; }
            .value { font-weight: 600; color: #0f172a; }
            .warning { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #991b1b; margin-top: 24px; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>CityCare Pro</h1>
                <p>Municipal Complaint & Citizen Service Platform</p>
            </div>
            <div class="content">
                <div class="greeting">Hello ${options.userName},</div>
                <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                    A new sign-in was detected on your CityCare Pro municipal account. Here are the security details:
                </p>

                <div class="info-box">
                    <div class="info-row">
                        <span class="label">Date & Time:</span>
                        <span class="value">${timeFormatted}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">IP Address:</span>
                        <span class="value">${options.ipAddress || 'Unknown / Localhost'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Device / Agent:</span>
                        <span class="value">${options.userAgent ? options.userAgent.substring(0, 45) + '...' : 'Web Browser'}</span>
                    </div>
                </div>

                <div class="warning">
                    <strong>Was this you?</strong> If you recently logged into CityCare Pro, you can safely disregard this message. If you did not log in, please reset your password immediately or contact municipal support.
                </div>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} CityCare Pro Municipal Services. Automated Security Notification.
            </div>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to: options.to,
        subject,
        html,
    });
}
