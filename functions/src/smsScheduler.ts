import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import SMSService from '../../src/services/smsService';

const db = admin.firestore();

export interface SMSNotificationData {
  userId: string;
  itemId: string;
  itemName: string;
  category: 'hardware' | 'software' | 'subscription' | 'test' | 'general';
  notificationType: string;
  scheduledDate: Date;
  userContact: {
    phone: string;
  };
  reminderDaysBefore?: number;
}

export interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export async function scheduleSMSNotification(
  data: SMSNotificationData
): Promise<FirebaseFirestore.DocumentReference> {
  try {
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

    const docRef = await db.collection('scheduledSMSNotifications').add(notificationDoc);
    
    console.log(`SMS notification scheduled with ID: ${docRef.id} for item: ${data.itemName}`);
    return docRef;
  } catch (error) {
    console.error('Error scheduling SMS notification:', error);
    throw error;
  }
}

export async function processScheduledSMSNotifications(): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  try {
    const now = admin.firestore.Timestamp.now();
    
    const query = db.collection('scheduledSMSNotifications')
      .where('status', '==', 'scheduled')
      .where('scheduledDate', '<=', now)
      .limit(100); 

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No SMS notifications to process');
      return result;
    }

    console.log(`Processing ${snapshot.size} SMS notifications`);
    result.processed = snapshot.size;

    const batch = db.batch();
    const notifications: any[] = [];

    for (const doc of snapshot.docs) {
      const notification = { id: doc.id, ...doc.data() };
      notifications.push(notification);
      
      batch.update(doc.ref, { 
        status: 'processing',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    for (const notification of notifications) {
      try {
        await sendSMSNotification(notification);
        
        await db.collection('scheduledSMSNotifications').doc(notification.id).update({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAttempt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        result.successful++;
        console.log(`Successfully sent SMS notification for: ${notification.itemName}`);
        
      } catch (error) {
        console.error(`Failed to send SMS notification ${notification.id}:`, error);
        
        const attempts = (notification.attempts || 0) + 1;
        const maxAttempts = notification.maxAttempts || 3;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        result.failed++;
        result.errors.push(`${notification.itemName}: ${errorMessage}`);
        
        if (attempts >= maxAttempts) {
          await db.collection('scheduledSMSNotifications').doc(notification.id).update({
            status: 'failed',
            attempts: attempts,
            lastError: errorMessage,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          const retryDate = new Date();
          retryDate.setMinutes(retryDate.getMinutes() + (Math.pow(2, attempts) * 5)); // 5, 10, 20 minutes
          
          await db.collection('scheduledSMSNotifications').doc(notification.id).update({
            status: 'scheduled',
            attempts: attempts,
            lastError: errorMessage,
            scheduledDate: admin.firestore.Timestamp.fromDate(retryDate),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }

    console.log(`SMS notification processing complete: ${result.successful} successful, ${result.failed} failed`);
    return result;
    
  } catch (error) {
    console.error('Error in processScheduledSMSNotifications:', error);
    result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function sendSMSNotification(notification: any): Promise<void> {
  const { userContact, itemName, category, notificationType, scheduledDate, reminderDaysBefore = 7 } = notification;
  
  if (!userContact.phone) {
    console.log(`No phone number provided for ${itemName}`);
    return;
  }

  const notificationDate = scheduledDate instanceof admin.firestore.Timestamp 
    ? scheduledDate.toDate() 
    : new Date(scheduledDate);

  let smsPromise: Promise<boolean>;
  
  switch (category) {
    case 'subscription':
      smsPromise = SMSService.sendSubscriptionReminderSMS(
        userContact.phone,
        itemName,
        notificationDate,
        reminderDaysBefore
      );
      break;
    case 'software':
      smsPromise = SMSService.sendLicenseExpirationReminderSMS(
        userContact.phone,
        itemName,
        notificationDate,
        reminderDaysBefore
      );
      break;
    case 'hardware':
      smsPromise = SMSService.sendWarrantyExpirationReminderSMS(
        userContact.phone,
        itemName,
        notificationDate,
        reminderDaysBefore
      );
      break;
    default:
      smsPromise = SMSService.sendItemReminderSMS(
        userContact.phone,
        itemName,
        notificationType,
        notificationDate
      );
  }

  const result = await smsPromise.catch(error => {
    console.error(`SMS failed for ${itemName}:`, error);
    throw new Error(`SMS: ${error.message}`);
  });

  if (!result) {
    throw new Error(`SMS failed for ${itemName}: No response from SMS service`);
  }
}

export const processScheduledSMSNotificationsCron = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    timeoutSeconds: 300,
    memory: '512MiB'
  },
  async (event) => {
    try {
      const result = await processScheduledSMSNotifications();
      console.log('SMS notification processing result:', result);
    } catch (error) {
      console.error('Cron job error:', error);
      throw error;
    }
  }
);

export async function cancelSMSNotifications(
  itemId: string, 
  userId?: string
): Promise<{ cancelledCount: number }> {
  try {
    let query = db.collection('scheduledSMSNotifications')
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
    
    console.log(`Cancelled ${snapshot.size} SMS notifications for item: ${itemId}`);
    return { cancelledCount: snapshot.size };
  } catch (error) {
    console.error('Error cancelling SMS notifications:', error);
    throw error;
  }
}

export async function getScheduledSMSNotifications(
  userId: string, 
  status?: string, 
  limit: number = 50
): Promise<any[]> {
  try {
    let query = db.collection('scheduledSMSNotifications')
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
    console.error('Error getting scheduled SMS notifications:', error);
    throw error;
  }
}

function validateNotificationData(data: SMSNotificationData): void {
  if (!data.userId) throw new Error('userId is required');
  if (!data.itemId) throw new Error('itemId is required');
  if (!data.itemName) throw new Error('itemName is required');
  if (!data.scheduledDate) throw new Error('scheduledDate is required');
  if (data.scheduledDate <= new Date()) throw new Error('scheduledDate must be in the future');
  if (!data.userContact.phone) throw new Error('Phone number is required');
}