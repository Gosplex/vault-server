import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {User} from '../models/User';
import generateToken from '../helpers/generateToken';
import {generateUsername} from '../helpers/generateUsernameFaker';


export const registerUser = async (req: Request, res: Response) => {
    try {
        const { email, password, confirmPassword } = req.body;

        if (!email || !password || !confirmPassword) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashed = await bcrypt.hash(password, 10);

        const username = generateUsername(); 

        const user = await User.create({ email, password: hashed, username });

        const token = generateToken(user.id.toString());
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 86400000, 
            path: '/',
        });

        res.status(201).json({ 
            user: { 
                email: user.email, 
                id: user._id 
            } 
        });

    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = generateToken(user.id.toString());
        
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 86400000, 
            path: '/',
        });

        res.json({ 
            user: { 
                email: user.email, 
                id: user._id,
                token: token
            } 
        });

    } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
    }
};

// logout controller
export const logoutUser = async (req: Request, res: Response) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
    
    res.clearCookie('next-auth.csrf-token');
    res.clearCookie('next-auth.callback-url');
    res.clearCookie('next-auth.session-token');
    
    res.status(200).json({ message: 'Logged out successfully' });
};

export const authCheck = async (req: Request, res: Response) => {
    try {
      const token = req.cookies?.token;
  
      if (!token) {
        return res.status(401).json({
          authenticated: false,
          message: 'No token provided',
        });
      }
  
      jwt.verify(token, process.env.JWT_SECRET!); 
  
      return res.status(200).json({
        authenticated: true,
      });
  
    } catch (err) {
      return res.status(401).json({
        authenticated: false,
        message: 'Invalid or expired token',
      });
    }
  };