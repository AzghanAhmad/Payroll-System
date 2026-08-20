import { Router } from 'express';
import * as ctrl from '../controllers/payrollOpsController.js';
import * as attendance from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.use(protect);

router.get('/schedule', ctrl.getSchedule);
router.get('/schedule/export/excel', ctrl.exportScheduleExcel);
router.get('/schedule/export/pdf', ctrl.exportSchedulePdf);
router.get('/month-control', ctrl.getMonthControl);
router.post('/month-control/create-next', authorize('admin', 'manager', 'hr'), ctrl.createNextMonth);
router.put('/month-control/current', authorize('admin', 'manager', 'hr'), ctrl.setCurrentMonth);
router.get('/month-control/export-pdfs', authorize('admin', 'manager', 'hr'), ctrl.saveFullPayrollPdfs);

router.post(
  '/attendance/import',
  authorize('admin', 'manager', 'hr'),
  upload.single('file'),
  attendance.importAttendanceExcel
);

export default router;
