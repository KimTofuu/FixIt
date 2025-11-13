const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.MAIL_USERNAME, // your email
    pass: process.env.MAIL_PASSWORD, // your email password or app password
  },
});

// Email templates
const emailTemplates = {
  reportRemoved: (userName, reportTitle, reason) => ({
    subject: 'FixIt PH - Your Report Has Been Removed',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚩 Report Removed Notice</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>We're writing to inform you that your report <strong>"${reportTitle}"</strong> has been removed from FixIt PH by our moderation team.</p>
            
            <p><strong>Reason for removal:</strong></p>
            <p style="background: #fff; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0;">
              ${reason}
            </p>
            
            <p>This action was taken after multiple community members flagged your report for violating our community guidelines.</p>
            
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Review our community guidelines</li>
              <li>If you believe this was a mistake, please contact our support team</li>
              <li>Future violations may result in account restrictions</li>
            </ul>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-feed" class="button">Return to FixIt PH</a>
          </div>
          <div class="footer">
            <p>This is an automated message from FixIt PH</p>
            <p>© ${new Date().getFullYear()} FixIt PH - Community Issue Reporting Platform</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  thankFlagger: (userName, reportTitle) => ({
    subject: 'FixIt PH - Thank You for Helping Keep Our Community Safe',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .badge { display: inline-block; padding: 10px 20px; background: #10b981; color: white; border-radius: 20px; margin: 15px 0; font-weight: bold; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✨ Thank You, Community Guardian!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>Thank you for helping keep FixIt PH a safe and reliable platform! 🙏</p>
            
            <p>The report you flagged (<strong>"${reportTitle}"</strong>) has been reviewed by our moderation team and has been removed for violating community guidelines.</p>
            
            <div class="badge">🛡️ Community Guardian</div>
            
            <p><strong>Your contribution matters:</strong></p>
            <ul>
              <li>✅ You helped maintain content quality</li>
              <li>✅ You protected community members from misleading information</li>
              <li>✅ You contributed to a safer reporting environment</li>
            </ul>
            
            <p>Users like you make FixIt PH a trusted platform for reporting and resolving community issues.</p>
            
            <p style="background: #e0f2fe; padding: 15px; border-left: 4px solid #0ea5e9; margin: 15px 0;">
              💡 <strong>Tip:</strong> Continue reporting violations to earn reputation points and unlock special badges!
            </p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user-feed" class="button">Continue Exploring</a>
          </div>
          <div class="footer">
            <p>This is an automated message from FixIt PH</p>
            <p>© ${new Date().getFullYear()} FixIt PH - Community Issue Reporting Platform</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  userSuspended: (userName, reason) => ({
    subject: '⚠️ Your FixIt PH Account Has Been Suspended',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f8f9fa; }
            .reason-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc3545; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Account Suspended</h1>
            </div>
            <div class="content">
              <p>Dear ${userName},</p>
              <p>Your FixIt PH account has been suspended by our administration team.</p>
              
              <div class="reason-box">
                <h3>Suspension Reason:</h3>
                <p>${reason}</p>
              </div>

              <p><strong>What this means:</strong></p>
              <ul>
                <li>You cannot log in to your account</li>
                <li>You cannot create or view reports</li>
                <li>Your profile is temporarily hidden</li>
              </ul>

              <p>If you believe this suspension was made in error or would like to appeal, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>FixIt PH - Community Reporting System</p>
            </div>
          </div>
        </body>
      </html>
    `
  }),

  userUnsuspended: (userName) => ({
    subject: '✅ Your FixIt PH Account Has Been Restored',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f8f9fa; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Account Restored</h1>
            </div>
            <div class="content">
              <p>Dear ${userName},</p>
              <p>Good news! Your FixIt PH account suspension has been lifted.</p>
              
              <p><strong>You can now:</strong></p>
              <ul>
                <li>Log in to your account</li>
                <li>Create and view reports</li>
                <li>Participate in the community</li>
              </ul>

              <p>Please remember to follow our community guidelines to avoid future suspensions.</p>
              <p>Welcome back!</p>
            </div>
            <div class="footer">
              <p>FixIt PH - Community Reporting System</p>
            </div>
          </div>
        </body>
      </html>
    `
  })
};

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"FixIt PH" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('📧 Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail, emailTemplates };