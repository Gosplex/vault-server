import twilio from 'twilio';

interface SMSOptions {
  to: string;
  message: string;
}

class SMSService {
  private client;
  private fromNumber: string;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER as string;
  }

  async sendSMS(options: SMSOptions): Promise<boolean> {
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(options.to)) {
        console.error('Invalid phone number format:', options.to);
        return false;
      }

      const message = await this.client.messages.create({
        body: options.message,
        from: this.fromNumber,
        to: options.to
      });

      console.log('SMS sent successfully:', message.sid);
      return true;
    } catch (error) {
      console.error('Error sending SMS:', error);
      return false;
    }
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  // Format phone number to E.164 format
  formatPhoneNumber(phoneNumber: string, countryCode: string = '+1'): string {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If no country code, add default
    if (!phoneNumber.startsWith('+')) {
      return `${countryCode}${digits}`;
    }
    
    return phoneNumber;
  }

  // Subscription renewal reminder
  async sendSubscriptionReminderSMS(phoneNumber: string, itemName: string, renewalDate: Date, daysUntilRenewal: number): Promise<boolean> {
    const message = `Subscription Reminder: Your ${itemName} subscription renews in ${daysUntilRenewal} days (${renewalDate.toLocaleDateString()}). Ensure your payment method is current.`;
    
    return await this.sendSMS({
      to: phoneNumber,
      message
    });
  }

  // Software license expiration
  async sendLicenseExpirationReminderSMS(phoneNumber: string, softwareName: string, expirationDate: Date, daysUntilExpiration: number): Promise<boolean> {
    const message = `License Alert: Your ${softwareName} license expires in ${daysUntilExpiration} days (${expirationDate.toLocaleDateString()}). Renew to avoid service interruption.`;
    
    return await this.sendSMS({
      to: phoneNumber,
      message
    });
  }

  // Hardware warranty expiration
  async sendWarrantyExpirationReminderSMS(phoneNumber: string, hardwareName: string, expirationDate: Date, daysUntilExpiration: number): Promise<boolean> {
    const message = `Warranty Notice: Your ${hardwareName} warranty expires in ${daysUntilExpiration} days (${expirationDate.toLocaleDateString()}). Consider extending coverage.`;
    
    return await this.sendSMS({
      to: phoneNumber,
      message
    });
  }

  // General item reminder
  async sendItemReminderSMS(phoneNumber: string, itemName: string, reminderType: string, date: Date): Promise<boolean> {
    const message = `Reminder: ${reminderType} for ${itemName} on ${date.toLocaleDateString()}. Check your asset management app for details.`;
    
    return await this.sendSMS({
      to: phoneNumber,
      message
    });
  }
}

export default new SMSService();