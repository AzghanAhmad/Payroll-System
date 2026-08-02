import { Router } from 'express';
import * as ctrl from '../controllers/payslipController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listPayslips);
router.post('/generate', authorize('admin', 'manager', 'hr'), ctrl.generatePayslips);
router.get('/download/:id', ctrl.downloadPayslip);
router.post('/email/:id', authorize('admin', 'manager', 'hr'), ctrl.emailPayslip);
router.get('/:id', ctrl.getPayslip);

export default router;
