import { Router } from 'express';
import { signup, login, firebaseGoogleLogin, refresh, logout, getProfile } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/register', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/firebase-google', authLimiter, firebaseGoogleLogin);
router.post('/refresh-token', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getProfile);

export default router;