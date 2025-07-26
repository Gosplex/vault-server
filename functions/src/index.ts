import * as admin from 'firebase-admin';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { 
  schedulePushNotification, 
  cancelPushNotifications, 
  getScheduledPushNotifications 
} from './pushNotificationScheduler';
import { 
  scheduleEmailNotification, 
  cancelEmailNotifications, 
  getScheduledEmailNotifications 
} from './emailScheduler';
import { 
  scheduleSMSNotification, 
  cancelSMSNotifications, 
  getScheduledSMSNotifications 
} from './smsScheduler';

// Initialize Firebase Admin
admin.initializeApp();

// Re-export cron jobs
import { processScheduledPushNotificationsCron } from './pushNotificationScheduler';
import { processScheduledEmailNotificationsCron } from './emailScheduler';
import { processScheduledSMSNotificationsCron } from './smsScheduler';

export { processScheduledPushNotificationsCron, processScheduledEmailNotificationsCron, processScheduledSMSNotificationsCron };

export const scheduleItemNotification = onCall(async (request: CallableRequest) => {
  try {
    const { 
      userId, 
      itemId, 
      itemName, 
      category, 
      notificationType, 
      scheduledDate, 
      userPreferences, 
      userContact,
      reminderDaysBefore 
    } = request.data;
    
    if (!userId || !itemId || !itemName || !scheduledDate) {
      throw new HttpsError(
        'invalid-argument', 
        'Missing required parameters: userId, itemId, itemName, scheduledDate'
      );
    }

    const scheduleDateTime = new Date(scheduledDate);
    if (scheduleDateTime <= new Date()) {
      throw new HttpsError(
        'invalid-argument', 
        'Scheduled date must be in the future'
      );
    }

    const preferences = userPreferences || { email: true, sms: false, push: false };
    const contact = userContact || {};
    const scheduledIds: { [key: string]: string } = {};

    const promises: Promise<FirebaseFirestore.DocumentReference>[] = [];

    if (preferences.push && contact.fcmTokens && contact.fcmTokens.length > 0) {
      promises.push(schedulePushNotification({
        userId,
        itemId,
        itemName,
        category: category || 'general',
        notificationType: notificationType || 'reminder',
        scheduledDate: scheduleDateTime,
        userContact: { fcmTokens: contact.fcmTokens },
        reminderDaysBefore: reminderDaysBefore || 7
      }).then(docRef => {
        scheduledIds.push = docRef.id;
        return docRef;
      }));
    }

    if (preferences.email && contact.email) {
      promises.push(scheduleEmailNotification({
        userId,
        itemId,
        itemName,
        category: category || 'general',
        notificationType: notificationType || 'reminder',
        scheduledDate: scheduleDateTime,
        userContact: { email: contact.email },
        reminderDaysBefore: reminderDaysBefore || 7
      }).then(docRef => {
        scheduledIds.email = docRef.id;
        return docRef;
      }));
    }

    if (preferences.sms && contact.phone) {
      promises.push(scheduleSMSNotification({
        userId,
        itemId,
        itemName,
        category: category || 'general',
        notificationType: notificationType || 'reminder',
        scheduledDate: scheduleDateTime,
        userContact: { phone: contact.phone },
        reminderDaysBefore: reminderDaysBefore || 7
      }).then(docRef => {
        scheduledIds.sms = docRef.id;
        return docRef;
      }));
    }

    if (promises.length === 0) {
      throw new HttpsError(
        'invalid-argument',
        'No valid notification preferences or contact details provided'
      );
    }

    await Promise.all(promises);

    return { 
      success: true, 
      scheduledIds,
      message: `Notifications scheduled for ${itemName}`
    };
  } catch (error) {
    console.error('Error scheduling notification:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to schedule notification');
  }
});

export const cancelNotifications = onCall(async (request: CallableRequest) => {
  try {
    const { itemId, userId } = request.data;
    
    if (!itemId) {
      throw new HttpsError('invalid-argument', 'itemId is required');
    }

    const results = await Promise.all([
      cancelPushNotifications(itemId, userId),
      cancelEmailNotifications(itemId, userId),
      cancelSMSNotifications(itemId, userId)
    ]);

    const totalCancelled = results.reduce((sum, result) => sum + result.cancelledCount, 0);

    return { 
      success: true, 
      cancelledCount: totalCancelled,
      message: `Cancelled ${totalCancelled} notifications for item`
    };
  } catch (error) {
    console.error('Error cancelling notifications:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to cancel notifications');
  }
});

