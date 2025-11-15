// const formData = require('form-data');
// const Mailgun = require('mailgun.js');
const brevo = require('@getbrevo/brevo');

// const mailgun = new Mailgun(formData);

// // Initialize Mailgun client
// const mg = mailgun.client({
//   username: 'api',
//   key: process.env.MAILGUN_API_KEY,
//   url: process.env.MAILGUN_API_URL || 'https://api.mailgun.net', // Use EU url if needed
// });

// Initialize Brevo API client
let apiInstance = new brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || `noreply@${MAILGUN_DOMAIN}`;
const FROM_EMAIL_BREVO = process.env.BREVO_FROM_EMAIL;
const FROM_NAME_BREVO = process.env.BREVO_FROM_NAME || 'FixItPH';

/**
 * Send email using Mailgun
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
const sendEmailMailgun = async (to, subject, html) => {
  try {
    console.log(`📧 Sending email to ${to} using Mailgun...`);
    
    const messageData = {
      from: `FixItPH <${FROM_EMAIL}>`,
      to: to,
      subject: subject,
      html: html,
    };

    const response = await mg.messages.create(MAILGUN_DOMAIN, messageData);
    
    console.log('✅ Email sent successfully via Mailgun:', response.id);
    return response;
  } catch (error) {
    console.error('❌ Failed to send email via Mailgun:', error);
    throw error;
  }
};

/**
 * Send email using Brevo
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
const sendEmailBrevo = async (to, subject, html) => {
  try {
    console.log(`📧 Sending email to ${to} using Brevo...`);
    
    let sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.sender = { name: FROM_NAME_BREVO, email: FROM_EMAIL_BREVO };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log('✅ Email sent successfully via Brevo:', response.messageId);
    return response;
  } catch (error) {
    console.error('❌ Failed to send email via Brevo:', error);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  verificationOTP: (otp, ownerName) => `...existing template...`,
  
  passwordReset: (resetToken, ownerName) => `...existing template...`,
  
  reportStatusUpdate: (reportTitle, newStatus, ownerName) => `...existing template...`,
  // ✅ Add this template
  reportRemoved: (ownerName, reportTitle, reason) => ({
    subject: `⚠️ Your Report Has Been Removed - ${reportTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Report Removed</h1>
          </div>
          <div class="content">
            <p>Hello ${ownerName},</p>
            
            <p>We're writing to inform you that your report "<strong>${reportTitle}</strong>" has been removed from FixItPH.</p>
            
            <div class="warning-box">
              <strong>Reason for removal:</strong><br>
              ${reason}
            </div>
            
            <p>If you believe this was a mistake or have questions, please contact your barangay administrator.</p>
            
            <p>Thank you for your understanding.</p>
            
            <div class="footer">
              <p>This is an automated notification from FixItPH</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // ✅ Add this template too
  thankFlagger: (ownerName, reportTitle) => ({
    subject: `✅ Thank You for Flagging - ${reportTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #d4edda; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Thank You!</h1>
          </div>
          <div class="content">
            <p>Hello ${ownerName},</p>
            
            <div class="success-box">
              <strong>Action Taken:</strong><br>
              The report "<strong>${reportTitle}</strong>" that you flagged has been reviewed and removed by our administrators.
            </div>
            
            <p>Thank you for helping keep FixItPH a safe and trustworthy platform for our community!</p>
            
            <p>Your vigilance helps us maintain quality standards and ensures that all reports are legitimate.</p>
            
            <div class="footer">
              <p>This is an automated notification from FixItPH</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // ✅ Add suspension templates
  userSuspended: (ownerName, reason) => ({
    subject: `🚫 Your FixItPH Account Has Been Suspended`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚫 Account Suspended</h1>
          </div>
          <div class="content">
            <p>Hello ${ownerName},</p>
            
            <p>Your FixItPH account has been suspended by an administrator.</p>
            
            <div class="warning-box">
              <strong>Reason:</strong><br>
              ${reason || 'Violation of community guidelines'}
            </div>
            
            <p>You will not be able to access your account until it is reinstated.</p>
            
            <p>If you have questions, please contact your barangay administrator.</p>
            
            <div class="footer">
              <p>This is an automated notification from FixItPH</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  userUnsuspended: (ownerName) => ({
    subject: `✅ Your FixItPH Account Has Been Reinstated`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #d4edda; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Welcome Back!</h1>
          </div>
          <div class="content">
            <p>Hello ${ownerName},</p>
            
            <div class="success-box">
              <strong>Good News!</strong><br>
              Your FixItPH account has been reinstated and you can now access all features again.
            </div>
            
            <p>Please ensure you follow our community guidelines to maintain your account in good standing.</p>
            
            <p>Thank you for your cooperation!</p>
            
            <div class="footer">
              <p>This is an automated notification from FixItPH</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),
};

module.exports = { sendEmailMailgun, sendEmailBrevo, emailTemplates };