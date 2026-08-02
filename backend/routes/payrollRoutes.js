import { Router } from 'express';
import * as ctrl from '../controllers/payrollController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listPayrolls);
router.get('/summary', ctrl.getPayrollSummary);
router.post('/generate-weekly', authorize('admin', 'manager', 'hr'), ctrl.generateWeekly);
router.post('/generate-monthly', authorize('admin', 'manager', 'hr'), ctrl.generateMonthly);
router.get('/employee/:employee', ctrl.getPayrollByEmployee);
router.get('/week/:week', ctrl.getPayrollByWeek);
router.get('/month/:month', ctrl.getPayrollByMonth);

export default router;
