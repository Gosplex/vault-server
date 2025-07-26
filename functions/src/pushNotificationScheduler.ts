import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import PushNotificationService from '../../src/services/pushNotificationService';

const db = admin.firestore();

export interface PushNotificationData {
  userId: string;
  itemId: string;
  itemName: string;
  category: 'hardware' | 'software' | 'subscription' | 'test' | 'general';
  notificationType: string;
  scheduledDate: Date;
  userContact: {
    fcmTokens?: string[];
  };
  reminderDaysBefore?: number;
}

export interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export async function schedulePushNotification(
  data: PushNotificationData
): Promise<FirebaseFirestore.DocumentReference> {
  try {
    // Validate data
    validateNotificationData(data);

    const notificationDoc = {
      userId: data.userId,
      itemId: data.itemId,
      itemName: data.itemName,
      category: data.category,
      notificationType: data.notificationType,
      scheduledDate: admin.firestore.Timestamp.fromDate(data.scheduledDate),
      userContact: data.userContact,
      reminderDaysBefore: data.reminderDaysBefore || 7,
      status: 'scheduled',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
      maxAttempts: 3
    };

    const docRef = await db.collection('scheduledPushNotifications').add(notificationDoc);
    
    console.log(`Push notification scheduled with ID: ${docRef.id} for item: ${data.itemName}`);
    return docRef;
  } catch (error) {
    console.error('Error scheduling push notification:', error);
    throw error;
  }
}

