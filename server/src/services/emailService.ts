import { TransactionalEmailsApi, SendSmtpEmail } from "brevo";

interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

class EmailService {
  private apiInstance: TransactionalEmailsApi;

  constructor() {
    this.apiInstance = new TransactionalEmailsApi();
    this.apiInstance.setApiKey(
      TransactionalEmailsApi.ApiKeys.apiKey,
      process.env.BREVO_API_KEY!
    );
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const sendSmtpEmail = new SendSmtpEmail();

      sendSmtpEmail.subject = options.subject;
      sendSmtpEmail.htmlContent = options.htmlContent;
      sendSmtpEmail.sender = {
        name: "CLIRDEC:PRESENCE",
        email: process.env.FROM_EMAIL || "noreply@clirdec-presence.com",
      };
      sendSmtpEmail.to = [{ email: options.to }];
      sendSmtpEmail.textContent = options.textContent;

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

      console.log(
        `Email sent successfully to ${options.to}: ${result.response.statusCode}`
      );
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async sendAttendanceNotification(
    parentEmail: string,
    studentName: string,
    status: "present" | "late" | "absent",
    classInfo: string,
    timestamp: Date
  ): Promise<boolean> {
    const subject = `Attendance Notification - ${studentName}`;

    const statusColors = {
      present: "#10B981",
      late: "#F59E0B",
      absent: "#EF4444",
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; text-align: center;">CLIRDEC:PRESENCE</h1>
              <p style="color: white; margin: 10px 0 0 0; text-align: center; opacity: 0.9;">Attendance Monitoring System</p>
            </div>

            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">Attendance Notification</h2>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Student:</strong> ${studentName}</p>
                <p style="margin: 10px 0 0 0;"><strong>Class:</strong> ${classInfo}</p>
                <p style="margin: 10px 0 0 0;"><strong>Time:</strong> ${timestamp.toLocaleString()}</p>
                <p style="margin: 10px 0 0 0;">
                  <strong>Status:</strong>
                  <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; background-color: ${
                    statusColors[status]
                  }; font-weight: bold;">
                    ${status.toUpperCase()}
                  </span>
                </p>
              </div>

              <p style="color: #666; font-size: 14px;">
                This is an automated notification from the CLIRDEC:PRESENCE attendance monitoring system.
                If you have any questions, please contact your faculty member.
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              <p>Central Luzon State University - Information Technology Department</p>
              <p>CLIRDEC:PRESENCE - Proximity and RFID-Enabled Smart Entry for Classroom Engagement</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      CLIRDEC:PRESENCE Attendance Notification

      Student: ${studentName}
      Class: ${classInfo}
      Time: ${timestamp.toLocaleString()}
      Status: ${status.toUpperCase()}

      This is an automated notification from the CLIRDEC:PRESENCE attendance monitoring system.
      If you have any questions, please contact your faculty member.

      Central Luzon State University - Information Technology Department
    `;

    return this.sendEmail({
      to: parentEmail,
      subject,
      htmlContent,
      textContent,
    });
  }

  async sendBulkAttendanceNotifications(
    notifications: Array<{
      parentEmail: string;
      studentName: string;
      status: "present" | "late" | "absent";
      classInfo: string;
      timestamp: Date;
    }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const notification of notifications) {
      const result = await this.sendAttendanceNotification(
        notification.parentEmail,
        notification.studentName,
        notification.status,
        notification.classInfo,
        notification.timestamp
      );

      if (result) {
        success++;
      } else {
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`Bulk email results: ${success} sent, ${failed} failed`);
    return { success, failed };
  }

  async sendPasswordResetEmail(
    email: string,
    userName: string,
    resetUrl: string
  ): Promise<boolean> {
    const subject = "Password Reset Request - CLIRDEC:PRESENCE";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; text-align: center;">CLIRDEC:PRESENCE</h1>
              <p style="color: white; margin: 10px 0 0 0; text-align: center; opacity: 0.9;">Password Reset</p>
            </div>

            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>

              <p>Hello ${userName},</p>

              <p>You have requested to reset your password for your CLIRDEC:PRESENCE account. Click the button below to reset your password:</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>

              <p style="color: #666; font-size: 14px;">
                This link will expire in 15 minutes for security reasons. If you didn't request this password reset, please ignore this email.
              </p>

              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  <strong>Security Notice:</strong> If you're having trouble clicking the button, copy and paste this URL into your browser: ${resetUrl}
                </p>
              </div>

              <p style="color: #666; font-size: 14px;">
                If you need assistance, please contact your system administrator.
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
              <p>Central Luzon State University - Information Technology Department</p>
              <p>CLIRDEC:PRESENCE - Proximity and RFID-Enabled Smart Entry for Classroom Engagement</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
      CLIRDEC:PRESENCE Password Reset

      Hello ${userName},

      You have requested to reset your password for your CLIRDEC:PRESENCE account.

      Click the following link to reset your password:
      ${resetUrl}

      This link will expire in 15 minutes for security reasons.

      If you didn't request this password reset, please ignore this email.

      If you need assistance, please contact your system administrator.

      Central Luzon State University - Information Technology Department
      CLIRDEC:PRESENCE - Proximity and RFID-Enabled Smart Entry for Classroom Engagement
    `;

    return this.sendEmail({
      to: email,
      subject,
      htmlContent,
      textContent,
    });
  }

  async sendSystemAlert(
    adminEmail: string,
    alertType: string,
    message: string,
    details?: any
  ): Promise<boolean> {
    const subject = `System Alert: ${alertType}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #dc3545; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; text-align: center;">System Alert</h1>
              <p style="color: white; margin: 10px 0 0 0; text-align: center;">CLIRDEC:PRESENCE</p>
            </div>

            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0;">${alertType}</h2>
              <p>${message}</p>

              ${
                details
                  ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; font-size: 12px;">
                  ${JSON.stringify(details, null, 2)}
                </div>
              `
                  : ""
              }

              <p style="color: #666; font-size: 14px;">
                This alert was generated by the CLIRDEC:PRESENCE system monitoring.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: adminEmail,
      subject,
      htmlContent,
    });
  }
}

export const emailService = new EmailService();
