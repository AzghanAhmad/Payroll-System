import { Router } from 'express';
import * as ctrl from '../controllers/settingsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.use(protect);
router.get('/', ctrl.getSettings);

// Only run multer for multipart uploads; JSON saves skip file middleware
const optionalLogoUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single('logo')(req, res, next);
  }
  return next();
};

router.put('/', authorize('admin'), optionalLogoUpload, ctrl.updateSettings);

export default router;
