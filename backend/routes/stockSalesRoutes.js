import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  listSales,
  createSale,
  getTopEmployees,
  deleteSale,
} from '../controllers/stockSalesController.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(listSales)
  .post(createSale);

router.get('/top-employees', getTopEmployees);
router.delete('/:id', deleteSale);

export default router;
