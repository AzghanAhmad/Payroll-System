import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Plus,
  Minus,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { stockApi, stockSalesApi, employeeApi } from '@/services';
import { formatMoney } from '@/utils/helpers';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function UserStockDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

    // Identify user employee record or first employee
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Navbar matching Payroll theme */}
      <header className="px-6 py-3.5 bg-sidebar border-b border-white/10 sticky top-0 z-20 flex items-center justify-between shadow-md text-white">
        <div className="flex items-center gap-3">
          <img
            src="/Payroll-Icon.png"
            alt="Alpha Group"
            className="h-9 w-auto max-w-[140px] object-contain"
          />
          <div className="border-l border-white/10 pl-3">
            <h1 className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-sky-400" /> Stock Operations Center
            </h1>
            <p className="text-[11px] text-slate-400">Quick Inward &amp; Sales Management</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/hub')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white transition-colors border border-white/10"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Workspace Hub</span>
          </button>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner with Tabs */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Manage Stock Operations</h2>
            <p className="text-xs text-slate-500 mt-1">
              Add new inventory batches into the warehouse, or record product sales with real-time stock deduction.
            </p>
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('add')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'add'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stock (Inward)</span>
            </button>
            <button
              onClick={() => setActiveTab('sale')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sale'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Record Sale (Outward)</span>
            </button>
          </div>
        </div>

        {/* 2 Columns: Action Form & Current Inventory Quick View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs h-fit">
            {activeTab === 'add' ? (
              <div>
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Add Inward Stock</h3>
                    <p className="text-[11px] text-slate-400">Increase inventory balance for received products</p>
                  </div>
                </div>

                <form onSubmit={handleAddSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Product *
                    </label>
                    <select
                      value={addForm.productId}
                      onChange={(e) => setAddForm({ ...addForm, productId: e.target.value })}
                      required
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} — Current: {p.currentQuantity} {p.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedAddProd && (
                    <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600">Current Balance:</span>
                      <span className="font-bold text-sky-700 font-mono">
                        {selectedAddProd.currentQuantity} {selectedAddProd.unit}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quantity to Add *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="e.g. 50"
                      value={addForm.quantity}
                      onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reason / Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vendor shipment, purchase batch"
                      value={addForm.reason}
                      onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Invoice / Delivery Reference
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PO-84920"
                      value={addForm.reference}
                      onChange={(e) => setAddForm({ ...addForm, reference: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={adjustMutation.isPending}
                    className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    {adjustMutation.isPending ? 'Processing...' : 'Confirm Inward Stock'}
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Record Outward Sale</h3>
                    <p className="text-[11px] text-slate-400">Deduct stock balance immediately upon customer purchase</p>
                  </div>
                </div>

                <form onSubmit={handleSaleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Product *
                    </label>
                    <select
                      value={saleForm.productId}
                      onChange={(e) => {
                        const pId = e.target.value;
                        const p = products.find((prod) => prod._id === pId);
                        setSaleForm({
                          ...saleForm,
                          productId: pId,
                          unitPrice: p?.costPrice || '',
                        });
                      }}
                      required
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} — In Stock: {p.currentQuantity} {p.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedSaleProd && (
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
                      <span className="text-slate-600">Available Stock:</span>
                      <span className={`font-bold font-mono ${selectedSaleProd.currentQuantity <= selectedSaleProd.minQuantity ? 'text-amber-600' : 'text-purple-700'}`}>
                        {selectedSaleProd.currentQuantity} {selectedSaleProd.unit}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        required
                        value={saleForm.quantity}
                        onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Price Per Unit ($)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={saleForm.unitPrice}
                        onChange={(e) => setSaleForm({ ...saleForm, unitPrice: e.target.value })}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={saleForm.paymentMethod}
                      onChange={(e) => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="credit">Credit</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                    <input
                      type="text"
                      placeholder="Receipt or customer reference..."
                      value={saleForm.notes}
                      onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saleMutation.isPending}
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    {saleMutation.isPending ? 'Processing...' : 'Confirm & Deduct Stock'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Inventory Quick Lookup & Movement Stream (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Quick Catalog Search */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-sm">Product Inventory Lookup</h3>
                <span className="text-xs text-slate-400">{filteredProducts.length} items</span>
              </div>

              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Quick search by product name or SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 pr-1">
                {filteredProducts.slice(0, 10).map((prod) => (
                  <div key={prod._id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-slate-900">{prod.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {prod.category?.name || 'General'} &bull; {prod.sku || 'No SKU'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono font-bold text-xs text-slate-900">
                          {prod.currentQuantity} {prod.unit}
                        </div>
                        <span className="text-[10px] text-slate-400">Min: {prod.minQuantity}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeTab === 'add') {
                            setAddForm((prev) => ({ ...prev, productId: prod._id }));
                          } else {
                            setSaleForm((prev) => ({
                              ...prev,
                              productId: prod._id,
                              unitPrice: prod.costPrice || '',
                            }));
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Stock Activities Feed */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <h3 className="font-bold text-slate-900 text-sm">Recent Activity Stream</h3>
                </div>
                <button
                  onClick={() => navigate('/stock/history')}
                  className="text-xs text-sky-600 font-semibold hover:underline"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {recentMovements.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">No recent movements logged.</div>
                ) : (
                  recentMovements.slice(0, 8).map((m) => {
                    const isIn = m.type === 'in' || m.type === 'initial';
                    return (
                      <div
                        key={m._id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isIn ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{m.product?.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(m.date || m.createdAt).toLocaleDateString()} &bull; {m.reason || 'Update'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-bold font-mono ${isIn ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {isIn ? '+' : '-'}{m.quantity} {m.product?.unit || 'pcs'}
                          </div>
                          <div className="text-[10px] text-slate-400">Bal: {m.endBalance}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white/60">
        Alpha Group Inventory &bull; Dedicated Stock Add &amp; Sales Management Portal
      </footer>
    </div>
  );
}
