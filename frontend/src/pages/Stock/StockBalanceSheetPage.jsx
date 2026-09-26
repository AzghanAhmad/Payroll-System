import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TableProperties,
  Save,
  RotateCcw,
  Download,
  Search,
  Plus,
  Minus,
  Sparkles,
  Share2,
} from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import { stockApi } from '@/services';
import toast from 'react-hot-toast';
import WhatsAppShareModal from '@/components/stock/WhatsAppShareModal';

export default function StockBalanceSheetPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sheetData, setSheetData] = useState({});
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waText, setWaText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-products'],
    queryFn: () => stockApi.listProducts({}),
  });

  const products = data?.items || [];

  const updateSheetMutation = useMutation({
    mutationFn: stockApi.batchUpdateBalanceSheet,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-dashboard-stats'] });
      toast.success(res.message || 'Balance sheet saved successfully');
      setSheetData({});
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save sheet'),
  });

  // Calculate live values for a row
  const getRowValues = (prod) => {
    const edit = sheetData[prod._id] || {};
    const startBal = edit.startBalance !== undefined ? edit.startBalance : (prod.startBalance ?? 0);
    const addedIn = edit.addedIn !== undefined ? edit.addedIn : 0;
    const deductedOut = edit.deductedOut !== undefined ? edit.deductedOut : 0;

    // Automatic calculation: Start + In - Out
    let calculatedEnd = Number(startBal) + Number(addedIn) - Number(deductedOut);
    if (calculatedEnd < 0) calculatedEnd = 0;

    // If manual end balance was explicitly typed
    const endBal = edit.endBalance !== undefined ? edit.endBalance : calculatedEnd;

    return {
      startBal,
      addedIn,
      deductedOut,
      endBal,
      isDirty: !!sheetData[prod._id],
    };
  };

  const handleCellChange = (prodId, field, val) => {
    const num = val === '' ? '' : Number(val);
    setSheetData((prev) => {
      const current = prev[prodId] || {};
      const updated = { ...current, [field]: num };

      // Recalculate end balance if startBal, addedIn, or deductedOut changed
      if (field === 'startBalance' || field === 'addedIn' || field === 'deductedOut') {
        const prod = products.find((p) => p._id === prodId);
        const s = updated.startBalance !== undefined ? Number(updated.startBalance) : (prod.startBalance ?? 0);
        const inQty = updated.addedIn !== undefined ? Number(updated.addedIn) : 0;
        const outQty = updated.deductedOut !== undefined ? Number(updated.deductedOut) : 0;
        updated.endBalance = Math.max(0, s + inQty - outQty);
      }

      return { ...prev, [prodId]: updated };
    });
  };

  const handleSaveAll = () => {
    const rowsToUpdate = Object.entries(sheetData).map(([productId, edit]) => {
      const prod = products.find((p) => p._id === productId);
      const rowVal = getRowValues(prod);
      return {
        productId,
        startBalance: rowVal.startBal,
        currentQuantity: rowVal.endBal,
        endBalance: rowVal.endBal,
      };
    });

    if (rowsToUpdate.length === 0) {
      return toast.info('No changes to save');
    }

    updateSheetMutation.mutate(rowsToUpdate);
  };

  const handleExport = async () => {
    try {
      const res = await stockApi.exportExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Stock-Balance-Sheet.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleShareBalanceSheet = () => {
    const summary = products.map((p) => {
      const r = getRowValues(p);
      return `• ${p.name}: Start: ${r.startBal} | In: +${r.addedIn} | Out: -${r.deductedOut} | Final: *${r.endBal} ${p.unit}*`;
    }).slice(0, 25).join('\n');

    const msg = `*Alpha Group Stock Balance Sheet*\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `${summary}\n\n` +
      `_Automatic calculation: End Balance = Start + In - Out_`;

    setWaText(msg);
    setWaModalOpen(true);
  };

  const filtered = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const totalDirty = Object.keys(sheetData).length;

  return (
    <StockLayout title="Inventory Balance Sheet">
      {/* Top Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" /> Auto Balance Calculation Enabled
          </div>
          <h2 className="text-xl font-bold text-slate-900">Interactive Balance Sheet</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Modify Start Balance, Add (+), or Deduct (-) stock. End balance recalculates automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            onClick={handleShareBalanceSheet}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Sheet</span>
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          {totalDirty > 0 && (
            <button
              onClick={() => setSheetData({})}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard Changes</span>
            </button>
          )}

          <button
            onClick={handleSaveAll}
            disabled={totalDirty === 0 || updateSheetMutation.isPending}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors ${
              totalDirty > 0
                ? 'bg-sky-500 hover:bg-sky-600 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{updateSheetMutation.isPending ? 'Saving...' : `Save Changes ${totalDirty ? `(${totalDirty})` : ''}`}</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products in balance sheet..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>
      </div>

      {/* Interactive Spreadsheet Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Product Name</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-3 py-3.5 text-center">Unit</th>
                <th className="px-4 py-3.5 text-center bg-blue-50/50">Start Balance</th>
                <th className="px-4 py-3.5 text-center bg-emerald-50/50">+ Inward (Add)</th>
                <th className="px-4 py-3.5 text-center bg-amber-50/50">- Outward (Sold)</th>
                <th className="px-4 py-3.5 text-center bg-purple-50/50">Calculated End Balance</th>
                <th className="px-4 py-3.5 text-center">Min Threshold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    Loading balance sheet...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const { startBal, addedIn, deductedOut, endBal, isDirty } = getRowValues(p);
                  const isLow = endBal <= (p.minQuantity ?? 5);

                  return (
                    <tr
                      key={p._id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDirty ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Product Name */}
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {p.name}
                        {p.sku ? (
                          <span className="text-[11px] text-slate-400 font-mono block">
                            SKU: {p.sku}
                          </span>
                        ) : null}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {p.category?.name || 'General'}
                      </td>

                      {/* Unit */}
                      <td className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                        {p.unit}
                      </td>

                      {/* Start Balance (Editable in sheet) */}
                      <td className="px-3 py-2 bg-blue-50/30">
                        <input
                          type="number"
                          step="any"
                          value={startBal}
                          onChange={(e) => handleCellChange(p._id, 'startBalance', e.target.value)}
                          className="w-24 text-center text-xs font-semibold py-1.5 px-2 bg-white rounded-lg border border-blue-200 focus:outline-hidden focus:ring-2 focus:ring-blue-400 font-mono shadow-2xs"
                        />
                      </td>

                      {/* Inward Add (+) */}
                      <td className="px-3 py-2 bg-emerald-50/30">
                        <div className="flex items-center justify-center gap-1">
                          <Plus className="w-3 h-3 text-emerald-600" />
                          <input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={addedIn || ''}
                            onChange={(e) => handleCellChange(p._id, 'addedIn', e.target.value)}
                            className="w-20 text-center text-xs font-semibold py-1.5 px-2 bg-white rounded-lg border border-emerald-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 font-mono text-emerald-700 shadow-2xs"
                          />
                        </div>
                      </td>

                      {/* Outward Deduct (-) */}
                      <td className="px-3 py-2 bg-amber-50/30">
                        <div className="flex items-center justify-center gap-1">
                          <Minus className="w-3 h-3 text-amber-600" />
                          <input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={deductedOut || ''}
                            onChange={(e) => handleCellChange(p._id, 'deductedOut', e.target.value)}
                            className="w-20 text-center text-xs font-semibold py-1.5 px-2 bg-white rounded-lg border border-amber-200 focus:outline-hidden focus:ring-2 focus:ring-amber-400 font-mono text-amber-700 shadow-2xs"
                          />
                        </div>
                      </td>

                      {/* Automatically Calculated End Balance */}
                      <td className="px-3 py-2 bg-purple-50/30 text-center">
                        <div
                          className={`inline-block font-mono font-bold text-sm px-3 py-1.5 rounded-lg border ${
                            isLow
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-purple-100 text-purple-900 border-purple-200'
                          }`}
                        >
                          {endBal} {p.unit}
                        </div>
                      </td>

                      {/* Min Threshold */}
                      <td className="px-4 py-3 text-center text-xs text-slate-500 font-mono">
                        {p.minQuantity} {p.unit}
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
        defaultTitle="Share Stock Balance Sheet"
        text={waText}
      />
    </StockLayout>
  );
}
