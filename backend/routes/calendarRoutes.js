import { Router } from 'express';
import * as ctrl from '../controllers/calendarController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/month', ctrl.getMonthCalendar);
router.get('/', ctrl.listEvents);
router.post('/', authorize('admin', 'manager', 'hr'), ctrl.createEvent);
router.put('/:id', authorize('admin', 'manager', 'hr'), ctrl.updateEvent);
router.delete('/:id', authorize('admin', 'hr'), ctrl.deleteEvent);

export default router;
