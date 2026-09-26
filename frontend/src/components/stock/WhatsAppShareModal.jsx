import { useState, useEffect } from 'react';
import { MessageCircle, Copy, Check, ExternalLink, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  defaultTitle = 'Stock Update',
  text = '',
  initialPhone = '',
}) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || '');
  const [messageText, setMessageText] = useState(text || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMessageText(text || '');
  }, [text]);

  useEffect(() => {
    if (initialPhone) setPhoneNumber(initialPhone);
  }, [initialPhone]);

  if (!isOpen) return null;

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(messageText);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    toast.success('Message copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Share via WhatsApp</h3>
              <p className="text-xs text-slate-500">{defaultTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recipient WhatsApp Number (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 1234567890 (type country code + number, or leave empty)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Message Preview (Editable)
              </label>
              <span className="text-[10px] text-slate-400">Edit or format before sending</span>
            </div>
            
            {/* Formatted live preview */}
            <div className="mb-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {messageText.split('\n').map((line, idx) => {
                // Render lines starting with asterisk or bold markers as true bold HTML
                const isHeader = line.startsWith('*') && line.endsWith('*') && line.length > 2;
                if (isHeader) {
                  return (
                    <div key={idx} className="font-bold text-slate-900 text-sm py-0.5">
                      {line.replace(/^\*+|\*+$/g, '')}
                    </div>
                  );
                }
                const parts = line.split(/(\*[^*]+\*)/g);
                return (
                  <div key={idx} className="min-h-[1.25em]">
                    {parts.map((p, i) => {
                      if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
                        return <strong key={i} className="font-bold text-slate-900">{p.slice(1, -1)}</strong>;
                      }
                      if (p.startsWith('_') && p.endsWith('_') && p.length > 2) {
                        return <span key={i} className="italic text-slate-500">{p.slice(1, -1)}</span>;
                      }
                      return <span key={i}>{p}</span>;
                    })}
                  </div>
                );
              })}
            </div>

            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Edit your message text here..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white font-mono text-slate-800 resize-y"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleCopy}
              type="button"
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>

            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Open in WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
