import express from 'express';
import { loginUser, registerUser, logoutUser, authCheck } from '../controllers/authController';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/check', authCheck);

export default router;
