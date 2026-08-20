import { Router } from 'express';
import * as ctrl from '../controllers/statutoryController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/sheets', ctrl.getStatutorySheets);
router.put('/sheets', ctrl.saveStatutoryOverrides);
router.get('/export/npf/excel', ctrl.exportNpfExcel);
router.get('/export/npf/pdf', ctrl.exportNpfPdf);
router.get('/export/acc/excel', ctrl.exportAccExcel);
router.get('/export/acc/pdf', ctrl.exportAccPdf);
router.get('/iou-tracker', ctrl.getIouTracker);
router.get('/iou-tracker/export/excel', ctrl.exportIouTrackerExcel);
router.get('/iou-tracker/export/pdf', ctrl.exportIouTrackerPdf);

export default router;