export const sendTestNotification = onCall(async (request: CallableRequest) => {
  try {
    const { userId, itemName, userContact, notificationType } = request.data;
    
    if (!userId || !itemName) {
      throw new HttpsError('invalid-argument', 'userId and itemName are required');
    }

    const testDate = new Date();
    testDate.setMinutes(testDate.getMinutes() + 2);

    const scheduledIds: { [key: string]: string } = {};
    const promises: Promise<FirebaseFirestore.DocumentReference>[] = [];
    const contact = userContact || {};

    if (contact.fcmTokens && contact.fcmTokens.length > 0) {
      promises.push(schedulePushNotification({
        userId,
        itemId: `test-${Date.now()}`,
        itemName: itemName || 'Test Item',
        category: 'test',
        notificationType: notificationType || 'test_notification',
        scheduledDate: testDate,
        userContact: { fcmTokens: contact.fcmTokens },
        reminderDaysBefore: 7
      }).then(docRef => {
        scheduledIds.push = docRef.id;
        return docRef;
      }));
    }

    if (contact.email) {
      promises.push(scheduleEmailNotification({
        userId,
        itemId: `test-${Date.now()}`,
        itemName: itemName || 'Test Item',
        category: 'test',
        notificationType: notificationType || 'test_notification',
        scheduledDate: testDate,
        userContact: { email: contact.email },
        reminderDaysBefore: 7
      }).then(docRef => {
        scheduledIds.email = docRef.id;
        return docRef;
      }));
    }

    if (contact.phone) {
      promises.push(scheduleSMSNotification({
        userId,
        itemId: `test-${Date.now()}`,
        itemName: itemName || 'Test Item',
        category: 'test',
        notificationType: notificationType || 'test_notification',
        scheduledDate: testDate,
        userContact: { phone: contact.phone },
        reminderDaysBefore: 7
      }).then(docRef => {
        scheduledIds.sms = docRef.id;
        return docRef;
      }));
    }

    if (promises.length === 0) {
      throw new HttpsError(
        'invalid-argument',
        'No valid contact details provided for test notification'
      );
    }

    await Promise.all(promises);

    return { 
      success: true, 
      scheduledIds,
      scheduledTime: testDate.toISOString(),
      message: 'Test notifications scheduled for 2 minutes from now'
    };
  } catch (error) {
    console.error('Error sending test notification:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to schedule test notification');
  }
});

export const getUserNotifications = onCall(async (request: CallableRequest) => {
  try {
    const { userId, status, limit } = request.data;
    
    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId is required');
    }

    const [pushNotifications, emailNotifications, smsNotifications] = await Promise.all([
      getScheduledPushNotifications(userId, status, limit || 50),
      getScheduledEmailNotifications(userId, status, limit || 50),
      getScheduledSMSNotifications(userId, status, limit || 50)
    ]);

    const notifications = [
      ...pushNotifications.map(n => ({ ...n, type: 'push' })),
      ...emailNotifications.map(n => ({ ...n, type: 'email' })),
      ...smsNotifications.map(n => ({ ...n, type: 'sms' }))
    ].sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

    return { 
      success: true, 
      notifications,
      count: notifications.length 
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError('internal', 'Failed to get user notifications');
  }
});

export const cleanupOldNotifications = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'UTC',
    timeoutSeconds: 300,
    memory: '512MiB'
  },
  async () => {
    try {
      console.log('Starting cleanup of old notifications...');
      const db = admin.firestore();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      
      const collections = [
        'scheduledPushNotifications',
        'scheduledEmailNotifications',
        'scheduledSMSNotifications'
      ];
      
      let totalCleaned = 0;
      
      for (const collection of collections) {
        const query = db.collection(collection)
          .where('status', 'in', ['sent', 'failed'])
          .where('processedAt', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
          .limit(500);
          
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
          const batch = db.batch();
          let count = 0;
          
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            count++;
          });
          
          await batch.commit();
          totalCleaned += count;
          console.log(`Cleaned up ${count} old notifications from ${collection}`);
        }
      }
      
      if (totalCleaned === 0) {
        console.log('No old notifications to cleanup');
      }
      
      return;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }
);