import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Plus,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  LogOut,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { stockApi, stockSalesApi, employeeApi } from '@/services';
import { formatMoney } from '@/utils/helpers';
import toast from 'react-hot-toast';

export default function UserDashboardPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('add'); // 'add' (inward) | 'sale' (outward)
  const [search, setSearch] = useState('');

  // Form States
  const [addForm, setAddForm] = useState({
    productId: '',
    quantity: '',
    reason: 'Stock Inward / Restock',
    reference: '',
  });

  const [saleForm, setSaleForm] = useState({
    productId: '',
    quantity: 1,
    unitPrice: '',
    paymentMethod: 'cash',
    notes: '',
  });

  // Queries
  const { data: prodData, isLoading: prodLoading } = useQuery({
    queryKey: ['stock-products'],
    queryFn: () => stockApi.listProducts({}),
  });

  const { data: empData } = useQuery({
    queryKey: ['employees-list-stock'],
    queryFn: () => employeeApi.list({ status: 'active', limit: 200 }),
  });

  const { data: movementsData } = useQuery({
    queryKey: ['stock-movements-user'],
    queryFn: () => stockApi.movements({ limit: 15 }),
  });

  const products = prodData?.items || [];
  const employees = empData?.items || [];
  const recentMovements = movementsData?.items || [];

  // Mutations
  const adjustMutation = useMutation({
    mutationFn: stockApi.adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-user'] });
      toast.success('Stock added successfully!');
      setAddForm({ productId: '', quantity: '', reason: 'Stock Inward / Restock', reference: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to add stock'),
  });

  const saleMutation = useMutation({
    mutationFn: stockSalesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-user'] });
      toast.success('Sale logged and inventory updated!');
      setSaleForm({ productId: '', quantity: 1, unitPrice: '', paymentMethod: 'cash', notes: '' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to record sale'),
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!addForm.productId) return toast.error('Please choose a product');
    const qty = Number(addForm.quantity);
    if (isNaN(qty) || qty <= 0) return toast.error('Enter a valid quantity');

    adjustMutation.mutate({
      productId: addForm.productId,
      type: 'in',
      quantity: qty,
      reason: addForm.reason,
      reference: addForm.reference,
    });
  };

  const handleSaleSubmit = (e) => {
    e.preventDefault();
    if (!saleForm.productId) return toast.error('Please choose a product');
    const qty = Number(saleForm.quantity);
    if (isNaN(qty) || qty <= 0) return toast.error('Enter a valid quantity');

    const selectedProd = products.find((p) => p._id === saleForm.productId);
    const availableQty = selectedProd?.currentQuantity ?? 0;
    if (qty > availableQty) {
      return toast.error(`Insufficient stock! Only ${availableQty} ${selectedProd?.unit || 'units'} available`);
    }

    const assignedEmp = user?.employee || employees[0]?._id;
    if (!assignedEmp) return toast.error('No employee profile associated to log this sale');

    saleMutation.mutate({
      employee: assignedEmp,
      items: [
        {
          productId: saleForm.productId,
          quantity: qty,
          unitPrice: Number(saleForm.unitPrice) || selectedProd?.costPrice || 0,
        },
      ],
      paymentMethod: saleForm.paymentMethod,
      notes: saleForm.notes,
    });
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedAddProd = products.find((p) => p._id === addForm.productId);
  const selectedSaleProd = products.find((p) => p._id === saleForm.productId);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      {/* Top Navbar matching Alpha Group theme */}
      <header className="px-6 py-3.5 bg-sidebar border-b border-white/10 sticky top-0 z-20 flex items-center justify-between shadow-md text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
              Alpha Group Operations Portal
            </h1>
            <p className="text-[11px] text-sky-400 font-medium">Stock Inward &amp; Store Sales Management</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-200">{user?.name || user?.email}</span>
            <span className="text-[10px] text-slate-400 capitalize">{user?.role === 'employee' ? 'Staff Operations' : user?.role || 'Staff'}</span>
          </div>

          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner with Mode Switcher */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" /> Dedicated User Operations Center
            </div>
            <h2 className="text-xl font-bold text-slate-900">Manage Stock &amp; Sales</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quickly record received inventory batches or log point-of-sale customer orders with automatic deduction.
            </p>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('add')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'add'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>1. Stock Inward (Add)</span>
            </button>
            <button
              onClick={() => setActiveTab('sale')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sale'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>2. Record Sale (Deduct)</span>
            </button>
          </div>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Action Form (2 Cols) */}
          <div className="lg:col-span-2">
            {activeTab === 'add' ? (
              /* TAB 1: Stock Inward Form */
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <ArrowDownLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Inward Stock Batch</h3>
                      <p className="text-xs text-slate-500">Add received supplies directly into available stock</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    Operation: Inward (+)
                  </span>
                </div>

                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Choose Product *
                    </label>
                    <select
                      value={addForm.productId}
                      onChange={(e) => setAddForm({ ...addForm, productId: e.target.value })}
                      required
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    >
                      <option value="">-- Choose Product to Restock --</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} {p.sku ? `(SKU: ${p.sku})` : ''} — Current: {p.currentQuantity} {p.unit}
                        </option>
                      ))}
                    </select>

                    {selectedAddProd && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-sky-600" />
                          <span className="font-medium text-slate-700">Current Stock Balance:</span>
                        </div>
                        <span className="font-bold text-slate-900 font-mono">
                          {selectedAddProd.currentQuantity} {selectedAddProd.unit}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Quantity to Add * {selectedAddProd?.unit ? `(${selectedAddProd.unit})` : ''}
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        placeholder="e.g. 50"
                        value={addForm.quantity}
                        onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Batch / PO Reference (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. PO-8921, Delivery Slip #4"
                        value={addForm.reference}
                        onChange={(e) => setAddForm({ ...addForm, reference: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Inward Reason / Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. New supplier shipment, Factory delivery"
                      value={addForm.reason}
                      onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={adjustMutation.isPending}
                    className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-xs shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{adjustMutation.isPending ? 'Updating Inventory...' : 'Confirm Stock Inward'}</span>
                  </button>
                </form>
              </div>
            ) : (
              /* TAB 2: Record Sales Form */
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Record Customer Sale</h3>
                      <p className="text-xs text-slate-500">Logs sale and deducts item count from inventory immediately</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Operation: Sale (-)
                  </span>
                </div>

                <form onSubmit={handleSaleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Sold Product *
                    </label>
                    <select
                      value={saleForm.productId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const prod = products.find((p) => p._id === pid);
                        setSaleForm({
                          ...saleForm,
                          productId: pid,
                          unitPrice: prod?.costPrice || '',
                        });
                      }}
                      required
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    >
                      <option value="">-- Choose Sold Item --</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id} disabled={p.currentQuantity <= 0}>
                          {p.name} — In Stock: {p.currentQuantity} {p.unit} {p.currentQuantity <= 0 ? '(OUT OF STOCK)' : ''}
                        </option>
                      ))}
                    </select>

                    {selectedSaleProd && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          Available: <strong className="text-slate-900 font-mono">{selectedSaleProd.currentQuantity} {selectedSaleProd.unit}</strong>
                        </span>
                        <span className="text-slate-600">
                          Cost: <strong className="text-slate-900 font-mono">{formatMoney(selectedSaleProd.costPrice)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Quantity Sold * {selectedSaleProd?.unit ? `(${selectedSaleProd.unit})` : ''}
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        placeholder="1"
                        value={saleForm.quantity}
                        onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Sale Unit Price *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        placeholder="0.00"
                        value={saleForm.unitPrice}
                        onChange={(e) => setSaleForm({ ...saleForm, unitPrice: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Payment Method
                      </label>
                      <select
                        value={saleForm.paymentMethod}
                        onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                      >
                        <option value="cash">Cash Payment</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="credit">Credit / Account</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Order / Customer Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Retail Counter Sale"
                        value={saleForm.notes}
                        onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-900">Total Transaction Amount:</span>
                    <span className="font-bold text-emerald-700 font-mono text-sm">
                      {formatMoney((Number(saleForm.quantity) || 0) * (Number(saleForm.unitPrice) || 0))}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={saleMutation.isPending}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>{saleMutation.isPending ? 'Logging Transaction...' : 'Complete & Record Sale'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Col: Live Stock Search & Recent Movements */}
          <div className="space-y-6">
            {/* Quick Stock Balances */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-sm">Catalog Status</h3>
                <span className="text-[10px] text-slate-400">{products.length} Products</span>
              </div>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter stock by name or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {prodLoading ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Loading products...</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No products matching</p>
                ) : (
                  filteredProducts.slice(0, 10).map((p) => {
                    const isLow = p.currentQuantity <= (p.minQuantity ?? 5);
                    const isOut = p.currentQuantity <= 0;
                    return (
                      <div
                        key={p._id}
                        onClick={() => {
                          if (activeTab === 'add') setAddForm({ ...addForm, productId: p._id });
                          else setSaleForm({ ...saleForm, productId: p._id, unitPrice: p.costPrice || '' });
                        }}
                        className="p-2.5 rounded-xl border border-slate-100 hover:border-sky-300 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {p.sku || p.category?.name || 'General'}
                          </p>
                        </div>
                        <span
                          className={`font-bold font-mono text-xs px-2 py-0.5 rounded-md shrink-0 ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {p.currentQuantity} {p.unit}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent Audit Movements */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Recent Operations Log
              </h3>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {recentMovements.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No recent operations logged.</p>
                ) : (
                  recentMovements.slice(0, 6).map((m) => (
                    <div
                      key={m._id}
                      className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-900 truncate">{m.product?.name || 'Item'}</p>
                        <p className="text-[10px] text-slate-500">
                          {m.type === 'in' ? '+ Inward Add' : '- Sale / Out'} &bull;{' '}
                          {new Date(m.date || m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span
                        className={`font-bold font-mono text-xs shrink-0 ${
                          m.type === 'in' ? 'text-sky-600' : 'text-emerald-600'
                        }`}
                      >
                        {m.type === 'in' ? `+${m.quantity}` : `-${m.quantity}`} {m.product?.unit || 'pcs'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        &copy; {new Date().getFullYear()} Alpha Group Operations &bull; Real-time Inventory &amp; Sales Management
      </footer>
    </div>
  );
}
