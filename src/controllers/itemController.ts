import { Request, Response, NextFunction } from 'express';
import Item from '../models/Item';
import { encryptText, decryptText } from '../helpers/encryptionHelper';
import multer from 'multer';
import { User } from '../models/User';
import admin from '../config/firebase';

interface MulterFile extends Express.Multer.File {
  path: string; 
}

interface MulterRequest extends Request {
  files?: MulterFile[];
}

interface SoftwareDetails {
  licenseKey?: string;
  licenseType?: 'lifetime' | 'subscription' | 'trial' | 'open-source';
  licenseStartDate?: Date;
  licenseEndDate?: Date;
  version?: string;
  platform: string[];
  vendor?: string;
  website?: string;
  activationEmail?: string;
}

const validateItemData = (body: any, category: string) => {
  const errors: string[] = [];

  if (!body.name) errors.push('Name is required');
  if (!['hardware', 'software', 'subscription'].includes(category)) {
    errors.push('Invalid category');
  }

  if (category === 'subscription' && body.subscriptionDetails) {
    const { lastRenewalDate, nextRenewalDate, isRecurring, renewalFrequency } = body.subscriptionDetails;
    if (isRecurring && !renewalFrequency) {
      errors.push('Renewal frequency is required for recurring subscriptions');
    }
    if (isRecurring && !['monthly', 'yearly', 'weekly', 'custom'].includes(renewalFrequency)) {
      errors.push('Invalid renewal frequency');
    }
    if (!lastRenewalDate || !nextRenewalDate) {
      errors.push('Last and next renewal dates are required for subscriptions');
    }
  }

  if (category === 'software' && body.softwareDetails) {
    const { licenseType } = body.softwareDetails;
    if (licenseType && !['lifetime', 'subscription', 'trial', 'open-source'].includes(licenseType)) {
      errors.push('Invalid license type');
    }
  }

  if (category === 'hardware' && body.hardwareDetails) {
    const { condition } = body.hardwareDetails;
    if (condition && !['new', 'used', 'refurbished'].includes(condition)) {
      errors.push('Invalid condition');
    }
  }

  return errors;
};

const callFirebaseFunction = async (functionName: string, data: any) => {
  try {
    const firestore = admin.firestore();
    
    if (functionName === 'scheduleItemNotificationCallable') {
      const firestoreData = {
        ...data,
        userPreferences: data.userPreferences && typeof data.userPreferences === 'object' 
          ? {...data.userPreferences} 
          : data.userPreferences,
        userContact: data.userContact && typeof data.userContact === 'object'
          ? {...data.userContact}
          : data.userContact,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledFor: new Date(data.scheduledDate)
      };

      const notificationRef = await firestore.collection('scheduledNotifications').add(firestoreData);
      
      return { data: { success: true, notificationId: notificationRef.id } };
    } else if (functionName === 'cancelNotificationsCallable') {
      const query = firestore.collection('scheduledNotifications')
        .where('itemId', '==', data.itemId)
        .where('userId', '==', data.userId)
        .where('status', '==', 'pending');
      
      const snapshot = await query.get();
      const batch = firestore.batch();
      
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'cancelled' });
      });
      
      await batch.commit();
      
      return { data: { success: true, cancelledCount: snapshot.size } };
    }
    
    return { data: { success: true } };
  } catch (error) {
    console.error(`Error calling Firebase function ${functionName}:`, error);
    throw error;
  }
};

