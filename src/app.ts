import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db';
import itemRoutes from './routes/itemRoutes';
import authRoutes from './routes/authRoutes';
import getUserRoutes from './routes/getUserRoutes';
import fcmRoutes from './routes/fcmRoutes';
import cookieParser from 'cookie-parser';
import { protect } from './middleware/authMiddleware';




dotenv.config();
connectDB();

const app = express();

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());

app.options('*', cors());

app.use(express.json());

app.use('/api/items', protect, itemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', protect, getUserRoutes);
app.use('/api/fcm', protect, fcmRoutes);




export default app;
