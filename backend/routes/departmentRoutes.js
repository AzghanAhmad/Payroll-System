import { Router } from 'express';
import * as ctrl from '../controllers/departmentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/', ctrl.listDepartments);
router.post('/', authorize('admin', 'hr'), ctrl.createDepartment);
router.put('/:id', authorize('admin', 'hr'), ctrl.updateDepartment);
router.delete('/:id', authorize('admin'), ctrl.deleteDepartment);

export default router;