export const addItem = async (req: MulterRequest, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      category,
      cost,
      purchaseDate,
      encrypted,
      notes,
      secretKey,
      iv,
      subscriptionDetails,
      softwareDetails,
      hardwareDetails,
    } = req.body;

    const validationErrors = validateItemData(req.body, category);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const userId = req.user?.id; 

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ errors: ['User not found'] });
    }

    const shouldEncrypt = user.security.encryptKeysByDefault || encrypted;

    const fileUrls = (req.files || []).map((file: MulterFile) => file.path);

    let encryptedLicenseKey = softwareDetails?.licenseKey;
    if (category === 'software' && shouldEncrypt && softwareDetails?.licenseKey) {
      if (!secretKey || !iv) {
        return res.status(400).json({ 
          errors: ['secretKey and iv are required for encryption'] 
        });
      }
      encryptedLicenseKey = encryptText(softwareDetails.licenseKey, secretKey, iv);
    }

    const itemData: any = {
      userId, 
      name,
      category,
      cost: cost ? Number(cost) : undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      fileUrls,
      notes,
      encrypted: shouldEncrypt, 
    };

    if (category === 'subscription' && subscriptionDetails) {
      itemData.subscriptionDetails = {
        lastRenewalDate: subscriptionDetails.lastRenewalDate ? new Date(subscriptionDetails.lastRenewalDate) : undefined,
        nextRenewalDate: subscriptionDetails.nextRenewalDate ? new Date(subscriptionDetails.nextRenewalDate) : undefined,
        isRecurring: subscriptionDetails.isRecurring || false,
        renewalFrequency: subscriptionDetails.renewalFrequency,
        provider: subscriptionDetails.provider,
        subscriptionType: subscriptionDetails.subscriptionType,
        autoRenew: subscriptionDetails.autoRenew || false,
        reminderDaysBefore: subscriptionDetails.reminderDaysBefore ? Number(subscriptionDetails.reminderDaysBefore) : undefined,
        cancelUrl: subscriptionDetails.cancelUrl,
      };
    }

    if (category === 'software' && softwareDetails) {
      itemData.softwareDetails = {
        licenseKey: encryptedLicenseKey,
        licenseType: softwareDetails.licenseType,
        licenseStartDate: softwareDetails.licenseStartDate ? new Date(softwareDetails.licenseStartDate) : undefined,
        licenseEndDate: softwareDetails.licenseEndDate ? new Date(softwareDetails.licenseEndDate) : undefined,
        version: softwareDetails.version,
        platform: softwareDetails.platform || [],
        vendor: softwareDetails.vendor,
        website: softwareDetails.website,
        activationEmail: softwareDetails.activationEmail,
      };
    }

    if (category === 'hardware' && hardwareDetails) {
      itemData.hardwareDetails = {
        serialNumber: hardwareDetails.serialNumber,
        manufacturer: hardwareDetails.manufacturer,
        warrantyExpiryDate: hardwareDetails.warrantyExpiryDate ? new Date(hardwareDetails.warrantyExpiryDate) : undefined,
        modelNumber: hardwareDetails.modelNumber,
        specifications: hardwareDetails.specifications,
        condition: hardwareDetails.condition,
        location: hardwareDetails.location,
        assignedTo: hardwareDetails.assignedTo,
      };
    }

    const item = new Item(itemData);
    const saved = await item.save();

    const userPreferences = user.notifications || { email: true, sms: false, push: false };
    const userContact = user.phoneNumber || {};
    let scheduledDate: Date | undefined;

    if (category === 'subscription' && itemData.subscriptionDetails?.nextRenewalDate) {
      scheduledDate = new Date(itemData.subscriptionDetails.nextRenewalDate);
      scheduledDate.setDate(scheduledDate.getDate() - (itemData.subscriptionDetails.reminderDaysBefore || 7));
    } else if (category === 'software' && itemData.softwareDetails?.licenseEndDate) {
      scheduledDate = new Date(itemData.softwareDetails.licenseEndDate);
      scheduledDate.setDate(scheduledDate.getDate() - (itemData.softwareDetails.reminderDaysBefore || 7));
    } else if (category === 'hardware' && itemData.hardwareDetails?.warrantyExpiryDate) {
      scheduledDate = new Date(itemData.hardwareDetails.warrantyExpiryDate);
      scheduledDate.setDate(scheduledDate.getDate() - (itemData.hardwareDetails.reminderDaysBefore || 7));
    }

    if (scheduledDate && scheduledDate > new Date()) {
      try {
        const result = await callFirebaseFunction('scheduleItemNotificationCallable', {
          userId,
          itemId: saved._id.toString(),
          itemName: name,
          category,
          notificationType: category === 'subscription' ? 'renewal' : category === 'software' ? 'license_expiration' : 'warranty_expiration',
          scheduledDate: scheduledDate.toISOString(),
          userPreferences,
          userContact,
          reminderDaysBefore: itemData.subscriptionDetails?.reminderDaysBefore || itemData.softwareDetails?.reminderDaysBefore || itemData.hardwareDetails?.reminderDaysBefore || 7
        });
        console.log(`Scheduled notifications for item ${name}:`, result.data);
      } catch (error) {
        console.error('Error scheduling notifications:', error);
      }
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error('Error adding item:', err);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ errors: [err.message] });
    }
    if (err instanceof Error && err.message.includes('Invalid file type')) {
      return res.status(400).json({ errors: [err.message] });
    }
    next(err);
  }
};

