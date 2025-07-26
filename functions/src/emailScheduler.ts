import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import EmailService from '../../src/services/emailService';

const db = admin.firestore();

export interface EmailNotificationData {
  userId: string;
  itemId: string;
  itemName: string;
  category: 'hardware' | 'software' | 'subscription' | 'test' | 'general';
  notificationType: string;
  scheduledDate: Date;
  userContact: {
    email: string;
  };
  reminderDaysBefore?: number;
}

export interface ProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export async function scheduleEmailNotification(
  data: EmailNotificationData
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

    const docRef = await db.collection('scheduledEmailNotifications').add(notificationDoc);
    
    console.log(`Email notification scheduled with ID: ${docRef.id} for item: ${data.itemName}`);
    return docRef;
  } catch (error) {
    console.error('Error scheduling email notification:', error);
    throw error;
  }
}

export async function processScheduledEmailNotifications(): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  try {
    const now = admin.firestore.Timestamp.now();
    
    const query = db.collection('scheduledEmailNotifications')
      .where('status', '==', 'scheduled')
      .where('scheduledDate', '<=', now)
      .limit(100); 

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No email notifications to process');
      return result;
    }

    console.log(`Processing ${snapshot.size} email notifications`);
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

    for (const notification of notifications) {
      try {
        await sendEmailNotification(notification);
        
        await db.collection('scheduledEmailNotifications').doc(notification.id).update({
          status: 'sent',
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAttempt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        result.successful++;
        console.log(`Successfully sent email notification for: ${notification.itemName}`);
        
      } catch (error) {
        console.error(`Failed to send email notification ${notification.id}:`, error);
        
        const attempts = (notification.attempts || 0) + 1;
        const maxAttempts = notification.maxAttempts || 3;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        result.failed++;
        result.errors.push(`${notification.itemName}: ${errorMessage}`);
        
        if (attempts >= maxAttempts) {
          await db.collection('scheduledEmailNotifications').doc(notification.id).update({
            status: 'failed',
            attempts: attempts,
            lastError: errorMessage,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          const retryDate = new Date();
          retryDate.setMinutes(retryDate.getMinutes() + (Math.pow(2, attempts) * 5));
          
          await db.collection('scheduledEmailNotifications').doc(notification.id).update({
            status: 'scheduled', 
            attempts: attempts,
            lastError: errorMessage,
            scheduledDate: admin.firestore.Timestamp.fromDate(retryDate),
            lastAttempt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }

    console.log(`Email notification processing complete: ${result.successful} successful, ${result.failed} failed`);
    return result;
    
  } catch (error) {
    console.error('Error in processScheduledEmailNotifications:', error);
    result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function sendEmailNotification(notification: any): Promise<void> {
  const { userContact, itemName, category, notificationType, scheduledDate, reminderDaysBefore = 7 } = notification;
  
  // Check if user has email
  if (!userContact.email) {
    console.log(`No email provided for ${itemName}`);
    return;
  }

  const notificationDate = scheduledDate instanceof admin.firestore.Timestamp 
    ? scheduledDate.toDate() 
    : new Date(scheduledDate);

  let emailPromise: Promise<boolean>;
  
  switch (category) {
    case 'subscription':
      emailPromise = EmailService.sendSubscriptionReminder(
        userContact.email,
        itemName,
        notificationDate,
        reminderDaysBefore
      );
      break;
    case 'software':
      emailPromise = EmailService.sendLicenseExpirationReminder(
        userContact.email,
        itemName,
        notificationDate,
        reminderDaysBefore
      );
      break;
    case 'hardware':
      emailPromise = EmailService.sendWarrantyExpirationReminder(
        userContact.email,
        itemName,
        notificationDate,
        reminderDaysBefore
      );
      break;
    default:
      emailPromise = EmailService.sendEmail({
        to: userContact.email,
        subject: `Reminder: ${notificationType} for ${itemName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${notificationType} Reminder</h2>
            <p>Hello,</p>
            <p>Your ${notificationType} for <strong>${itemName}</strong> is scheduled for ${notificationDate.toLocaleDateString()}.</p>
            <p>Please check your account for more details.</p>
            <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                This is an automated reminder from your asset management system.
              </p>
            </div>
          </div>
        `
      });
  }

  const result = await emailPromise.catch(error => {
    console.error(`Email failed for ${itemName}:`, error);
    throw new Error(`Email: ${error.message}`);
  });

  if (!result) {
    throw new Error(`Email failed for ${itemName}: No response from email service`);
  }
}

export const processScheduledEmailNotificationsCron = functions.scheduler.onSchedule({
  schedule: 'every 5 minutes',
  timeZone: 'UTC',
  timeoutSeconds: 300,
  memory: '512MiB',
  retryCount: 3,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 600
}, async (event: functions.scheduler.ScheduledEvent) => {
  try {
    const result = await processScheduledEmailNotifications();
    console.log('Email notification processing result:', result);
  } catch (error) {
    console.error('Cron job error:', error);
    throw error;
  }
});

export async function cancelEmailNotifications(
  itemId: string, 
  userId?: string
): Promise<{ cancelledCount: number }> {
  try {
    let query = db.collection('scheduledEmailNotifications')
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
    
    console.log(`Cancelled ${snapshot.size} email notifications for item: ${itemId}`);
    return { cancelledCount: snapshot.size };
  } catch (error) {
    console.error('Error cancelling email notifications:', error);
    throw error;
  }
}

export async function getScheduledEmailNotifications(
  userId: string, 
  status?: string, 
  limit: number = 50
): Promise<any[]> {
  try {
    let query = db.collection('scheduledEmailNotifications')
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
    console.error('Error getting scheduled email notifications:', error);
    throw error;
  }
}

function validateNotificationData(data: EmailNotificationData): void {
  if (!data.userId) throw new Error('userId is required');
  if (!data.itemId) throw new Error('itemId is required');
  if (!data.itemName) throw new Error('itemName is required');
  if (!data.scheduledDate) throw new Error('scheduledDate is required');
  if (data.scheduledDate <= new Date()) throw new Error('scheduledDate must be in the future');
  if (!data.userContact.email) throw new Error('Email is required');
}