import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Package,
  Calendar,
  User,
  Share2,
} from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import { stockApi } from '@/services';
import WhatsAppShareModal from '@/components/stock/WhatsAppShareModal';

export default function StockHistoryPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // in, out, adjustment, initial
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', typeFilter],
    queryFn: () => stockApi.movements({ type: typeFilter || undefined, limit: 300 }),
  });

  const movements = data?.items || [];

  const filtered = useMemo(() => {
    if (!search.trim()) return movements;
    const q = search.toLowerCase();
    return movements.filter(
      (m) =>
        m.product?.name?.toLowerCase().includes(q) ||
        m.product?.sku?.toLowerCase().includes(q) ||
        m.reason?.toLowerCase().includes(q) ||
        m.reference?.toLowerCase().includes(q) ||
        m.recordedBy?.name?.toLowerCase().includes(q)
    );
  }, [movements, search]);

  const handleShareHistory = () => {
    const lines = filtered.slice(0, 20).map((m) => {
      const typeLabel = m.type === 'in' ? 'ADD (+)' : m.type === 'out' ? 'DEDUCT (-)' : m.type.toUpperCase();
      return `• ${new Date(m.date || m.createdAt).toLocaleDateString()} | ${m.product?.name}: ${typeLabel} ${m.quantity} ${m.product?.unit || 'pcs'} | End: ${m.endBalance} (${m.reason || 'Movement'})`;
    }).join('\n');

    const msg = `*Alpha Group Stock Movement History*\n` +
      `Generated: ${new Date().toLocaleDateString()}\n\n` +
      (lines || 'No recent stock movements found.') +
      `\n\n_Audit Log from Alpha Group Enterprise Suite_`;

    setWaText(msg);
    setWaModalOpen(true);
  };

  return (
    <StockLayout title="Stock Movement History">
      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 mb-2">
            <History className="w-3.5 h-3.5 text-sky-600" /> Complete Inventory Audit Trail
          </div>
          <h2 className="text-xl font-bold text-slate-900">Stock Movement History</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Audit log of all inward shipments, sales deductions, balance adjustments, and initial entries.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleShareHistory}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Share History Log</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product, SKU, employee, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
          >
            <option value="">All Movement Types</option>
            <option value="in">Inward / Added (+)</option>
            <option value="out">Outward / Sold (-)</option>
            <option value="adjustment">Balance Adjustments</option>
            <option value="initial">Initial Stock</option>
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Date &amp; Time</th>
                <th className="px-4 py-3.5">Product &amp; SKU</th>
                <th className="px-4 py-3.5 text-center">Type</th>
                <th className="px-4 py-3.5 text-right">Start Bal</th>
                <th className="px-4 py-3.5 text-right">Qty Changed</th>
                <th className="px-4 py-3.5 text-right">End Bal</th>
                <th className="px-4 py-3.5">Reason / Reference</th>
                <th className="px-4 py-3.5">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    Loading stock movement history...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No movement records found.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isIn = m.type === 'in' || m.type === 'initial';
                  const isOut = m.type === 'out';

                  return (
                    <tr key={m._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date */}
                      <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {new Date(m.date || m.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(m.date || m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {m.product?.name || 'Deleted Product'}
                        </div>
                        {m.product?.sku && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {m.product.sku}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 text-center">
                        {isIn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <ArrowDownLeft className="w-3 h-3" />
                            {m.type === 'initial' ? 'Initial' : 'Inward (+)'}
                          </span>
                        ) : isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <ArrowUpRight className="w-3 h-3" /> Outward (-)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                            <RefreshCw className="w-3 h-3" /> Adjustment
                          </span>
                        )}
                      </td>

                      {/* Start Bal */}
                      <td className="px-4 py-3 text-right text-xs text-slate-500 font-mono">
                        {m.startBalance ?? 0}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isIn ? 'text-emerald-600' : isOut ? 'text-amber-600' : 'text-purple-600'
                          }`}
                        >
                          {isIn ? '+' : isOut ? '-' : ''}
                          {m.quantity} {m.product?.unit || 'pcs'}
                        </span>
                      </td>

                      {/* End Bal */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 text-xs">
                        {m.endBalance ?? 0} {m.product?.unit || 'pcs'}
                      </td>

                      {/* Reason */}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{m.reason || 'Stock Update'}</div>
                        {m.reference && (
                          <div className="text-[10px] text-slate-400 font-mono">{m.reference}</div>
                        )}
                      </td>

                      {/* User */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {m.recordedBy?.name || 'System / Admin'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <WhatsAppShareModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        defaultTitle="Share Stock Movement History"
        text={waText}
      />
    </StockLayout>
  );
}
