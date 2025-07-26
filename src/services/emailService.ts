import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: `"Your App Name" <${process.env.GMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, '')
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Subscription renewal reminder
  async sendSubscriptionReminder(userEmail: string, itemName: string, renewalDate: Date, daysUntilRenewal: number) {
    const subject = `Subscription Renewal Reminder: ${itemName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Subscription Renewal Reminder</h2>
        <p>Hello,</p>
        <p>Your subscription for <strong>${itemName}</strong> is set to renew in <strong>${daysUntilRenewal} days</strong>.</p>
        <p><strong>Renewal Date:</strong> ${renewalDate.toLocaleDateString()}</p>
        <p>Please ensure your payment method is up to date to avoid service interruption.</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            This is an automated reminder from your asset management system.
          </p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  // Software license expiration
  async sendLicenseExpirationReminder(userEmail: string, softwareName: string, expirationDate: Date, daysUntilExpiration: number) {
    const subject = `License Expiring Soon: ${softwareName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">License Expiration Notice</h2>
        <p>Hello,</p>
        <p>Your license for <strong>${softwareName}</strong> will expire in <strong>${daysUntilExpiration} days</strong>.</p>
        <p><strong>Expiration Date:</strong> ${expirationDate.toLocaleDateString()}</p>
        <p>Please renew your license to continue using the software without interruption.</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 5px;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            ⚠️ Action required to maintain access to your software.
          </p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  // Hardware warranty expiration
  async sendWarrantyExpirationReminder(userEmail: string, hardwareName: string, expirationDate: Date, daysUntilExpiration: number) {
    const subject = `Warranty Expiring: ${hardwareName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Warranty Expiration Notice</h2>
        <p>Hello,</p>
        <p>The warranty for your <strong>${hardwareName}</strong> will expire in <strong>${daysUntilExpiration} days</strong>.</p>
        <p><strong>Expiration Date:</strong> ${expirationDate.toLocaleDateString()}</p>
        <p>Consider extending your warranty or documenting the current condition of your hardware.</p>
        <div style="margin-top: 20px; padding: 15px; background-color: #e7f3ff; border-radius: 5px;">
          <p style="margin: 0; font-size: 14px; color: #0066cc;">
            💡 Tip: Take photos and note the current condition before warranty expires.
          </p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }
}

export default new EmailService();