export const getItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { secretKey, iv } = req.body;
    const userId = req.user?.id;
    
    const items = await Item.find({ userId }).sort({ createdAt: -1 });

    const decryptedItems = items.map((item) => {
      if (item.category === 'software' && item.encrypted && item.softwareDetails?.licenseKey) {
        try {
          const decryptedLicenseKey = decryptText(
            item.softwareDetails.licenseKey,
            secretKey,
            iv
          );
          return {
            ...item.toObject(),
            softwareDetails: {
              ...item.softwareDetails,
              licenseKey: decryptedLicenseKey,
              platform: item.softwareDetails.platform || [],
            },
          };
        } catch (err) {
          console.error('Decryption failed:', err);
          return {
            ...item.toObject(),
            softwareDetails: {
              ...item.softwareDetails,
              platform: item.softwareDetails.platform || [],
            },
          };
        }
      }
      return item.toObject();
    });

    res.json(decryptedItems);
  } catch (err) {
    console.error('Error fetching items:', err);
    next(err);
  }
};

export const getItemById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { secretKey, iv } = req.body;
    const userId = req.user?.id;
    
    const item = await Item.findOne({ _id: req.params.id, userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    let responseItem = item.toObject();

    if (item.category === 'software' && item.encrypted && item.softwareDetails?.licenseKey) {
      try {
        const decryptedLicenseKey = decryptText(
          item.softwareDetails.licenseKey,
          secretKey,
          iv
        );
        responseItem = {
          ...responseItem,
          softwareDetails: {
            ...responseItem.softwareDetails,
            licenseKey: decryptedLicenseKey,
            platform: responseItem.softwareDetails?.platform || [],
          },
        };
      } catch (err) {
        console.error('Decryption failed:', err);
        responseItem = {
          ...responseItem,
          softwareDetails: {
            ...responseItem.softwareDetails,
            platform: responseItem.softwareDetails?.platform || [],
          },
        };
      }
    }

    res.json(responseItem);
  } catch (err) {
    console.error('Error fetching item by ID:', err);
    next(err);
  }
};

