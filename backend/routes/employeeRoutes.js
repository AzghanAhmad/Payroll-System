import { Router } from 'express';
import * as ctrl from '../controllers/employeeController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.use(protect);

router.get('/', ctrl.listEmployees);
router.get('/export/excel', authorize('admin', 'manager', 'hr'), ctrl.exportExcel);
router.get('/export/pdf', authorize('admin', 'manager', 'hr'), ctrl.exportPdf);
router.post('/import/excel', authorize('admin', 'hr'), upload.single('file'), ctrl.importExcel);
router.get('/:id', ctrl.getEmployee);
router.post('/', authorize('admin', 'hr', 'manager'), upload.single('photo'), ctrl.createEmployee);
router.put('/:id', authorize('admin', 'hr', 'manager'), upload.single('photo'), ctrl.updateEmployee);
router.delete('/:id', authorize('admin', 'hr'), ctrl.deleteEmployee);

export default router;
