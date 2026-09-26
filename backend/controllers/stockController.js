import Category from '../models/Category.js';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import xlsx from 'xlsx';

// ================= CATEGORIES =================
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().populate('parentCategory', 'name').sort({ name: 1 });
  res.json({ items: categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parentCategory } = req.body;
  if (!name?.trim()) throw new AppError('Category name is required', 400);

  const category = await Category.create({
    name: name.trim(),
    description: description?.trim() || '',
    parentCategory: parentCategory || null,
  });
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!category) throw new AppError('Category not found', 404);
  res.json(category);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const childProducts = await Product.countDocuments({ category: req.params.id });
  if (childProducts > 0) {
    throw new AppError(`Cannot delete category: ${childProducts} products are currently linked to it`, 400);
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw new AppError('Category not found', 404);
  res.json({ message: 'Category removed' });
});

// ================= PRODUCTS =================
export const listProducts = asyncHandler(async (req, res) => {
  const { search, category, vendor, status, lowStock } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (vendor) filter.vendor = vendor;
  if (status) filter.status = status;
  else filter.status = 'active';

  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { sku: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
    ];
  }

  let products = await Product.find(filter)
    .populate({
      path: 'category',
      select: 'name parentCategory',
      populate: { path: 'parentCategory', select: 'name' },
    })
    .populate('vendor', 'name phone email contactPerson')
    .sort({ createdAt: -1 });

  if (lowStock === 'true') {
    products = products.filter((p) => p.currentQuantity <= (p.minQuantity ?? 5));
  }

  res.json({ items: products });
});

export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name')
    .populate('vendor', 'name phone email contactPerson');
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    sku,
    category,
    vendor,
    unit,
    startBalance = 0,
    currentQuantity = 0,
    minQuantity = 5,
    maxQuantity = 100,
    costPrice = 0,
    description = '',
  } = req.body;

  if (!name?.trim()) throw new AppError('Product name is required', 400);
  if (!category) throw new AppError('Category is required', 400);

  const initialQty = Number(currentQuantity) || 0;
  const startBal = Number(startBalance) || initialQty;
  const endBal = initialQty;

  const product = await Product.create({
    name: name.trim(),
    sku: sku?.trim() || '',
    category,
    vendor: vendor || null,
    unit: unit || 'pcs',
    startBalance: startBal,
    currentQuantity: initialQty,
    endBalance: endBal,
    minQuantity: Number(minQuantity) || 5,
    maxQuantity: Number(maxQuantity) || 100,
    costPrice: Number(costPrice) || 0,
    sellingPrice: 0,
    description: description?.trim() || '',
  });

  if (initialQty > 0) {
    await StockMovement.create({
      product: product._id,
      type: 'initial',
      quantity: initialQty,
      startBalance: 0,
      endBalance: initialQty,
      reason: 'Initial stock entry',
      recordedBy: req.user?._id,
    });
  }

  const populated = await Product.findById(product._id)
    .populate('category', 'name')
    .populate('vendor', 'name phone');

  res.status(201).json(populated);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  const updates = { ...req.body };
  if (updates.startBalance !== undefined) updates.startBalance = Number(updates.startBalance);
  if (updates.currentQuantity !== undefined) updates.currentQuantity = Number(updates.currentQuantity);
  if (updates.endBalance !== undefined) updates.endBalance = Number(updates.endBalance);
  if (updates.minQuantity !== undefined) updates.minQuantity = Number(updates.minQuantity);
  if (updates.maxQuantity !== undefined) updates.maxQuantity = Number(updates.maxQuantity);
  if (updates.costPrice !== undefined) updates.costPrice = Number(updates.costPrice);
  if (updates.sellingPrice !== undefined) updates.sellingPrice = Number(updates.sellingPrice);

  const updated = await Product.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('category', 'name')
    .populate('vendor', 'name phone');

  res.json(updated);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  await StockMovement.deleteMany({ product: req.params.id });
  res.json({ message: 'Product deleted' });
});

