import admin from '../config/firebase';

interface PushNotificationOptions {
  token: string;
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

interface MulticastNotificationOptions {
  tokens: string[];
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

class PushNotificationService {
  
  async sendPushNotification(options: PushNotificationOptions): Promise<boolean> {
    try {
      const message = {
        token: options.token,
        notification: {
          title: options.title,
          body: options.body,
          ...(options.imageUrl && { imageUrl: options.imageUrl })
        },
        data: options.data || {},
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#4285F4',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        },
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            requireInteraction: true
          }
        }
      };

      const response = await admin.messaging().send(message);
      console.log('Push notification sent successfully:', response);
      return true;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  async sendMulticastNotification(options: MulticastNotificationOptions): Promise<{ successCount: number; failureCount: number }> {
    try {
      const message = {
        tokens: options.tokens,
        notification: {
          title: options.title,
          body: options.body,
          ...(options.imageUrl && { imageUrl: options.imageUrl })
        },
        data: options.data || {},
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#4285F4',
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
      
      return {
        successCount: response.successCount,
        failureCount: response.failureCount
      };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      return { successCount: 0, failureCount: options.tokens.length };
    }
  }

  // Subscription renewal reminder
  async sendSubscriptionReminderPush(token: string, itemName: string, renewalDate: Date, daysUntilRenewal: number): Promise<boolean> {
    return await this.sendPushNotification({
      token,
      title: '🔔 Subscription Renewal Reminder',
      body: `${itemName} renews in ${daysUntilRenewal} days (${renewalDate.toLocaleDateString()})`,
      data: {
        type: 'subscription_reminder',
        itemName,
        renewalDate: renewalDate.toISOString(),
        daysUntil: daysUntilRenewal.toString()
      }
    });
  }

  // Software license expiration
  async sendLicenseExpirationReminderPush(token: string, softwareName: string, expirationDate: Date, daysUntilExpiration: number): Promise<boolean> {
    return await this.sendPushNotification({
      token,
      title: '⚠️ License Expiring Soon',
      body: `${softwareName} license expires in ${daysUntilExpiration} days`,
      data: {
        type: 'license_expiration',
        softwareName,
        expirationDate: expirationDate.toISOString(),
        daysUntil: daysUntilExpiration.toString()
      }
    });
  }

  // Hardware warranty expiration
  async sendWarrantyExpirationReminderPush(token: string, hardwareName: string, expirationDate: Date, daysUntilExpiration: number): Promise<boolean> {
    return await this.sendPushNotification({
      token,
      title: '🔧 Warranty Expiring',
      body: `${hardwareName} warranty expires in ${daysUntilExpiration} days`,
      data: {
        type: 'warranty_expiration',
        hardwareName,
        expirationDate: expirationDate.toISOString(),
        daysUntil: daysUntilExpiration.toString()
      }
    });
  }

  // Generic item reminder
  async sendItemReminderPush(token: string, itemName: string, reminderType: string, date: Date): Promise<boolean> {
    return await this.sendPushNotification({
      token,
      title: '📅 Item Reminder',
      body: `${reminderType} for ${itemName} on ${date.toLocaleDateString()}`,
      data: {
        type: 'item_reminder',
        itemName,
        reminderType,
        date: date.toISOString()
      }
    });
  }

  // Validate FCM token
  async validateToken(token: string): Promise<boolean> {
    try {
      await admin.messaging().send({
        token,
        data: { test: 'true' }
      }, true); // dry run
      return true;
    } catch (error) {
      console.error('Invalid FCM token:', error);
      return false;
    }
  }

  // Subscribe token to topic (for broadcast notifications)
  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      console.log('Successfully subscribed to topic:', response);
      return true;
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      return false;
    }
  }

  // Send notification to topic
  async sendTopicNotification(topic: string, title: string, body: string, data?: { [key: string]: string }): Promise<boolean> {
    try {
      const message = {
        topic,
        notification: { title, body },
        data: data || {}
      };

      const response = await admin.messaging().send(message);
      console.log('Topic notification sent:', response);
      return true;
    } catch (error) {
      console.error('Error sending topic notification:', error);
      return false;
    }
  }
}

export default new PushNotificationService();