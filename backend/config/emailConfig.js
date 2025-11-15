const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Your verified sender email
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev'; // Use resend.dev for testing

/**
 * Send email using Resend
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
const sendEmail = async (to, subject, html) => {
  try {
    console.log(`📧 Sending email to ${to}...`);
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw new Error(error.message);
    }

    console.log('✅ Email sent successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
};

// Email templates (keep your existing templates)
const emailTemplates = {
  verificationOTP: (otp, userName) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        <div class="content">
          <p>Hello ${userName || 'User'},</p>
          <p>Thank you for registering with FixItPH! Please use the following OTP to verify your email address:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
          </div>
          <p>This OTP will expire in <strong>10 minutes</strong>.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <div class="footer">
            <p>This is an automated email from FixItPH. Please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordReset: (resetToken, userName) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello ${userName || 'User'},</p>
          <p>You requested to reset your password. Click the button below to proceed:</p>
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}" class="button">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">
            ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}
          </p>
          <p>This link will expire in <strong>1 hour</strong>.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <div class="footer">
            <p>This is an automated email from FixItPH. Please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,

  reportStatusUpdate: (reportTitle, newStatus, userName) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Report Status Update</h1>
        </div>
        <div class="content">
          <p>Hello ${userName || 'User'},</p>
          <p>Your report "<strong>${reportTitle}</strong>" has been updated:</p>
          <div style="text-align: center;">
            <span class="status-badge" style="background: #4CAF50; color: white;">
              Status: ${newStatus}
            </span>
          </div>
          <p>Thank you for helping improve our community!</p>
          <div class="footer">
            <p>This is an automated notification from FixItPH</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
};

module.exports = { sendEmail, emailTemplates };