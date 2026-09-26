import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  Share2,
  AlertTriangle,
  CheckCircle2,
  X,
  Boxes,
} from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import { stockApi, vendorApi } from '@/services';
import { formatMoney } from '@/utils/helpers';
import toast from 'react-hot-toast';
import WhatsAppShareModal from '@/components/stock/WhatsAppShareModal';

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'mm', label: 'Millimeters (mm)' },
  { value: 'meter', label: 'Meters (m)' },
  { value: 'l', label: 'Liters (l)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'box', label: 'Box' },
  { value: 'pack', label: 'Pack' },
];

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState(searchParams.get('lowStock') === 'true' ? 'low' : 'all');

  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editingProduct, setEditingProduct] = useState(null);

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');

  // Form State
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    vendor: '',
    unit: 'pcs',
    startBalance: 0,
    currentQuantity: 0,
    minQuantity: 5,
    maxQuantity: 100,
    costPrice: 0,
    description: '',
  });

  // Queries
  const { data: prodData, isLoading } = useQuery({
    queryKey: ['stock-products'],
    queryFn: () => stockApi.listProducts({}),
  });

  const { data: catData } = useQuery({
    queryKey: ['stock-categories'],
    queryFn: stockApi.listCategories,
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: () => vendorApi.list({}),
  });

  const products = prodData?.items || [];
  const categories = catData?.items || [];
  const vendors = vendorData?.items || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: stockApi.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-dashboard-stats'] });
      toast.success('Product added successfully');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add product'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => stockApi.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-dashboard-stats'] });
      toast.success('Product updated');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update product'),
  });

  const deleteMutation = useMutation({
    mutationFn: stockApi.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-dashboard-stats'] });
      toast.success('Product deleted');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete product'),
  });

  const uploadMutation = useMutation({
    mutationFn: stockApi.importExcel,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-dashboard-stats'] });
      toast.success(`Imported: ${res.imported} new, ${res.updated} updated!`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Excel upload failed'),
  });

  // Modal Handlers
  const openModal = (prod = null) => {
    if (prod) {
      setEditingProduct(prod);
      setForm({
        name: prod.name || '',
        sku: prod.sku || '',
        category: prod.category?._id || prod.category || '',
        vendor: prod.vendor?._id || prod.vendor || '',
        unit: prod.unit || 'pcs',
        startBalance: prod.startBalance ?? 0,
        currentQuantity: prod.currentQuantity ?? 0,
        minQuantity: prod.minQuantity ?? 5,
        maxQuantity: prod.maxQuantity ?? 100,
        costPrice: prod.costPrice ?? 0,
        description: prod.description || '',
      });
    } else {
      setEditingProduct(null);
      setForm({
        name: '',
        sku: '',
        category: categories[0]?._id || '',
        vendor: '',
        unit: 'pcs',
        startBalance: 0,
        currentQuantity: 0,
        minQuantity: 5,
        maxQuantity: 100,
        costPrice: 0,
        description: '',
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Product name is required');
    if (!form.category) return toast.error('Please select a category');

    const payload = {
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim(),
      startBalance: Number(form.startBalance) || 0,
      currentQuantity: Number(form.currentQuantity) || 0,
      minQuantity: Number(form.minQuantity) || 5,
      maxQuantity: Number(form.maxQuantity) || 100,
      costPrice: Number(form.costPrice) || 0,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Excel handlers
  const handleExport = async () => {
    try {
      const res = await stockApi.exportExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Stock-Inventory.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Stock sheet downloaded');
    } catch {
      toast.error('Failed to export Excel');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = '';
    }
  };

  // WhatsApp share
  const handleShareProduct = (prod) => {
    const msg = `*Product Stock Details*\n` +
      `📦 Product: *${prod.name}*\n` +
      (prod.sku ? `🏷️ SKU: ${prod.sku}\n` : '') +
      `📂 Category: ${prod.category?.name || 'General'}\n` +
      `⚖️ Current Balance: *${prod.currentQuantity} ${prod.unit}*\n` +
      `⚠️ Low Stock Threshold: ${prod.minQuantity} ${prod.unit}\n` +
      `💵 Cost Price: ${formatMoney(prod.costPrice)}\n` +
      `📊 Status: ${prod.currentQuantity <= prod.minQuantity ? 'LOW STOCK ⚠️' : 'IN STOCK ✅'}`;
    setWaText(msg);
    setWaModalOpen(true);
  };

  // Filtering
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.name?.toLowerCase().includes(search.toLowerCase());

      const matchCat = !categoryFilter || p.category?._id === categoryFilter;

      let matchStock = true;
      if (stockFilter === 'low') {
        matchStock = p.currentQuantity <= (p.minQuantity ?? 5);
      } else if (stockFilter === 'out') {
        matchStock = p.currentQuantity <= 0;
      } else if (stockFilter === 'in') {
        matchStock = p.currentQuantity > (p.minQuantity ?? 5);
      }

      return matchSearch && matchCat && matchStock;
    });
  }, [products, search, categoryFilter, stockFilter]);

  return (
    <StockLayout title="Products & Inventory">
      {/* Action Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stock Catalog &amp; Balances</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Configure units (kg, g, mm, l), thresholds, and track inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Download & Upload */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel</span>
          </button>

          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, SKU, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        {/* Category Filter */}
        <div className="w-full md:w-48">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Status Filter */}
        <div className="w-full md:w-40">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
          >
            <option value="all">All Stock Status</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock Only</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Product &amp; SKU</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5 text-center">Unit</th>
                <th className="px-4 py-3.5 text-right">Start Bal</th>
                <th className="px-4 py-3.5 text-right">Current Qty</th>
                <th className="px-4 py-3.5 text-right">Min / Max</th>
                <th className="px-4 py-3.5 text-right">Cost Price</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    Loading product inventory...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.currentQuantity <= (p.minQuantity ?? 5);
                  const isOut = p.currentQuantity <= 0;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        {p.sku ? (
                          <div className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {p.category?.name || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-700 uppercase">
                        {p.unit}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-slate-500 font-mono">
                        {p.startBalance ?? 0}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`font-bold font-mono text-sm ${
                            isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}
                        >
                          {p.currentQuantity} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-slate-500">
                        {p.minQuantity} / {p.maxQuantity}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-800 text-xs">
                        {formatMoney(p.costPrice)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3" /> Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> In Stock
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleShareProduct(p)}
                            title="Share on WhatsApp"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openModal(p)}
                            title="Edit"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete product "${p.name}"?`)) {
                                deleteMutation.mutate(p._id);
                              }
                            }}
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Industrial Steel Wire"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Barcode</label>
                  <input
                    type="text"
                    placeholder="e.g. PRD-001"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit of Measure *
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vendor / Supplier
                  </label>
                  <select
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  >
                    <option value="">None / Not assigned</option>
                    {vendors.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Balance
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.startBalance}
                    onChange={(e) => setForm({ ...form, startBalance: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.currentQuantity}
                    onChange={(e) => setForm({ ...form, currentQuantity: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-700 mb-1">
                    Min Quantity (Low Threshold)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.minQuantity}
                    onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-amber-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Quantity Limit
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.maxQuantity}
                    onChange={(e) => setForm({ ...form, maxQuantity: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Product specification, dimensions, grade..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-xs"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      <WhatsAppShareModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        defaultTitle="Product Stock Information"
        text={waText}
      />
    </StockLayout>
  );
}
