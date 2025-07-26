import express from 'express';
import { getUserProfile } from '../controllers/getUserProfile';

const router = express.Router();

router.get('/', getUserProfile);

export default router;