export async function processScheduledPushNotifications(): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  try {
    const now = admin.firestore.Timestamp.now();
    
    // Get notifications that should be sent now
    const query = db.collection('scheduledPushNotifications')
      .where('status', '==', 'scheduled')
      .where('scheduledDate', '<=', now)
      .limit(100); // Process in batches

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No push notifications to process');
      return result;
    }

    console.log(`Processing ${snapshot.size} push notifications`);
    result.processed = snapshot.size;

    // Mark all as processing first
    const batch = db.batch();
    const notifications: any[] = [];

    for (const doc of snapshot.docs) {
      const notification = { id: doc.id, ...doc.data() };
      notifications.push(notification);
      
      // Mark as processing
      batch.update(doc.ref, { 
        status: 'processing',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    // Process each notification
    for (const notification of notifications) {
      try {
        await sendPushNotification(notification);
        
        // Mark as sent
        await db.collection('scheduledPushNotifications').doc(notification.id).update({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAttempt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        result.successful++;
        console.log(`Successfully sent push notification for: ${notification.itemName}`);
        
      } catch (error) {
        console.error(`Failed to send push notification ${notification.id}:`, error);
        
        const attempts = (notification.attempts || 0) + 1;
        const maxAttempts = notification.maxAttempts || 3;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        result.failed++;
        result.errors.push(`${notification.itemName}: ${errorMessage}`);
        
        if (attempts >= maxAttempts) {
          // Mark as permanently failed
          await db.collection('scheduledPushNotifications').doc(notification.id).update({
            status: 'failed',
            attempts: attempts,
            lastError: errorMessage,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Schedule retry (exponential backoff)
          const retryDate = new Date();
          retryDate.setMinutes(retryDate.getMinutes() + (Math.pow(2, attempts) * 5)); // 5, 10, 20 minutes
          
          await db.collection('scheduledPushNotifications').doc(notification.id).update({
            status: 'scheduled', // Back to scheduled for retry
            attempts: attempts,
            lastError: errorMessage,
            scheduledDate: admin.firestore.Timestamp.fromDate(retryDate),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }

    console.log(`Push notification processing complete: ${result.successful} successful, ${result.failed} failed`);
    return result;
    
  } catch (error) {
    console.error('Error in processScheduledPushNotifications:', error);
    result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function sendPushNotification(notification: any): Promise<void> {
  const { userContact, itemName, category, notificationType, scheduledDate, reminderDaysBefore = 7 } = notification;
  
  // Check if user has FCM tokens
  if (!userContact.fcmTokens || userContact.fcmTokens.length === 0) {
    console.log(`No FCM tokens provided for ${itemName}`);
    return;
  }

  const notificationDate = scheduledDate instanceof admin.firestore.Timestamp 
    ? scheduledDate.toDate() 
    : new Date(scheduledDate);

  const pushPromises = userContact.fcmTokens.map(async (token: string) => {
    let pushPromise: Promise<boolean>;
    
    switch (category) {
      case 'subscription':
        pushPromise = PushNotificationService.sendSubscriptionReminderPush(
          token,
          itemName,
          notificationDate,
          reminderDaysBefore
        );
        break;
      case 'software':
        pushPromise = PushNotificationService.sendLicenseExpirationReminderPush(
          token,
          itemName,
          notificationDate,
          reminderDaysBefore
        );
        break;
      case 'hardware':
        pushPromise = PushNotificationService.sendWarrantyExpirationReminderPush(
          token,
          itemName,
          notificationDate,
          reminderDaysBefore
        );
        break;
      default:
        pushPromise = PushNotificationService.sendItemReminderPush(
          token,
          itemName,
          notificationType,
          notificationDate
        );
    }

    return pushPromise.catch(error => {
      console.error(`Push notification failed for ${itemName}:`, error);
      throw new Error(`Push: ${error.message}`);
    });
  });

  // Wait for all notifications to complete
  const results = await Promise.allSettled(pushPromises);
  
  // Check if any succeeded
  const hasSuccess = results.some(result => result.status === 'fulfilled');
  const errors = results
    .filter(result => result.status === 'rejected')
    .map(result => (result as PromiseRejectedResult).reason.message);

  if (!hasSuccess && errors.length > 0) {
    throw new Error(`All push notifications failed: ${errors.join(', ')}`);
  }

  if (errors.length > 0) {
    console.warn(`Some push notifications failed for ${itemName}: ${errors.join(', ')}`);
  }
}



export const processScheduledPushNotificationsCron = functions.scheduler.onSchedule({
  schedule: 'every 5 minutes',
  timeZone: 'UTC',
  timeoutSeconds: 300,
  memory: '512MiB',
  retryCount: 3,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 600
}, async (event: functions.scheduler.ScheduledEvent) => {
  try {
    const result = await processScheduledPushNotifications();
    console.log('Push notification processing result:', result);
  } catch (error) {
    console.error('Cron job error:', error);
    throw error;
  }
});

export async function cancelPushNotifications(
  itemId: string, 
  userId?: string
): Promise<{ cancelledCount: number }> {
  try {
    let query = db.collection('scheduledPushNotifications')
      .where('itemId', '==', itemId)
      .where('status', '==', 'scheduled');
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return { cancelledCount: 0 };
    }

    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    
    console.log(`Cancelled ${snapshot.size} push notifications for item: ${itemId}`);
    return { cancelledCount: snapshot.size };
  } catch (error) {
    console.error('Error cancelling push notifications:', error);
    throw error;
  }
}

export async function getScheduledPushNotifications(
  userId: string, 
  status?: string, 
  limit: number = 50
): Promise<any[]> {
  try {
    let query = db.collection('scheduledPushNotifications')
      .where('userId', '==', userId)
      .orderBy('scheduledDate', 'desc')
      .limit(limit);
    
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      scheduledDate: doc.data().scheduledDate?.toDate?.()?.toISOString()
    }));
  } catch (error) {
    console.error('Error getting scheduled push notifications:', error);
    throw error;
  }
}

function validateNotificationData(data: PushNotificationData): void {
  if (!data.userId) throw new Error('userId is required');
  if (!data.itemId) throw new Error('itemId is required');
  if (!data.itemName) throw new Error('itemName is required');
  if (!data.scheduledDate) throw new Error('scheduledDate is required');
  if (data.scheduledDate <= new Date()) throw new Error('scheduledDate must be in the future');
  if (!data.userContact.fcmTokens || data.userContact.fcmTokens.length === 0) throw new Error('At least one FCM token is required');
}