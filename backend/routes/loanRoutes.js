import { Router } from 'express';
import * as ctrl from '../controllers/loanController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/summary/stats', ctrl.loanSummary);
router.post('/reset', authorize('admin', 'hr'), ctrl.resetAllIou);
router.get('/', ctrl.listLoans);
router.get('/:id', ctrl.getLoan);
router.post('/', authorize('admin', 'manager', 'hr'), ctrl.createLoan);
router.put('/:id', authorize('admin', 'manager', 'hr'), ctrl.updateLoan);
router.put('/:id/week-payment', authorize('admin', 'manager', 'hr'), ctrl.setWeekPayment);
router.post('/:id/payments', authorize('admin', 'manager', 'hr'), ctrl.addPayment);
router.delete('/:id', authorize('admin', 'hr'), ctrl.deleteLoan);

export default router;
