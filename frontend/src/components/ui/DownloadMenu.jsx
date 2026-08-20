import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/helpers';

/**
 * Download menu with PDF / Excel options.
 * @param {{ onPdf?: () => void|Promise, onExcel?: () => void|Promise, label?: string, disabled?: boolean, size?: 'sm'|'md', variant?: string, className?: string, iconOnly?: boolean }} props
 */
export function DownloadMenu({
  onPdf,
  onExcel,
  label = 'Download',
  disabled = false,
  size = 'md',
  variant = 'outline',
  className,
  iconOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const run = async (fn) => {
    if (!fn) return;
    setBusy(true);
    try {
      await fn();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      {iconOnly ? (
        <button
          type="button"
          disabled={disabled || busy}
          className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
          title={label}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
        >
          <Download size={15} />
        </button>
      ) : (
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={disabled || busy}
          onClick={() => setOpen((v) => !v)}
        >
          <Download size={16} />
          {busy ? 'Preparing…' : label}
          <ChevronDown size={14} />
        </Button>
      )}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-[14px] border border-border bg-white py-1 shadow-lg">
          {onPdf && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => run(onPdf)}
            >
              <FileText size={14} /> Download as PDF
            </button>
          )}
          {onExcel && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => run(onExcel)}
            >
              <FileSpreadsheet size={14} /> Download as Excel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
