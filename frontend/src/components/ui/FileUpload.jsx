import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { cn } from '@/utils/helpers';

export function FileUpload({
  label = 'Upload',
  accept = 'image/*',
  value,
  previewUrl,
  onChange,
  hint = 'PNG, JPG up to 10MB',
  className,
}) {
  const id = useId();
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');

  const localPreview = useMemo(() => {
    if (value instanceof File && accept.includes('image')) {
      return URL.createObjectURL(value);
    }
    return null;
  }, [value, accept]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFileName(file?.name || '');
    onChange?.(file);
  };

  const clear = () => {
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
    onChange?.(null);
  };

  const showPreview = localPreview || previewUrl || null;
  const displayName = fileName || (previewUrl ? 'Current file' : 'No file chosen');

  return (
    <div className={cn('block space-y-1.5', className)}>
      {label ? (
        <span className="block text-sm font-medium text-slate-700 mb-0">{label}</span>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border bg-slate-50/60 px-3 py-2.5">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleChange}
        />

        <label
          htmlFor={id}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white hover:border-primary/50 hover:text-primary"
        >
          <Upload size={16} className="text-primary shrink-0" />
          Choose file
        </label>

        <span className="text-sm text-muted truncate max-w-[240px]">{displayName}</span>

        {(fileName || value) && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted hover:bg-white hover:text-danger cursor-pointer"
            title="Clear"
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {hint ? <p className="text-xs text-muted">{hint}</p> : null}

      {showPreview && accept.includes('image') && (
        <img
          src={showPreview}
          alt="Preview"
          className="mt-1 h-14 w-auto max-w-[160px] rounded-xl border border-border object-contain bg-white p-1"
        />
      )}
    </div>
  );
}
