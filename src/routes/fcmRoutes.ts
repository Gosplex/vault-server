import express from 'express';
import fcmTokenService from '../services/fcmTokenService';

const router = express.Router();

// Add FCM token
router.post('/token', async (req, res) => {
  try {
    const { token, device } = req.body;
    const userId = req.user!.id;

    if (!token || !device) {
      return res.status(400).json({ error: 'Token and device are required' });
    }

    const success = await fcmTokenService.addToken(userId, token, device);
    if (success) {
      res.json({ message: 'FCM token added successfully' });
    } else {
      res.status(400).json({ error: 'Failed to add FCM token' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove FCM token
router.delete('/token', async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user!.id;

    const success = await fcmTokenService.removeToken(userId, token);
    res.json({ message: success ? 'Token removed' : 'Token not found' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;