// ================= STOCK ADJUSTMENTS & BALANCE SHEET =================
export const adjustStock = asyncHandler(async (req, res) => {
  const { productId, type, quantity, reason, reference } = req.body;
  if (!productId) throw new AppError('Product ID is required', 400);
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) throw new AppError('Valid quantity is required', 400);

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', 404);

  const startBalance = product.currentQuantity;
  let endBalance = startBalance;

  if (type === 'in') {
    endBalance = startBalance + qty;
  } else if (type === 'out') {
    endBalance = Math.max(0, startBalance - qty);
  } else if (type === 'adjustment') {
    endBalance = qty;
  } else {
    throw new AppError('Invalid movement type (in, out, adjustment)', 400);
  }

  product.currentQuantity = endBalance;
  product.endBalance = endBalance;
  await product.save();

  const movement = await StockMovement.create({
    product: product._id,
    type,
    quantity: qty,
    startBalance,
    endBalance,
    reason: reason || '',
    reference: reference || '',
    recordedBy: req.user?._id,
  });

  res.json({ product, movement });
});

export const batchUpdateBalanceSheet = asyncHandler(async (req, res) => {
  const { rows } = req.body; // Array of { productId, startBalance, currentQuantity, endBalance, minQuantity, maxQuantity }
  if (!Array.isArray(rows)) throw new AppError('Rows array is required', 400);

  const updatedProducts = [];
  for (const row of rows) {
    if (!row.productId) continue;
    const startBal = Number(row.startBalance);
    const currQty = Number(row.currentQuantity);
    const endBal = row.endBalance !== undefined ? Number(row.endBalance) : currQty;

    const prod = await Product.findById(row.productId);
    if (!prod) continue;

    const oldQty = prod.currentQuantity;
    if (!isNaN(startBal)) prod.startBalance = startBal;
    if (!isNaN(currQty)) prod.currentQuantity = currQty;
    if (!isNaN(endBal)) prod.endBalance = endBal;

    if (row.minQuantity !== undefined && !isNaN(Number(row.minQuantity))) {
      prod.minQuantity = Number(row.minQuantity);
    }
    if (row.maxQuantity !== undefined && !isNaN(Number(row.maxQuantity))) {
      prod.maxQuantity = Number(row.maxQuantity);
    }

    prod.markModified('currentQuantity');
    prod.markModified('startBalance');
    prod.markModified('endBalance');
    await prod.save();

    // Record movement if quantity changed
    if (oldQty !== prod.currentQuantity) {
      await StockMovement.create({
        product: prod._id,
        type: 'adjustment',
        quantity: Math.abs(prod.currentQuantity - oldQty),
        startBalance: oldQty,
        endBalance: prod.currentQuantity,
        reason: 'Sheet Balance Update',
        recordedBy: req.user?._id,
      });
    }

    updatedProducts.push(prod);
  }

  res.json({ message: 'Balance sheet updated successfully', updatedCount: updatedProducts.length });
});

export const getStockMovements = asyncHandler(async (req, res) => {
  const { productId, type, search, limit = 200 } = req.query;
  const filter = {};
  if (productId) filter.product = productId;
  if (type) filter.type = type;

  let movements = await StockMovement.find(filter)
    .populate('product', 'name sku unit category')
    .populate('recordedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  if (search) {
    const q = search.toLowerCase();
    movements = movements.filter(
      (m) =>
        m.product?.name?.toLowerCase().includes(q) ||
        m.product?.sku?.toLowerCase().includes(q) ||
        m.reason?.toLowerCase().includes(q) ||
        m.reference?.toLowerCase().includes(q)
    );
  }

  res.json({ items: movements });
});

