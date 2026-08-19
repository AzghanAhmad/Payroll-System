import { Router } from 'express';
import * as ctrl from '../controllers/leaveController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/dashboard', ctrl.getLeaveDashboard);
router.get('/staff-sheets', ctrl.getStaffLeaveSheets);
router.get('/entitlements', ctrl.getLeaveEntitlements);
router.get('/download-balance', ctrl.downloadLeaveBalance);
router.post('/email-balance', authorize('admin', 'manager', 'hr'), ctrl.emailLeaveBalance);
router.get('/', ctrl.listLeaveEntries);
router.post('/', authorize('admin', 'manager', 'hr'), ctrl.createLeaveEntry);
router.put('/:id', authorize('admin', 'manager', 'hr'), ctrl.updateLeaveEntry);
router.delete('/:id', authorize('admin', 'hr'), ctrl.deleteLeaveEntry);

export default router;
