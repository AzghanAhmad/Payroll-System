import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Boxes,
  AlertTriangle,
  PackageCheck,
  TrendingUp,
  Truck,
  Trophy,
  ArrowRight,
  Plus,
  TableProperties,
  Share2,
} from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import { stockApi, stockSalesApi } from '@/services';
import { formatMoney, formatNumber } from '@/utils/helpers';
import { useState } from 'react';
import WhatsAppShareModal from '@/components/stock/WhatsAppShareModal';

export default function StockDashboardPage() {
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');
  const [waPhone, setWaPhone] = useState('');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stock-dashboard-stats'],
    queryFn: stockApi.getDashboardStats,
  });

  const { data: topData } = useQuery({
    queryKey: ['stock-top-employees', 'month'],
    queryFn: () => stockSalesApi.topEmployees({ timeframe: 'month' }),
  });

  const handleShareStockSummary = () => {
    const lowStockItemsText = (stats?.lowStockItems || [])
      .map((it) => `- ${it.name}: ${it.currentQuantity} ${it.unit} (Min: ${it.minQuantity})`)
      .join('\n');

    const message = `*Alpha Group Stock Status Update*\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `Total Products: ${stats?.totalProducts ?? 0}\n` +
      `Low Stock Items: ${stats?.lowStockCount ?? 0}\n` +
      `Out of Stock: ${stats?.outOfStockCount ?? 0}\n` +
      `Inventory Value: $${(stats?.totalInventoryValue || 0).toLocaleString()}\n\n` +
      (stats?.lowStockCount > 0 ? `*Items Needing Restock:*\n${lowStockItemsText}\n\n` : '') +
      `_Generated via Alpha Group Enterprise Suite_`;

    setWaPhone('');
    setWaText(message);
    setWaModalOpen(true);
  };

  const handleShareLowStockAlert = (item) => {
    const vendorName = item.vendor?.name || 'Supplier';
    const vendorPhone = item.vendor?.phone || '';
    const message = `*URGENT: Low Stock Reorder Alert*\n\n` +
      `Hello ${vendorName},\n` +
      `We need to place a restock order for:\n` +
      `Product: *${item.name}*\n` +
      (item.sku ? `SKU: ${item.sku}\n` : '') +
      `Current Remaining Stock: *${item.currentQuantity} ${item.unit}*\n` +
      `Threshold Level: ${item.minQuantity} ${item.unit}\n` +
      `Max Capacity: ${item.maxQuantity} ${item.unit}\n\n` +
      `Please let us know your earliest delivery date and unit price quotation.\n\n` +
      `Thank you,\nAlpha Group Management`;

    setWaPhone(vendorPhone);
    setWaText(message);
    setWaModalOpen(true);
  };

  return (
    <StockLayout title="Stock Overview">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventory &amp; Operations Command</h2>
          <p className="text-slate-500 text-sm mt-1">
            Real-time catalog monitoring, low-stock thresholds, and balance sheets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleShareStockSummary}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>Share Status on WhatsApp</span>
          </button>
          <Link
            to="/stock/products?new=1"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {isLoading ? '...' : formatNumber(stats?.totalProducts ?? 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Across all categories</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Low Stock Alert</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {isLoading ? '...' : formatNumber(stats?.lowStockCount ?? 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Below reorder threshold</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Value</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {isLoading ? '...' : formatMoney(stats?.totalInventoryValue ?? 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Based on cost price</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Top Seller of the Month */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Top Employee (Month)</span>
            <div className="text-base font-bold text-slate-900 mt-1 truncate max-w-[150px]">
              {topData?.topEmployee?.employee?.fullName || 'No sales yet'}
            </div>
            <span className="text-[11px] text-purple-600 font-medium mt-0.5 block">
              {topData?.topEmployee ? formatMoney(topData.topEmployee.totalRevenue) : '$0.00'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid: Low Stock Alert List + Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Low Stock Reorder Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Low Stock Reorder List</h3>
              <p className="text-xs text-slate-500">Products at or below their low stock threshold</p>
            </div>
            <Link
              to="/stock/products?lowStock=true"
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!stats?.lowStockItems?.length ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <PackageCheck className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              All products are well stocked above their minimum thresholds!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Product</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3 text-right">Balance</th>
                    <th className="pb-3 text-right">Min Qty</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right">Notify Vendor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.lowStockItems.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/70">
                      <td className="py-3 font-medium text-slate-900">
                        {item.name}
                        {item.sku && <span className="text-xs text-slate-400 ml-1.5 font-mono">({item.sku})</span>}
                      </td>
                      <td className="py-3 text-slate-500 text-xs">
                        {item.category?.name || 'General'}
                      </td>
                      <td className="py-3 text-right font-semibold text-red-600">
                        {item.currentQuantity} {item.unit}
                      </td>
                      <td className="py-3 text-right text-slate-500 text-xs">
                        {item.minQuantity} {item.unit}
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          Low Stock
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleShareLowStockAlert(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                          title="Send Low Stock Alert via WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Quick Feature Shortcuts */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-3xl p-6 text-white shadow-md">
            <h3 className="font-bold text-lg mb-1">Interactive Balance Sheet</h3>
            <p className="text-sky-100 text-xs leading-relaxed mb-4">
              Enter Start Balance, Inward, and Outward quantities with real-time automatic balance calculations.
            </p>
            <Link
              to="/stock/balance-sheet"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-white text-sky-600 hover:bg-sky-50 font-bold text-xs transition-colors shadow-xs"
            >
              <TableProperties className="w-4 h-4" />
              <span>Open Balance Sheet</span>
            </Link>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Quick Navigation</h4>
            <div className="space-y-2">
              <Link
                to="/stock/vendors"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Truck className="w-4 h-4 text-sky-500" />
                  <span>Vendor Directory &amp; WhatsApp</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              <Link
                to="/stock/history"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-4 h-4 text-sky-500" />
                  <span>Stock Movement History</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <WhatsAppShareModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        defaultTitle="WhatsApp Alert"
        text={waText}
        initialPhone={waPhone}
      />
    </StockLayout>
  );
}
