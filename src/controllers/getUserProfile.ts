import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Item from '../models/Item';

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const items = await Item.find({ userId: user._id });


    res.json({
      profile: user,
      items
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
