import { Router } from 'express';
import * as ctrl from '../controllers/statutoryController.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/sheets', ctrl.getStatutorySheets);
router.put('/sheets', ctrl.saveStatutoryOverrides);
router.get('/iou-tracker', ctrl.getIouTracker);

export default router;