export const updateItem = async (req: MulterRequest, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      category,
      cost,
      purchaseDate,
      encrypted,
      notes,
      secretKey,
      iv,
      subscriptionDetails,
      softwareDetails,
      hardwareDetails,
    } = req.body;

    const validationErrors = validateItemData(req.body, category);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const userId = req.user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ errors: ['User not found'] });
    }

    const fileUrls = (req.files || []).map((file: MulterFile) => file.path); 

    let encryptedLicenseKey = softwareDetails?.licenseKey;
    if (category === 'software' && encrypted && softwareDetails?.licenseKey) {
      if (!secretKey || !iv) {
        return res.status(400).json({ errors: ['secretKey and iv are required for encryption'] });
      }
      encryptedLicenseKey = encryptText(softwareDetails.licenseKey, secretKey, iv);
    }

    const updateData: any = {
      name,
      category,
      cost: cost ? Number(cost) : undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      notes,
      encrypted,
    };

    if (fileUrls.length > 0) {
      updateData.fileUrls = fileUrls;
    }

    if (category === 'subscription' && subscriptionDetails) {
      updateData.subscriptionDetails = {
        lastRenewalDate: subscriptionDetails.lastRenewalDate ? new Date(subscriptionDetails.lastRenewalDate) : undefined,
        nextRenewalDate: subscriptionDetails.nextRenewalDate ? new Date(subscriptionDetails.nextRenewalDate) : undefined,
        isRecurring: subscriptionDetails.isRecurring || false,
        renewalFrequency: subscriptionDetails.renewalFrequency,
        provider: subscriptionDetails.provider,
        subscriptionType: subscriptionDetails.subscriptionType,
        autoRenew: subscriptionDetails.autoRenew || false,
        reminderDaysBefore: subscriptionDetails.reminderDaysBefore ? Number(subscriptionDetails.reminderDaysBefore) : undefined,
        cancelUrl: subscriptionDetails.cancelUrl,
      };
    }

    if (category === 'software' && softwareDetails) {
      updateData.softwareDetails = {
        licenseKey: encryptedLicenseKey,
        licenseType: softwareDetails.licenseType,
        licenseStartDate: softwareDetails.licenseStartDate ? new Date(softwareDetails.licenseStartDate) : undefined,
        licenseEndDate: softwareDetails.licenseEndDate ? new Date(softwareDetails.licenseEndDate) : undefined,
        version: softwareDetails.version,
        platform: softwareDetails.platform || [],
        vendor: softwareDetails.vendor,
        website: softwareDetails.website,
        activationEmail: softwareDetails.activationEmail,
      };
    }

    if (category === 'hardware' && hardwareDetails) {
      updateData.hardwareDetails = {
        serialNumber: hardwareDetails.serialNumber,
        manufacturer: hardwareDetails.manufacturer,
        warrantyExpiryDate: hardwareDetails.warrantyExpiryDate ? new Date(hardwareDetails.warrantyExpiryDate) : undefined,
        modelNumber: hardwareDetails.modelNumber,
        specifications: hardwareDetails.specifications,
        condition: hardwareDetails.condition,
        location: hardwareDetails.location,
        assignedTo: hardwareDetails.assignedTo,
      };
    }

    const updated = await Item.findOneAndUpdate(
      { _id: req.params.id, userId }, 
      updateData, 
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Item not found' });

    try {
      await callFirebaseFunction('cancelNotificationsCallable', { 
        itemId: req.params.id, 
        userId 
      });
      console.log(`Cancelled notifications for item ${req.params.id}`);
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }

    const userPreferences = user.notifications || { email: true, sms: false, push: false };
    const userContact = user.phoneNumber || {};
    let scheduledDate: Date | undefined;

    if (category === 'subscription' && updateData.subscriptionDetails?.nextRenewalDate) {
      scheduledDate = new Date(updateData.subscriptionDetails.nextRenewalDate);
      scheduledDate.setDate(scheduledDate.getDate() - (updateData.subscriptionDetails.reminderDaysBefore || 7));
    } else if (category === 'software' && updateData.softwareDetails?.licenseEndDate) {
      scheduledDate = new Date(updateData.softwareDetails.licenseEndDate);
      scheduledDate.setDate(scheduledDate.getDate() - (updateData.softwareDetails.reminderDaysBefore || 7));
    } else if (category === 'hardware' && updateData.hardwareDetails?.warrantyExpiryDate) {
      scheduledDate = new Date(updateData.hardwareDetails.warrantyExpiryDate);
      scheduledDate.setDate(scheduledDate.getDate() - (updateData.hardwareDetails.reminderDaysBefore || 7));
    }

    if (scheduledDate && scheduledDate > new Date()) {
      try {
        const result = await callFirebaseFunction('scheduleItemNotificationCallable', {
          userId,
          itemId: updated._id.toString(),
          itemName: name,
          category,
          notificationType: category === 'subscription' ? 'renewal' : category === 'software' ? 'license_expiration' : 'warranty_expiration',
          scheduledDate: scheduledDate.toISOString(),
          userPreferences,
          userContact,
          reminderDaysBefore: updateData.subscriptionDetails?.reminderDaysBefore || updateData.softwareDetails?.reminderDaysBefore || updateData.hardwareDetails?.reminderDaysBefore || 7
        });
        console.log(`Scheduled notifications for item ${name}:`, result.data);
      } catch (error) {
        console.error('Error scheduling notifications:', error);
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating item:', err);
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ errors: [err.message] });
    }
    if (err instanceof Error && err.message.includes('Invalid file type')) {
      return res.status(400).json({ errors: [err.message] });
    }
    next(err);
  }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    const deleted = await Item.findOneAndDelete({ _id: req.params.id, userId });
    if (!deleted) return res.status(404).json({ message: 'Item not found' });

    try {
      const result = await callFirebaseFunction('cancelNotificationsCallable', { 
        itemId: req.params.id, 
        userId 
      });
      console.log(`Cancelled notifications for item ${req.params.id}:`, result.data);
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }

    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Error deleting item:', err);
    next(err);
  }
};