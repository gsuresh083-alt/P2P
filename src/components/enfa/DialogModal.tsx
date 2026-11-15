import React, { useEffect, useState } from 'react';
import { Printer, Download, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  msg: string;
  kind: 'ok' | 'err' | 'info';
}

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => (
  <div id="toasts" aria-live="polite">
    {toasts.map((t) => (
      <div key={t.id} className={`toast ${t.kind}`}>
        <span className="ic-b">{t.kind === 'err' ? '!' : t.kind === 'ok' ? '✓' : 'i'}</span>
        <div className="flex-1">{t.msg}</div>
        <button
          type="button"
          aria-label="Close"
          className="text-slate-300 hover:text-white cursor-pointer bg-transparent border-0"
          onClick={() => onDismiss(t.id)}
        >
          ✕
        </button>
      </div>
    ))}
  </div>
);

export interface DialogRequest {
  title: string;
  body?: string;
  html?: React.ReactNode;
  input?: boolean;
  placeholder?: string;
  okLabel?: string;
  cancelLabel?: string | false;
  danger?: boolean;
  resolve: (value: string | boolean | null) => void;
}

export const DialogModal: React.FC<{
  dialog: DialogRequest | null;
  onClose: () => void;
}> = ({ dialog, onClose }) => {
  const [val, setVal] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    setVal('');
    setErr(false);
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog.cancelLabel !== false) {
        dialog.resolve(dialog.input ? null : false);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  if (!dialog) return null;

  const handleConfirm = () => {
    if (dialog.input) {
      if (!val.trim()) {
        setErr(true);
        return;
      }
      dialog.resolve(val.trim());
    } else {
      dialog.resolve(true);
    }
    onClose();
  };

  const handleCancel = () => {
    dialog.resolve(dialog.input ? null : false);
    onClose();
  };

  return (
    <div className="ui-dlg-wrap" role="dialog" aria-modal="true">
      <div className="ui-dlg">
        <h4 className="text-base font-bold text-slate-900 mb-2">{dialog.title}</h4>
        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
          {dialog.html || dialog.body}
        </div>
        {dialog.input ? (
          <textarea
            autoFocus
            rows={3}
            value={val}
            placeholder={dialog.placeholder || ''}
            className={`mt-3 w-full border rounded-md p-2 text-sm ${err ? 'lpp-err' : 'border-slate-300'}`}
            onChange={(e) => {
              setVal(e.target.value);
              setErr(false);
            }}
          />
        ) : null}
        <div className="flex justify-end gap-2 mt-4">
          {dialog.cancelLabel !== false ? (
            <button type="button" className="btn w" onClick={handleCancel}>
              {dialog.cancelLabel || 'Cancel'}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${dialog.danger ? 'r' : 'g'}`}
            onClick={handleConfirm}
          >
            {dialog.okLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const PrintPreviewModal: React.FC<{
  open: boolean;
  title: string;
  onPrintNow: () => void;
  onDownloadHtml: () => void;
  onClose: () => void;
}> = ({ open, title, onPrintNow, onDownloadHtml, onClose }) => {
  if (!open) return null;
  return (
    <div className="ui-dlg-wrap" role="dialog" aria-modal="true">
      <div className="ui-dlg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-base font-bold text-slate-900">Print / Save PDF — {title}</h4>
          <button type="button" className="x" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          You can trigger the browser print dialog directly (select <b>Save as PDF</b> in A4
          landscape) or download a standalone printable HTML copy if your current browser preview
          restricts printing.
        </p>
        <div className="flex justify-end gap-2 mt-4 flex-wrap">
          <button type="button" className="btn w" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn w" onClick={onDownloadHtml}>
            <Download size={15} /> Download printable HTML
          </button>
          <button type="button" className="btn g" onClick={onPrintNow}>
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};
