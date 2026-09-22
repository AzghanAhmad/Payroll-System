import StockSale from '../models/StockSale.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import Employee from '../models/Employee.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';

export const listSales = asyncHandler(async (req, res) => {
  const { employee, startDate, endDate } = req.query;
  const filter = {};
  if (employee) filter.employee = employee;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  const sales = await StockSale.find(filter)
    .populate('employee', 'fullName employeeId photo position department')
    .populate('items.product', 'name sku unit sellingPrice')
    .sort({ date: -1 });

  res.json({ items: sales });
});

export const createSale = asyncHandler(async (req, res) => {
  const { employee, items, paymentMethod, notes, date } = req.body;
  if (!employee) throw new AppError('Employee is required', 400);
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one product item is required', 400);
  }

  let calculatedTotal = 0;
  const validatedItems = [];

  for (const it of items) {
    const qty = Number(it.quantity);
    if (!it.productId || isNaN(qty) || qty <= 0) {
      throw new AppError('Invalid product or quantity', 400);
    }
    const prod = await Product.findById(it.productId);
    if (!prod) throw new AppError(`Product not found: ${it.productId}`, 404);

    const price = it.unitPrice !== undefined ? Number(it.unitPrice) : (prod.sellingPrice || 0);
    const itemTotal = qty * price;
    calculatedTotal += itemTotal;

    validatedItems.push({
      product: prod._id,
      quantity: qty,
      unitPrice: price,
      total: itemTotal,
    });

    // Auto deduct inventory
    const startBal = prod.currentQuantity;
    const endBal = Math.max(0, startBal - qty);
    prod.currentQuantity = endBal;
    prod.endBalance = endBal;
    await prod.save();

    await StockMovement.create({
      product: prod._id,
      type: 'out',
      quantity: qty,
      startBalance: startBal,
      endBalance: endBal,
      reason: `Sale by employee`,
      reference: `Employee: ${employee}`,
      recordedBy: req.user?._id,
    });
  }

  const sale = await StockSale.create({
    employee,
    items: validatedItems,
    totalAmount: calculatedTotal,
    paymentMethod: paymentMethod || 'cash',
    notes: notes?.trim() || '',
    date: date ? new Date(date) : new Date(),
  });

  const populated = await StockSale.findById(sale._id)
    .populate('employee', 'fullName employeeId photo position')
    .populate('items.product', 'name sku unit');

  res.status(201).json(populated);
});

export const getTopEmployees = asyncHandler(async (req, res) => {
  const { timeframe = 'month', date = new Date().toISOString() } = req.query;
  const targetDate = new Date(date);

  let startDate, endDate;

  if (timeframe === 'week') {
    // Current week: Monday through Sunday
    const day = targetDate.getDay();
    const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
    startDate = new Date(targetDate.setDate(diffToMonday));
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Current month: 1st through end of month
    startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0);
    endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const ranking = await StockSale.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: '$employee',
        totalRevenue: { $sum: '$totalAmount' },
        totalSalesCount: { $sum: 1 },
        totalItemsSold: { $sum: { $sum: '$items.quantity' } },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: '_id',
        as: 'employeeDetails',
      },
    },
    { $unwind: '$employeeDetails' },
    {
      $project: {
        _id: 1,
        totalRevenue: 1,
        totalSalesCount: 1,
        totalItemsSold: 1,
        employee: {
          _id: '$employeeDetails._id',
          fullName: '$employeeDetails.fullName',
          employeeId: '$employeeDetails.employeeId',
          photo: '$employeeDetails.photo',
          position: '$employeeDetails.position',
          department: '$employeeDetails.department',
        },
      },
    },
  ]);

  res.json({
    timeframe,
    startDate,
    endDate,
    leaderboard: ranking,
    topEmployee: ranking.length > 0 ? ranking[0] : null,
  });
});

export const deleteSale = asyncHandler(async (req, res) => {
  const sale = await StockSale.findById(req.params.id);
  if (!sale) throw new AppError('Sale record not found', 404);

  // Restore inventory
  for (const it of sale.items) {
    const prod = await Product.findById(it.product);
    if (prod) {
      const startBal = prod.currentQuantity;
      const endBal = startBal + it.quantity;
      prod.currentQuantity = endBal;
      prod.endBalance = endBal;
      await prod.save();

      await StockMovement.create({
        product: prod._id,
        type: 'in',
        quantity: it.quantity,
        startBalance: startBal,
        endBalance: endBal,
        reason: 'Reversed cancelled sale',
        recordedBy: req.user?._id,
      });
    }
  }

  sale.status = 'cancelled';
  await sale.save();

  res.json({ message: 'Sale cancelled and stock restored' });
});
