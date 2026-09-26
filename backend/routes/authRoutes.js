import { Router } from 'express';
import * as auth from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/refresh', auth.refresh);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);
router.post('/logout', protect, auth.logout);
router.get('/me', protect, auth.me);
router.put('/change-password', protect, auth.changePassword);

// User Management (Admin only)
router.get('/users', protect, authorize('admin'), auth.listUsers);
router.post('/users', protect, authorize('admin'), auth.createUser);
router.put('/users/:id', protect, authorize('admin'), auth.updateUser);
router.delete('/users/:id', protect, authorize('admin'), auth.deleteUser);

export default router;
