import { useEffect, useRef, useState } from 'react';
import { Share2, Mail, Copy, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/utils/helpers';

/**
 * Share menu: native share, mailto, copy text, optional API email.
 * Props:
 *  - title, text, url (for Web Share / mailto / copy)
 *  - onEmail?: () => Promise — server email (payslip, leave, etc.)
 *  - emailLabel?: string
 *  - disabled?: boolean
 *  - className?: string
 *  - size?: number (icon size)
 */
export function ShareMenu({
  title = 'Share',
  text = '',
  url = '',
  onEmail,
  emailLabel = 'Email',
  disabled = false,
  className,
  size = 16,
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const body = [text, url].filter(Boolean).join('\n\n');

  const nativeShare = async () => {
    if (!navigator.share) {
      toast.error('Share not supported on this device — use Email or Copy');
      return;
    }
    try {
      await navigator.share({ title, text, url: url || undefined });
      setOpen(false);
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Share cancelled or failed');
    }
  };

  const mailto = () => {
    const href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    window.open(href, '_blank');
    setOpen(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body || title);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 1200);
      setOpen(false);
    } catch {
      toast.error('Copy failed');
    }
  };

  const doEmail = async () => {
    if (!onEmail) return;
    setBusy(true);
    try {
      await onEmail();
      setOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Email failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        disabled={disabled || busy}
        className="p-2 rounded-full hover:bg-slate-100 cursor-pointer disabled:opacity-50"
        title="Share"
        aria-label="Share"
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? (
          <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-slate-300" />
        ) : (
          <Share2 size={size} />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-[14px] border border-border bg-white py-1 shadow-lg">
          {typeof navigator !== 'undefined' && navigator.share && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={nativeShare}
            >
              <Share2 size={14} /> Share…
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
            onClick={mailto}
          >
            <Mail size={14} /> Open email app
          </button>
          {onEmail && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={doEmail}
            >
              <Mail size={14} /> {emailLabel}
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
            onClick={copy}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} Copy
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <X size={14} /> Close
          </button>
        </div>
      )}
    </div>
  );
}