// ================= EXCEL EXPORT & IMPORT =================
export const exportStockExcel = asyncHandler(async (req, res) => {
  const products = await Product.find()
    .populate('category', 'name')
    .populate('vendor', 'name')
    .sort({ name: 1 });

  const rows = products.map((p) => ({
    'Product Name': p.name,
    'SKU': p.sku || '',
    'Category': p.category?.name || 'Uncategorized',
    'Vendor': p.vendor?.name || 'N/A',
    'Unit': p.unit,
    'Start Balance': p.startBalance,
    'Current Quantity': p.currentQuantity,
    'End Balance': p.endBalance,
    'Min Quantity (Low Threshold)': p.minQuantity,
    'Max Quantity': p.maxQuantity,
    'Cost Price': p.costPrice,
    'Selling Price': p.sellingPrice,
    'Status': p.currentQuantity <= p.minQuantity ? 'LOW STOCK' : 'IN STOCK',
  }));

  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Stock Inventory');

  const buf = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="stock-inventory.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

export const importStockExcel = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Excel file is required', 400);

  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  if (!data || data.length === 0) {
    throw new AppError('Uploaded sheet contains no data', 400);
  }

  let importedCount = 0;
  let updatedCount = 0;

  for (const row of data) {
    const name = row['Product Name'] || row['name'] || row['Name'];
    if (!name) continue;

    const categoryName = row['Category'] || row['category'] || 'General';
    let category = await Category.findOne({ name: new RegExp(`^${categoryName.trim()}$`, 'i') });
    if (!category) {
      category = await Category.create({ name: categoryName.trim() });
    }

    const sku = String(row['SKU'] || row['sku'] || '').trim();
    const unit = String(row['Unit'] || row['unit'] || 'pcs').toLowerCase();
    const validUnits = ['kg', 'g', 'mm', 'l', 'ml', 'pcs', 'box', 'pack', 'meter'];
    const assignedUnit = validUnits.includes(unit) ? unit : 'pcs';

    const startBalance = Number(row['Start Balance'] || row['startBalance'] || 0) || 0;
    const currentQuantity = Number(row['Current Quantity'] || row['quantity'] || startBalance) || 0;
    const endBalance = Number(row['End Balance'] || row['endBalance'] || currentQuantity) || currentQuantity;
    const minQuantity = Number(row['Min Quantity (Low Threshold)'] || row['minQuantity'] || 5) || 5;
    const maxQuantity = Number(row['Max Quantity'] || row['maxQuantity'] || 100) || 100;
    const costPrice = Number(row['Cost Price'] || row['costPrice'] || 0) || 0;
    const sellingPrice = Number(row['Selling Price'] || row['sellingPrice'] || 0) || 0;

    let existing = null;
    if (sku) {
      existing = await Product.findOne({ sku });
    }
    if (!existing) {
      existing = await Product.findOne({ name: name.trim() });
    }

    if (existing) {
      existing.category = category._id;
      existing.unit = assignedUnit;
      existing.startBalance = startBalance;
      existing.currentQuantity = currentQuantity;
      existing.endBalance = endBalance;
      existing.minQuantity = minQuantity;
      existing.maxQuantity = maxQuantity;
      existing.costPrice = costPrice;
      existing.sellingPrice = sellingPrice;
      await existing.save();
      updatedCount++;
    } else {
      await Product.create({
        name: name.trim(),
        sku,
        category: category._id,
        unit: assignedUnit,
        startBalance,
        currentQuantity,
        endBalance,
        minQuantity,
        maxQuantity,
        costPrice,
        sellingPrice,
      });
      importedCount++;
    }
  }

  res.json({
    message: 'Stock import complete',
    imported: importedCount,
    updated: updatedCount,
    totalRows: data.length,
  });
});

// ================= STOCK DASHBOARD STATS =================
export const getStockDashboardStats = asyncHandler(async (req, res) => {
  const totalProducts = await Product.countDocuments({ status: 'active' });
  const totalCategories = await Category.countDocuments();
  const allProducts = await Product.find({ status: 'active' })
    .populate('category', 'name')
    .populate('vendor', 'name phone email contactPerson');

  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalInventoryValue = 0;

  const lowStockItems = [];

  for (const p of allProducts) {
    const qty = p.currentQuantity || 0;
    const cost = p.costPrice || 0;
    totalInventoryValue += qty * cost;

    if (qty <= 0) {
      outOfStockCount++;
      lowStockItems.push(p);
    } else if (qty <= (p.minQuantity ?? 5)) {
      lowStockCount++;
      lowStockItems.push(p);
    }
  }

  res.json({
    totalProducts,
    totalCategories,
    lowStockCount,
    outOfStockCount,
    totalInventoryValue,
    lowStockItems: lowStockItems.slice(0, 10),
  });
});
