import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  batchUpdateBalanceSheet,
  getStockMovements,
  exportStockExcel,
  importStockExcel,
  getStockDashboardStats,
} from '../controllers/stockController.js';

const router = express.Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit in memory

router.use(protect);

// Dashboard
router.get('/dashboard-stats', getStockDashboardStats);

// Categories
router.route('/categories')
  .get(listCategories)
  .post(createCategory);

router.route('/categories/:id')
  .put(updateCategory)
  .delete(deleteCategory);

// Import & Export
router.get('/products/export', exportStockExcel);
router.post('/products/import', upload.single('file'), importStockExcel);

// Balance Sheet & Movements
router.post('/adjust', adjustStock);
router.post('/balance-sheet', batchUpdateBalanceSheet);
router.get('/movements', getStockMovements);

// Products
router.route('/products')
  .get(listProducts)
  .post(createProduct);

router.route('/products/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);

export default router;
