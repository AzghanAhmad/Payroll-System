import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trophy,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  UserCheck,
  Award,
  Medal,
  Share2,
  X,
  Package,
} from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import { stockSalesApi, employeeApi, stockApi } from '@/services';
import { formatMoney } from '@/utils/helpers';
import toast from 'react-hot-toast';
import WhatsAppShareModal from '@/components/stock/WhatsAppShareModal';

export default function EmployeeSalesPage() {
  const queryClient = useQueryClient();
  const [timeframe, setTimeframe] = useState('month'); // 'week' | 'month'
  const [modalOpen, setModalOpen] = useState(false);

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');

  // Sale Entry Form State
  const [saleForm, setSaleForm] = useState({
    employee: '',
    productId: '',
    quantity: 1,
    unitPrice: 0,
    paymentMethod: 'cash',
    notes: '',
  });

  // Queries
  const { data: topData, isLoading: topLoading } = useQuery({
    queryKey: ['stock-top-employees', timeframe],
    queryFn: () => stockSalesApi.topEmployees({ timeframe }),
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['stock-sales-list'],
    queryFn: () => stockSalesApi.list({}),
  });

  const { data: empData } = useQuery({
    queryKey: ['employees-list-sales'],
    queryFn: () => employeeApi.list({ status: 'active', limit: 200 }),
  });

  const { data: prodData } = useQuery({
    queryKey: ['stock-products-sales'],
    queryFn: () => stockApi.listProducts({}),
  });

  const employees = empData?.items || [];
  const products = prodData?.items || [];
  const leaderboard = topData?.leaderboard || [];
  const topEmployee = topData?.topEmployee || null;
  const recentSales = salesData?.items || [];

  // Mutations
  const createSaleMutation = useMutation({
    mutationFn: stockSalesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-sales-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-top-employees'] });
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-dashboard-stats'] });
      toast.success('Sale logged & inventory deducted');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error recording sale'),
  });

  const cancelSaleMutation = useMutation({
    mutationFn: stockSalesApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-sales-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-top-employees'] });
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      toast.success('Sale cancelled and stock restored');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error cancelling sale'),
  });

  const openModal = () => {
    setSaleForm({
      employee: employees[0]?._id || '',
      productId: products[0]?._id || '',
      quantity: 1,
      unitPrice: products[0]?.sellingPrice || 0,
      paymentMethod: 'cash',
      notes: '',
    });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleProductChange = (prodId) => {
    const prod = products.find((p) => p._id === prodId);
    setSaleForm((prev) => ({
      ...prev,
      productId: prodId,
      unitPrice: prod?.sellingPrice || 0,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!saleForm.employee) return toast.error('Employee is required');
    if (!saleForm.productId) return toast.error('Product is required');

    const qty = Number(saleForm.quantity);
    if (isNaN(qty) || qty <= 0) return toast.error('Valid quantity required');

    const payload = {
      employee: saleForm.employee,
      items: [
        {
          productId: saleForm.productId,
          quantity: qty,
          unitPrice: Number(saleForm.unitPrice) || 0,
        },
      ],
      paymentMethod: saleForm.paymentMethod,
      notes: saleForm.notes,
    };

    createSaleMutation.mutate(payload);
  };

  const handleShareLeaderboard = () => {
    const lines = leaderboard
      .map((item, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        return `${medal} *${item.employee?.fullName}*: ${formatMoney(item.totalRevenue)} (${item.totalSalesCount} sales, ${item.totalItemsSold} items)`;
      })
      .join('\n');

    const msg = `🏆 *Alpha Group Top Sales Performers (${timeframe.toUpperCase()})*\n` +
      `📅 Period: ${new Date(topData?.startDate).toLocaleDateString()} - ${new Date(topData?.endDate).toLocaleDateString()}\n\n` +
      (lines || 'No sales recorded in this period yet.') +
      `\n\n_Congratulations to our top employer / sales champions!_`;

    setWaText(msg);
    setWaModalOpen(true);
  };

  return (
    <StockLayout title="Employee Sales & Leaderboard">
      {/* Header Bar & Timeframe Switch */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 mb-2">
            <Trophy className="w-3.5 h-3.5 text-purple-600" /> Sales Leaderboard &amp; Top Employee Ranking
          </div>
          <h2 className="text-xl font-bold text-slate-900">Employee Sales Performance</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Log employee transactions, review weekly or monthly top performers, and share recognitions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Week / Month Switch */}
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setTimeframe('week')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeframe === 'week'
                  ? 'bg-white text-purple-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setTimeframe('month')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                timeframe === 'month'
                  ? 'bg-white text-purple-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
          </div>

          <button
            onClick={handleShareLeaderboard}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Ranking</span>
          </button>

          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record Sale</span>
          </button>
        </div>
      </div>

      {/* Top Employee Spotlight Card */}
      {topEmployee && (
        <div className="bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center font-bold text-2xl shadow-md overflow-hidden">
                {topEmployee.employee?.photo ? (
                  <img
                    src={topEmployee.employee.photo}
                    alt={topEmployee.employee.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCheck className="w-10 h-10 text-white" />
                )}
              </div>
              <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-bold shadow-md">
                👑
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider block">
                Top Employer / Performer of the {timeframe === 'week' ? 'Week' : 'Month'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                {topEmployee.employee?.fullName}
              </h3>
              <p className="text-xs text-purple-200 mt-1">
                ID: {topEmployee.employee?.employeeId} &bull; {topEmployee.employee?.position || 'Staff'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20">
            <div className="text-center">
              <span className="text-[11px] text-purple-200 uppercase font-semibold block">Total Revenue</span>
              <span className="text-xl font-extrabold tracking-tight">
                {formatMoney(topEmployee.totalRevenue)}
              </span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <span className="text-[11px] text-purple-200 uppercase font-semibold block">Sales Made</span>
              <span className="text-xl font-extrabold tracking-tight">
                {topEmployee.totalSalesCount}
              </span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <span className="text-[11px] text-purple-200 uppercase font-semibold block">Units Sold</span>
              <span className="text-xl font-extrabold tracking-tight">
                {topEmployee.totalItemsSold}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Leaderboard + Recent Sales Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Leaderboard Table */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Top Employees Leaderboard</h3>
              <p className="text-xs text-slate-500">
                Ranked by total sales revenue for this {timeframe}
              </p>
            </div>
            <Award className="w-5 h-5 text-amber-500" />
          </div>

          {topLoading ? (
            <div className="text-center py-12 text-slate-400">Loading ranking...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No sales logged for this {timeframe} yet. Record a sale to start rankings!
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((item, idx) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-800'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-700'
                          : idx === 2
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-white border border-slate-200 text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {item.employee?.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.totalSalesCount} transactions &bull; {item.totalItemsSold} items
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-purple-700 text-sm">
                      {formatMoney(item.totalRevenue)}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Revenue</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Recent Sales Activity */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Sales Activity</h3>
              <p className="text-xs text-slate-500">Live sales log with automatic inventory deduction</p>
            </div>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>

          {salesLoading ? (
            <div className="text-center py-12 text-slate-400">Loading sales activity...</div>
          ) : recentSales.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No sales logged yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {recentSales.map((sale) => (
                <div
                  key={sale._id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                      {sale.employee?.fullName || 'Employee'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {sale.items.map((it) => `${it.product?.name} (${it.quantity} ${it.product?.unit || 'pcs'})`).join(', ')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>{new Date(sale.date).toLocaleDateString()}</span>
                      <span>&bull;</span>
                      <span className="capitalize">{sale.paymentMethod}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm font-mono">
                        {formatMoney(sale.totalAmount)}
                      </div>
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
                        {sale.status}
                      </span>
                    </div>

                    {sale.status === 'completed' && (
                      <button
                        onClick={() => {
                          if (confirm('Cancel this sale and restore stock?')) {
                            cancelSaleMutation.mutate(sale._id);
                          }
                        }}
                        title="Cancel sale and restore inventory"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Record Sale Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Record Employee Sale</h3>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sales Employee *
                </label>
                <select
                  value={saleForm.employee}
                  onChange={(e) => setSaleForm({ ...saleForm, employee: e.target.value })}
                  required
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.fullName} ({e.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Sold *
                </label>
                <select
                  value={saleForm.productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} — Current: {p.currentQuantity} {p.unit} ($
                      {p.sellingPrice})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={saleForm.unitPrice}
                    onChange={(e) => setSaleForm({ ...saleForm, unitPrice: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl flex items-center justify-between text-xs font-semibold text-purple-900">
                <span>Total Sale Amount:</span>
                <span className="text-base font-bold font-mono">
                  {formatMoney((Number(saleForm.quantity) || 0) * (Number(saleForm.unitPrice) || 0))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Customer invoice / transaction remarks..."
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaleMutation.isPending}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-xs"
                >
                  {createSaleMutation.isPending ? 'Logging...' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Share Leaderboard Modal */}
      <WhatsAppShareModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        defaultTitle="Share Sales Leaderboard"
        text={waText}
      />
    </StockLayout>
  );
}
