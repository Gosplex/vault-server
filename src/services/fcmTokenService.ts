import { User, IUser } from '../models/User';
import pushNotificationService from './pushNotificationService';

class FCMTokenService {
  async addToken(userId: string, token: string, device: string): Promise<boolean> {
    try {
      const isValid = await pushNotificationService.validateToken(token);
      if (!isValid) {
        console.error('Invalid FCM token provided');
        return false;
      }

      const user = await User.findById(userId);
      if (!user) return false;

      const existingToken = user.fcmTokens?.some(t => t.token === token);
      if (existingToken) return true;

      user.fcmTokens!.push(user.fcmTokens!.create({ token, device, createdAt: new Date() }));

      await user.save();
      return true;
    } catch (error) {
      console.error('Error adding FCM token:', error);
      return false;
    }
  }

  async removeToken(userId: string, token: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.fcmTokens) return false;

      const originalLength = user.fcmTokens.length;
      user.fcmTokens.pull({ token });

      if (user.fcmTokens.length === originalLength) return false; 

      await user.save();
      return true;
    } catch (error) {
      console.error('Error removing FCM token:', error);
      return false;
    }
  }

  async getUserTokens(userId: string): Promise<string[]> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.fcmTokens) return [];

      return user.fcmTokens.map(t => t.token);
    } catch (error) {
      console.error('Error getting user FCM tokens:', error);
      return [];
    }
  }

  async cleanInvalidTokens(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.fcmTokens) return;

      const checks = await Promise.all(
        user.fcmTokens.map(async t => {
          const isValid = await pushNotificationService.validateToken(t.token);
          return isValid ? t : null;
        })
      );

      const validTokens = checks.filter((t): t is NonNullable<typeof t> => t !== null);
      user.fcmTokens.forEach((t) => {
        if (!validTokens.includes(t)) {
          user.fcmTokens!.pull(t._id);
        }
      });
      await user.save();
    } catch (error) {
      console.error('Error cleaning invalid tokens:', error);
    }
  }
}

export default new FCMTokenService();
