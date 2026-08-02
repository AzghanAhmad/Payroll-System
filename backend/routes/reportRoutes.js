import { Router } from 'express';
import * as ctrl from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.use(authorize('admin', 'manager', 'hr'));

router.get('/weekly', ctrl.weeklyReport);
router.get('/monthly', ctrl.monthlyReport);
router.get('/yearly', ctrl.yearlyReport);
router.get('/department', ctrl.departmentReport);
router.get('/attendance', ctrl.attendanceReport);
router.get('/iou', ctrl.iouReport);
router.get('/export/excel', ctrl.exportReportExcel);
router.get('/export/pdf', ctrl.exportReportPdf);

export default router;
