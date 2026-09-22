import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
} from '../controllers/vendorController.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(listVendors)
  .post(createVendor);

router.route('/:id')
  .put(updateVendor)
  .delete(deleteVendor);

export default router;
