import { Router } from 'express';
import * as ctrl from '../controllers/payslipController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listPayslips);
router.get('/download-pack', ctrl.downloadPayslipPack);
router.get('/download-pack-excel', ctrl.downloadPayslipPackExcel);
router.delete('/period', authorize('admin', 'manager', 'hr'), ctrl.deletePayslipsForPeriod);
router.post('/generate', authorize('admin', 'manager', 'hr'), ctrl.generatePayslips);
router.get('/download/:id', ctrl.downloadPayslip);
router.get('/download-excel/:id', ctrl.downloadPayslipExcel);
router.post('/email/:id', authorize('admin', 'manager', 'hr'), ctrl.emailPayslip);
router.delete('/:id', authorize('admin', 'manager', 'hr'), ctrl.deletePayslip);
router.get('/:id', ctrl.getPayslip);

export default router;
