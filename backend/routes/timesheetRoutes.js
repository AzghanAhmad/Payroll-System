import { Router } from 'express';
import * as ctrl from '../controllers/timesheetController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/', ctrl.listTimesheets);
router.get('/:year/:month', ctrl.getOrCreateTimesheet);
router.put('/:id', authorize('admin', 'manager', 'hr'), ctrl.updateTimesheet);
router.delete('/:id', authorize('admin', 'hr'), ctrl.deleteTimesheet);
router.patch(
  '/:year/:month/:weekNumber/:employeeId/day',
  authorize('admin', 'manager', 'hr'),
  ctrl.updateDay
);

export default router;
