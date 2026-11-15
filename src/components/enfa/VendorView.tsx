import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Lock,
  Paperclip,
  Percent,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  NfaRecord,
  NfaVersion,
  RoleName,
  Vendor,
  VendorAttachment,
  VendorTerms,
} from '../../types/enfa.ts';
import { QT_CH, QT_REQ, TERMS } from '../../utils/enfaConstants.ts';
import {
  downloadBlob,
  fmt,
  fmtD,
  isOk,
  isOkForLine,
  num,
  qtChange,
  qtDisp,
  qtHas,
  qtLf,
  shortK,
  techBlockReason,
} from '../../utils/enfaEngine.ts';
import { DiscountOptionModal, type DiscountApplyPayload } from './DiscountOptionModal.tsx';
import { FieldControl, LockBanner } from './FieldControl.tsx';

export type VendorOfferPhase = 'quote' | 'negotiation';

interface VendorViewProps {
  nfa: NfaRecord;
  ver: NfaVersion;
  role: RoleName;
  vendorIdx: number;
  offerPhase: VendorOfferPhase;
  onSelectVendor: (idx: number) => void;
  onChangeOfferPhase: (phase: VendorOfferPhase) => void;
  onChangeField: (path: string, val: string | number) => void;
  onChangeQuoteScope: (vendorIdx: number, scope: 'all' | 'partial') => void;
  onToggleRegret: (itemIdx: number, vendorIdx: number, regret: boolean) => void;
  onApplyDiscount: (payload: DiscountApplyPayload) => void;
  onAddVendor: () => void;
  onCopyQuotedToNegotiated: (vendorIdx: number) => void;
  onAddAttachment: (vendorIdx: number, att: VendorAttachment) => void;
  onRemoveAttachment: (vendorIdx: number, attId: string) => void;
  onSubmitVendorOffer: (vendorIdx: number, phase: VendorOfferPhase) => void;
  onSwitchBackToBuyer: () => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AttachmentPreviewModal: React.FC<{
  attachment: VendorAttachment | null;
  onClose: () => void;
}> = ({ attachment, onClose }) => {
  if (!attachment) return null;
  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(attachment.name);

  const handleDownload = () => {
    if (!attachment.dataUrl) return;
    const a = document.createElement('a');
    a.href = attachment.dataUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${attachment.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-[var(--t-line)] bg-[var(--t-surf)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--t-line)] px-5 py-3.5 bg-[var(--t-th)]">
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--t-tx)] truncate">{attachment.name}</div>
            <div className="text-xs text-[var(--t-tx3)] flex items-center gap-2">
              <span>{attachment.phase === 'negotiation' ? 'Revised Offer' : 'Initial Quote'}</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(attachment.sizeBytes)}</span>
              <span aria-hidden="true">·</span>
              <span>Uploaded {fmtD(attachment.uploadedAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {attachment.dataUrl ? (
              <button
                type="button"
                className="btn w whitespace-nowrap shrink-0"
                onClick={handleDownload}
              >
                <Download size={14} /> Download
              </button>
            ) : null}
            <button
              type="button"
              className="btn w whitespace-nowrap shrink-0"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X size={14} /> Close
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 flex-1 overflow-auto flex items-center justify-center min-h-[360px]">
          {attachment.dataUrl && isImage ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              referrerPolicy="no-referrer"
              className="max-h-[70vh] w-auto rounded border border-[var(--t-line)] bg-white object-contain"
            />
          ) : attachment.dataUrl && isPdf ? (
            <iframe
              src={attachment.dataUrl}
              title={attachment.name}
              className="w-full h-[68vh] rounded border border-[var(--t-line)] bg-white"
            />
          ) : (
            <div className="text-center max-w-md py-10 px-6 bg-white rounded-lg border border-[var(--t-line)]">
              <FileText size={32} className="mx-auto text-[var(--t-tx3)] mb-2" />
              <div className="font-semibold text-[var(--t-tx)]">{attachment.name}</div>
              <p className="text-xs text-[var(--t-tx3)] mt-1 mb-4">
                Inline preview is supported for PDF and image files. Use Download to inspect this{' '}
                {attachment.mimeType || 'document'} locally.
              </p>
              {attachment.dataUrl ? (
                <button type="button" className="btn" onClick={handleDownload}>
                  <Download size={14} /> Download file
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const VendorView: React.FC<VendorViewProps> = ({
  nfa,
  ver,
  role,
  vendorIdx,
  offerPhase,
  onSelectVendor,
  onChangeOfferPhase,
  onChangeField,
  onChangeQuoteScope,
  onToggleRegret,
  onApplyDiscount,
  onAddVendor,
  onCopyQuotedToNegotiated,
  onAddAttachment,
  onRemoveAttachment,
  onSubmitVendorOffer,
  onSwitchBackToBuyer,
}) => {
  const [itemSearch, setItemSearch] = useState('');
  const [previewAtt, setPreviewAtt] = useState<VendorAttachment | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [itemDiscPct, setItemDiscPct] = useState<Record<number, string>>({});
  const [vendorDiscPct, setVendorDiscPct] = useState('');
  const [discountModal, setDiscountModal] = useState<{
    open: boolean;
    initialPercent: number;
    initialItemIdx: number | null;
  }>({
    open: false,
    initialPercent: 0,
    initialItemIdx: null,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const d = ver.data;
  const base = d.header.cur || 'INR';
  const isDraft = ver.status === 'Draft';
  const editable = isDraft && (role === 'Vendor' || role === 'Buyer');
  const vendors = d.vendors || [];
  const safeIdx = vendors.length ? Math.min(Math.max(0, vendorIdx), vendors.length - 1) : -1;
  const v: Vendor | null = safeIdx >= 0 ? vendors[safeIdx] : null;
  const quoteScope: 'all' | 'partial' = v
    ? v.quoteScope || (d.items.some((it) => it.r?.[safeIdx]?.regret) ? 'partial' : 'all')
    : 'all';

  const vCur = v?.terms?.cur || base;
  const sameCur = vCur === base;
  const fxVal = sameCur ? 1 : (num(v?.terms?.fxRate) || 0) > 0 ? num(v?.terms?.fxRate) : null;
  const fxReady =
    sameCur ||
    (fxVal != null && Boolean(v?.terms?.fxDate) && String(v?.terms?.fxSource || '').trim() !== '');

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return d.items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => {
        if (!q) return true;
        return (
          String(it.code || '').toLowerCase().includes(q) ||
          String(it.desc || '').toLowerCase().includes(q) ||
          String(it.erpSource?.prNumber || '').toLowerCase().includes(q)
        );
      });
  }, [d.items, itemSearch]);

  // Quote & Negotiation totals for THIS vendor only (never exposes rival quotes)
  const metrics = useMemo(() => {
    if (!v || safeIdx < 0) {
      return {
        quotedCount: 0,
        regretCount: 0,
        quotedBasic: 0,
        quotedLfPct: 0,
        quotedLanded: 0,
        acceptedLines: 0,
        negPending: 0,
        negBasic: 0,
        negLfPct: 0,
        negLanded: 0,
        negOverQuote: 0,
        termsImp: 0,
        termsWor: 0,
        termsChg: 0,
      };
    }

    let quotedCount = 0;
    let regretCount = 0;
    let quotedBasic = 0;
    let acceptedLines = 0;
    let negPending = 0;
    let negBasic = 0;
    let negOverQuote = 0;

    d.items.forEach((it, i) => {
      const qty = Number(it.qty) || 0;
      const cell = it.r?.[safeIdx];
      const isRegret = Boolean(cell?.regret);
      const q = num(cell?.q);
      const n = num(cell?.n);
      if (isRegret) {
        regretCount++;
        return;
      }
      if (q != null) {
        quotedCount++;
        quotedBasic += qty * q;
      }
      if (isOkForLine(d, v, i) && q != null) {
        acceptedLines++;
        if (n == null) negPending++;
        else {
          negBasic += qty * n;
          if (n > q) negOverQuote++;
        }
      }
    });

    const qTermsObj: Partial<VendorTerms> = Object.assign({}, v.qterms || {});
    qTermsObj.__lf = qtLf(qTermsObj);
    const nTermsObj: Partial<VendorTerms> = Object.assign({}, v.terms || {});
    nTermsObj.__lf = qtLf(nTermsObj);

    const quotedLfPct = qTermsObj.__lf ?? 0;
    const negLfPct = nTermsObj.__lf ?? 0;
    const quotedLanded = quotedBasic * (1 + quotedLfPct / 100);
    const negLanded = negBasic * (1 + negLfPct / 100);

    let termsImp = 0;
    let termsWor = 0;
    let termsChg = 0;
    TERMS.forEach(([k]) => {
      const ch = qtChange(k, qTermsObj, nTermsObj);
      if (ch === 'better') termsImp++;
      else if (ch === 'worse') termsWor++;
      else if (ch === 'changed' || ch === 'added') termsChg++;
    });

    return {
      quotedCount,
      regretCount,
      quotedBasic,
      quotedLfPct,
      quotedLanded,
      acceptedLines,
      negPending,
      negBasic,
      negLfPct,
      negLanded,
      negOverQuote,
      termsImp,
      termsWor,
      termsChg,
    };
  }, [d, safeIdx, v]);

  const missingReqTerms = useMemo(() => {
    if (!v) return [];
    const target = offerPhase === 'quote' ? v.qterms || {} : v.terms || {};
    return QT_REQ.filter((k) => !qtHas(target[k])).map(
      (k) => TERMS.find((t) => t[0] === k)?.[1] || k
    );
  }, [offerPhase, v]);

  const vendorAcceptedAny = v
    ? d.techMode === 'Line-wise'
      ? d.items.some(
          (it, i) => !it.r?.[safeIdx]?.regret && num(it.r?.[safeIdx]?.q) != null && isOkForLine(d, v, i)
        )
      : isOk(v) && d.items.some((it) => !it.r?.[safeIdx]?.regret && num(it.r?.[safeIdx]?.q) != null)
    : false;

  const techSummaryText = useMemo(() => {
    if (!v) return '';
    if (d.techMode === 'Line-wise') {
      const totalQ = d.items.filter(
        (it) => !it.r?.[safeIdx]?.regret && num(it.r?.[safeIdx]?.q) != null
      ).length;
      return `${metrics.acceptedLines} of ${totalQ || d.items.length} line(s) technically accepted`;
    }
    return isOk(v) ? 'Technically Accepted' : techBlockReason(v);
  }, [d, metrics.acceptedLines, safeIdx, v]);

  const renderQnMini = (k: string) => {
    if (!v?.qterms) return null;
    const qt = Object.assign({}, v.qterms) as Partial<VendorTerms>;
    const nt = Object.assign({}, v.terms) as Partial<VendorTerms>;
    qt.__lf = qtLf(qt);
    nt.__lf = qtLf(nt);
    const ch = qtChange(k, qt, nt);
    return (
      <div className="qn-mini">
        <small>Initial quote: {qtDisp(k, qt) || '—'}</small>
        {ch !== 'same' ? (
          <>
            {' '}
            <em className={`qn-chip ${ch}`}>{QT_CH[ch][0]}</em>
          </>
        ) : null}
      </div>
    );
  };

  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const files = ev.target.files;
    if (!files || !files.length || safeIdx < 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 2 MB browser storage limit per attachment.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
        onAddAttachment(safeIdx, {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: v?.name || `Vendor ${safeIdx + 1}`,
          phase: offerPhase,
          dataUrl,
        });
      };
      reader.readAsDataURL(file);
    });
    ev.target.value = '';
  };

  const attachments = v?.attachments || [];

  return (
    <>
      <LockBanner ver={ver} />

      {/* Vendor Portal Context Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-4 border-b border-[var(--t-line)]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-[var(--t-tx3)] mb-1">
            <span>Vendor Quotation Portal</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[var(--t-tx2)]">{nfa.no}</span>
            <span aria-hidden="true">·</span>
            <span>{d.header.rfqNo || 'RFQ Draft'}</span>
            <span aria-hidden="true">·</span>
            <span>
              {d.header.company || 'Company'} · {d.header.plant || 'Plant'}
            </span>
          </div>
          <h2 style={{ border: 0, padding: 0, margin: 0 }}>
            {v?.name ? `${v.name} — Quotation & Offer Entry` : 'Vendor Quotation & Offer Entry'}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--t-tx3)] mt-1.5">
            <span>
              Base Currency: <b className="text-[var(--t-tx)]">{base}</b>
            </span>
            {d.header.rfqDue ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  RFQ Due: <b className="text-[var(--t-tx)]">{fmtD(d.header.rfqDue)}</b>
                </span>
              </>
            ) : null}
            {d.header.needBy ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Need-by: <b className="text-[var(--t-tx)]">{fmtD(d.header.needBy)}</b>
                </span>
              </>
            ) : null}
            {d.header.cat ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{d.header.cat}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Active Vendor Selector & Role Switch Back */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {vendors.length > 0 ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--t-tx2)]">
              <span className="whitespace-nowrap">Acting as Vendor</span>
              <select
                aria-label="Select active vendor"
                value={safeIdx}
                onChange={(e) => onSelectVendor(Number(e.target.value))}
                style={{ width: 'auto', minWidth: 210 }}
              >
                {vendors.map((vd, j) => (
                  <option key={j} value={j}>
                    V{j + 1} · {vd.name || `Unnamed Vendor ${j + 1}`}
                    {vd.code ? ` (${vd.code})` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {editable ? (
            <button
              type="button"
              className="btn w whitespace-nowrap shrink-0"
              onClick={onAddVendor}
            >
              <Plus size={14} /> Add Vendor
            </button>
          ) : null}

          <button
            type="button"
            className="btn whitespace-nowrap shrink-0"
            onClick={onSwitchBackToBuyer}
          >
            <ArrowLeft size={14} /> Return to Buyer View
          </button>
        </div>
      </div>

      {/* Empty Vendor State */}
      {!v ? (
        <div className="ch-empty">
          <p className="mb-3">
            No vendors have been invited to this RFQ yet. Register a vendor profile to enter line
            quotations, commercial terms, and attachments.
          </p>
          {isDraft ? (
            <button type="button" className="btn" onClick={onAddVendor}>
              <Plus size={14} /> Register First Vendor
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {/* RFQ Requirement Summary Strip */}
          {d.header.desc ? (
            <div className="rounded-lg border border-[var(--t-line)] bg-[#F9FAFB] px-4 py-2.5 mb-4 text-xs text-[var(--t-tx2)]">
              <span className="font-semibold text-[var(--t-tx)]">Requirement Scope: </span>
              {d.header.desc}
            </div>
          ) : null}

          {/* Segmented Offer Phase Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div
              className="inline-flex items-center gap-1 p-1 rounded-lg border border-[var(--t-line)] bg-[#F3F4F6]"
              role="tablist"
              aria-label="Vendor submission phase"
            >
              <button
                type="button"
                role="tab"
                aria-selected={offerPhase === 'quote'}
                onClick={() => onChangeOfferPhase('quote')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer border-0 ${
                  offerPhase === 'quote'
                    ? 'bg-white text-[var(--t-tx)] shadow-sm'
                    : 'bg-transparent text-[var(--t-tx2)] hover:text-[var(--t-tx)]'
                }`}
              >
                Initial Quotation
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={offerPhase === 'negotiation'}
                onClick={() => onChangeOfferPhase('negotiation')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer border-0 ${
                  offerPhase === 'negotiation'
                    ? 'bg-white text-[var(--t-tx)] shadow-sm'
                    : 'bg-transparent text-[var(--t-tx2)] hover:text-[var(--t-tx)]'
                }`}
              >
                Revised / Negotiated Offer
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--t-tx3)]">
              <span>
                Quote status:{' '}
                <b className={v.quoteSubmittedAt ? 'ok' : 'text-[var(--t-tx)]'}>
                  {v.quoteSubmittedAt ? `Submitted ${fmtD(v.quoteSubmittedAt)}` : 'Draft'}
                </b>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Technical status:{' '}
                <b className={vendorAcceptedAny ? 'ok' : 'text-[var(--t-warn)]'}>
                  {techSummaryText}
                </b>
              </span>
              {v.negSubmittedAt ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Revised offer: <b className="ok">Submitted {fmtD(v.negSubmittedAt)}</b>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {/* KPI Summary Strip (Vendor-scoped only) */}
          {offerPhase === 'quote' ? (
            <div className="kpis">
              <div className="kpi">
                <span>Lines Quoted</span>
                <b className="tabular-nums">
                  {metrics.quotedCount} / {d.items.length}
                </b>
                {metrics.regretCount > 0 ? (
                  <small className="text-[11px] text-[var(--t-warn)] font-semibold">
                    {metrics.regretCount} item(s) regretted
                  </small>
                ) : null}
              </div>
              <div className="kpi">
                <span>Basic Quote Value ({vCur})</span>
                <b className="tabular-nums">
                  {vCur} {fmt(metrics.quotedBasic, 2, vCur)}
                </b>
              </div>
              <div className="kpi">
                <span>Quoted Landing Factor</span>
                <b className="tabular-nums">{metrics.quotedLfPct.toFixed(2)}%</b>
              </div>
              <div className="kpi s">
                <span>Est. Landed ({base}, excl. tax)</span>
                <b className="tabular-nums">
                  {fxVal == null ? 'FX pending' : `${base} ${fmt(metrics.quotedLanded * fxVal, 0, base)}`}
                </b>
              </div>
            </div>
          ) : (
            <div className="kpis">
              <div className="kpi">
                <span>Initial Quoted Landed ({vCur})</span>
                <b className="tabular-nums">
                  {vCur} {shortK(metrics.quotedLanded, vCur)}
                </b>
              </div>
              <div className="kpi">
                <span>Revised Offer Landed ({vCur})</span>
                <b className="tabular-nums">
                  {metrics.negBasic > 0 ? `${vCur} ${shortK(metrics.negLanded, vCur)}` : '—'}
                </b>
              </div>
              <div className="kpi s">
                <span>Reduction vs Initial</span>
                <b className="tabular-nums">
                  {metrics.negBasic > 0 && metrics.quotedLanded > 0
                    ? `${metrics.quotedLanded - metrics.negLanded >= 0 ? '▼ ' : '▲ '}${Math.abs(
                        ((metrics.negLanded - metrics.quotedLanded) / metrics.quotedLanded) * 100
                      ).toFixed(1)}%`
                    : '—'}
                </b>
              </div>
              <div className="kpi">
                <span>Commercial Terms Delta</span>
                <b className="tabular-nums text-base">
                  {metrics.termsImp} imp · {metrics.termsWor} wor · {metrics.termsChg} chg
                </b>
              </div>
            </div>
          )}

          {/* Vendor Profile & FX Table (replicated from QuotesView) */}
          <h3>1. Vendor Quotation Reference &amp; Currency</h3>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>V#</th>
                  <th>Vendor Name *</th>
                  <th>Vendor Code</th>
                  <th>Quotation Ref *</th>
                  <th>Quote Date</th>
                  <th>Final Offer Date</th>
                  <th style={{ minWidth: 100 }}>Quote Currency *</th>
                  <th style={{ minWidth: 110 }}>FX → {base} *</th>
                  <th>FX Rate Date *</th>
                  <th style={{ minWidth: 150 }}>FX Source *</th>
                  <th>FX Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="l" style={{ width: 44 }}>
                    V{safeIdx + 1}
                  </td>
                  <td style={{ minWidth: 185 }}>
                    <FieldControl
                      path={`vendors.${safeIdx}.name`}
                      value={v.name}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td style={{ minWidth: 105 }}>
                    <FieldControl
                      path={`vendors.${safeIdx}.code`}
                      value={v.code}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td style={{ minWidth: 135 }}>
                    <FieldControl
                      path={`vendors.${safeIdx}.ref`}
                      value={v.ref}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    <FieldControl
                      path={`vendors.${safeIdx}.qdate`}
                      value={v.qdate}
                      type="d"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    <FieldControl
                      path={`vendors.${safeIdx}.fdate`}
                      value={v.fdate}
                      type="d"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    <FieldControl
                      path={`vendors.${safeIdx}.terms.cur`}
                      value={v.terms?.cur}
                      type="s:cur"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    {sameCur ? (
                      <span className="note">1.0000 (base)</span>
                    ) : (
                      <FieldControl
                        path={`vendors.${safeIdx}.terms.fxRate`}
                        value={v.terms?.fxRate}
                        type="n"
                        placeholder="e.g. 84.25"
                        ver={ver}
                        role={role}
                        onChange={onChangeField}
                      />
                    )}
                  </td>
                  <td>
                    {sameCur ? (
                      <span className="note">n/a</span>
                    ) : (
                      <FieldControl
                        path={`vendors.${safeIdx}.terms.fxDate`}
                        value={v.terms?.fxDate}
                        type="d"
                        ver={ver}
                        role={role}
                        onChange={onChangeField}
                      />
                    )}
                  </td>
                  <td>
                    {sameCur ? (
                      <span className="note">n/a</span>
                    ) : (
                      <FieldControl
                        path={`vendors.${safeIdx}.terms.fxSource`}
                        value={v.terms?.fxSource}
                        type="t"
                        placeholder="e.g. RBI ref. rate / bank TT"
                        ver={ver}
                        role={role}
                        onChange={onChangeField}
                      />
                    )}
                  </td>
                  <td>
                    {!v.name ? (
                      '—'
                    ) : fxReady ? (
                      <span className="ok">✓ {vCur}</span>
                    ) : (
                      <span className="bad">FX pending</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quote Scope Selector (All items vs Partial / Regret items) */}
          {offerPhase === 'quote' ? (
            <div className="rounded-lg border border-[var(--t-line)] bg-[#F9FAFB] px-4 py-3 mt-4 mb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[var(--t-tx)]">
                  Quotation Coverage Scope
                </div>
                <div className="text-[11.5px] text-[var(--t-tx3)] mt-0.5">
                  Choose whether you are quoting for every RFQ line item or submitting a partial
                  quote with specific items marked as <b>Regret</b>.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[var(--t-tx)]">
                  <input
                    type="radio"
                    name={`vendor-scope-${safeIdx}`}
                    checked={quoteScope === 'all'}
                    disabled={!editable}
                    onChange={() => onChangeQuoteScope(safeIdx, 'all')}
                  />
                  <span>Quote for All Items ({d.items.length})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[var(--t-tx)]">
                  <input
                    type="radio"
                    name={`vendor-scope-${safeIdx}`}
                    checked={quoteScope === 'partial'}
                    disabled={!editable}
                    onChange={() => onChangeQuoteScope(safeIdx, 'partial')}
                  />
                  <span>Partial Quote (Regret Specific Items)</span>
                </label>
              </div>
            </div>
          ) : null}

          {/* Line-Item Quote / Revised Offer Entry */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 mb-2">
            <h3 style={{ margin: 0 }}>
              2.{' '}
              {offerPhase === 'quote'
                ? `Item-wise Quoted Unit Rates (${vCur}, basic, excl. tax)`
                : `Item-wise Revised / Negotiated Rates (${vCur}, basic, excl. tax)`}
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--t-tx3)] pointer-events-none"
                />
                <input
                  type="search"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Filter items or PR..."
                  aria-label="Filter RFQ line items"
                  style={{ paddingLeft: 28, width: 210, fontSize: 12 }}
                />
              </div>
              {offerPhase === 'negotiation' && editable && vendorAcceptedAny ? (
                <>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      max={99.99}
                      placeholder="Disc %"
                      aria-label="Vendor discount percentage"
                      value={vendorDiscPct}
                      onChange={(e) => setVendorDiscPct(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const parsed = Number(vendorDiscPct);
                          setDiscountModal({
                            open: true,
                            initialPercent: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                            initialItemIdx: null,
                          });
                        }
                      }}
                      style={{ width: 82, fontSize: 12, padding: '5px 8px' }}
                    />
                    <button
                      type="button"
                      className="btn w whitespace-nowrap shrink-0"
                      onClick={() => {
                        const parsed = Number(vendorDiscPct);
                        setDiscountModal({
                          open: true,
                          initialPercent: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                          initialItemIdx: null,
                        });
                      }}
                    >
                      <Percent size={13} /> Discount % Options
                    </button>
                  </div>
                  {metrics.negPending > 0 ? (
                    <button
                      type="button"
                      className="btn w whitespace-nowrap shrink-0"
                      onClick={() => onCopyQuotedToNegotiated(safeIdx)}
                    >
                      Copy Initial Quote → Revised ({metrics.negPending} pending)
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          {offerPhase === 'negotiation' && !vendorAcceptedAny ? (
            <div className="rounded-lg border border-[var(--t-warn-line)] bg-[var(--t-warn-bg)] text-[var(--t-warn)] px-4 py-3 mb-3 text-xs flex items-start gap-2">
              <Lock size={15} className="shrink-0 mt-0.5" />
              <div>
                <b>Negotiation price entry is currently locked for this vendor.</b>{' '}
                <span>
                  {techBlockReason(v)}. Once Technical Evaluation marks lines as Accepted, revised
                  unit rates unlock automatically. You may still review initial quotes or update
                  attachments below.
                </span>
              </div>
            </div>
          ) : null}

          {!d.items.length ? (
            <div className="ch-empty">
              No RFQ line items exist on this record yet. Ask the Buyer to add items or apply PR
              lines before submitting a quote.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 42 }}>#</th>
                    <th style={{ minWidth: 120 }}>Item Code</th>
                    <th style={{ minWidth: 250 }}>Description &amp; Specifications</th>
                    <th style={{ width: 68 }}>UOM</th>
                    <th className="r" style={{ width: 82 }}>
                      Qty
                    </th>
                      {offerPhase === 'quote' ? (
                        <>
                          <th style={{ minWidth: 115 }}>Line Status</th>
                          <th className="dk" style={{ minWidth: 165 }}>
                            Quoted Unit Rate ({vCur})
                          </th>
                          <th className="r" style={{ minWidth: 135 }}>
                            Line Total ({vCur})
                          </th>
                          {!sameCur ? (
                            <th className="r" style={{ minWidth: 135 }}>
                              Base Equiv. ({base})
                            </th>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <th style={{ minWidth: 130 }}>Tech Status</th>
                          <th className="r" style={{ minWidth: 120 }}>
                            Initial Quote ({vCur})
                          </th>
                          <th className="dk" style={{ minWidth: 185 }}>
                            Revised Offer ({vCur})
                          </th>
                          <th className="r" style={{ minWidth: 110 }}>
                            Variance
                          </th>
                          <th className="r" style={{ minWidth: 135 }}>
                            Revised Total ({vCur})
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(({ it, i }) => {
                      const qty = Number(it.qty) || 0;
                      const cell = it.r?.[safeIdx];
                      const isRegret = Boolean(cell?.regret);
                      const qRate = num(cell?.q);
                      const nRate = num(cell?.n);
                      const okLine = isOkForLine(d, v, i);
                      const lineTechStatus =
                        d.techMode === 'Line-wise'
                          ? v.techEval?.lines?.[String(i)]?.status || 'Pending'
                          : v.techEval?.status || 'Pending';
                      const ch =
                        nRate != null && qRate != null && qRate > 0 ? nRate / qRate - 1 : null;
                      const overQuoted = nRate != null && qRate != null && nRate > qRate;
                      const pctDraft = itemDiscPct[i] ?? '';
                      const openLineDiscount = () => {
                        const parsed = Number(pctDraft);
                        setDiscountModal({
                          open: true,
                          initialPercent: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                          initialItemIdx: i,
                        });
                      };

                      return (
                        <tr key={i} className={isRegret ? 'opacity-80 bg-slate-50/70' : ''}>
                          <td className="tabular-nums">{i + 1}</td>
                          <td>
                            <b>{it.code || '—'}</b>
                          </td>
                          <td>
                            <div className="whitespace-pre-line">{it.desc || '—'}</div>
                            {it.erpSource ? (
                              <div className="text-[11px] text-[var(--t-tx3)] mt-0.5">
                                PR {it.erpSource.prNumber} / {it.erpSource.prLineNumber}
                                {it.erpSource.documents?.length
                                  ? ` · Spec: ${it.erpSource.documents
                                      .map((doc) => doc.documentName)
                                      .join(', ')}`
                                  : ''}
                              </div>
                            ) : null}
                          </td>
                          <td>{it.uom || '—'}</td>
                          <td className="n">{fmt(it.qty, 3, base)}</td>

                          {offerPhase === 'quote' ? (
                            <>
                              <td>
                                {editable ? (
                                  <button
                                    type="button"
                                    className={`btn whitespace-nowrap shrink-0 ${
                                      isRegret ? 'r' : 'w'
                                    }`}
                                    style={{ padding: '4px 9px', fontSize: 11.5 }}
                                    onClick={() => onToggleRegret(i, safeIdx, !isRegret)}
                                  >
                                    {isRegret ? 'Regretted (Undo)' : 'Mark Regret'}
                                  </button>
                                ) : isRegret ? (
                                  <span className="bad text-xs">Regret</span>
                                ) : (
                                  <span className="ok text-xs">Quoting</span>
                                )}
                              </td>
                              <td>
                                {isRegret ? (
                                  <div className="space-y-1">
                                    <span className="text-xs font-semibold text-[var(--t-warn)]">
                                      Item regretted (no quote)
                                    </span>
                                    <FieldControl
                                      path={`items.${i}.r.${safeIdx}.regretReason`}
                                      value={cell?.regretReason}
                                      type="t"
                                      placeholder="Optional reason (e.g. Out of scope)"
                                      ver={ver}
                                      role={role}
                                      onChange={onChangeField}
                                    />
                                  </div>
                                ) : (
                                  <FieldControl
                                    path={`items.${i}.r.${safeIdx}.q`}
                                    value={cell?.q}
                                    type="n"
                                    placeholder="0.00"
                                    ver={ver}
                                    role={role}
                                    onChange={onChangeField}
                                  />
                                )}
                              </td>
                              <td className="n">
                                {isRegret ? (
                                  <span className="text-xs text-[var(--t-warn)] font-semibold">
                                    Regret
                                  </span>
                                ) : qRate != null ? (
                                  <b>
                                    {vCur} {fmt(qty * qRate, 2, vCur)}
                                  </b>
                                ) : (
                                  <span className="note">—</span>
                                )}
                              </td>
                              {!sameCur ? (
                                <td className="n">
                                  {isRegret ? (
                                    <span className="note">—</span>
                                  ) : qRate != null ? (
                                    fxVal != null ? (
                                      `${base} ${fmt(qty * qRate * fxVal, 2, base)}`
                                    ) : (
                                      <span className="bad">FX pending</span>
                                    )
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <td>
                                {isRegret ? (
                                  <span className="text-xs text-[var(--t-warn)] font-semibold">
                                    Regret (NQ)
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      okLine
                                        ? 'ok text-xs'
                                        : lineTechStatus === 'Rejected'
                                        ? 'bad text-xs'
                                        : 'text-xs text-[var(--t-warn)] font-semibold'
                                    }
                                  >
                                    {okLine ? 'Accepted' : lineTechStatus || 'Pending'}
                                  </span>
                                )}
                              </td>
                              <td className="n">
                                {isRegret ? (
                                  <span className="note">Regret</span>
                                ) : qRate != null ? (
                                  `${vCur} ${fmt(qRate, 2, vCur)}`
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                {isRegret ? (
                                  <div className="text-xs text-[var(--t-tx3)]">
                                    Regretted — locked
                                    {cell?.regretReason ? ` (${cell.regretReason})` : ''}
                                  </div>
                                ) : qRate == null ? (
                                  <span className="text-xs text-[var(--t-tx3)]">Not quoted</span>
                                ) : !okLine ? (
                                  <span className="text-xs text-[var(--t-tx3)]">
                                    {lineTechStatus === 'Rejected'
                                      ? 'Rejected — locked'
                                      : 'Pending tech acceptance'}
                                  </span>
                                ) : (
                                  <>
                                    <FieldControl
                                      path={`items.${i}.r.${safeIdx}.n`}
                                      value={cell?.n}
                                      type="n"
                                      placeholder={String(qRate)}
                                      ver={ver}
                                      role={role}
                                      onChange={onChangeField}
                                    />
                                    {editable ? (
                                      <div className="flex items-center gap-1 mt-1.5">
                                        <input
                                          type="number"
                                          step="any"
                                          min={0}
                                          max={99.99}
                                          placeholder="Disc %"
                                          aria-label={`Discount percent for item ${i + 1}`}
                                          value={pctDraft}
                                          onChange={(ev) =>
                                            setItemDiscPct((prev) => ({
                                              ...prev,
                                              [i]: ev.target.value,
                                            }))
                                          }
                                          onKeyDown={(ev) => {
                                            if (ev.key === 'Enter') {
                                              ev.preventDefault();
                                              openLineDiscount();
                                            }
                                          }}
                                          style={{ width: 68, fontSize: 11, padding: '3px 6px' }}
                                        />
                                        <button
                                          type="button"
                                          className="btn w whitespace-nowrap shrink-0"
                                          style={{ padding: '3px 7px', fontSize: 11 }}
                                          onClick={openLineDiscount}
                                        >
                                          <Percent size={11} /> Apply %
                                        </button>
                                      </div>
                                    ) : null}
                                    {overQuoted ? (
                                      <div className="bad text-[11px] mt-0.5">
                                        Cannot exceed initial quote ({fmt(qRate, 2, vCur)})
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </td>
                              <td className="n">
                                {!isRegret && ch != null && Math.abs(ch) > 1e-9 ? (
                                  <span className={ch < 0 ? 'ok' : 'bad'}>
                                    {ch < 0 ? '▼ ' : '▲ '}
                                    {(Math.abs(ch) * 100).toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="note">—</span>
                                )}
                              </td>
                              <td className="n">
                                {!isRegret && nRate != null && qRate != null && okLine ? (
                                  <b>
                                    {vCur} {fmt(qty * nRate, 2, vCur)}
                                  </b>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {/* Summary Footer Rows */}
                    <tr>
                      <td colSpan={5} className="l">
                        Total basic value ({vCur}, excl. loadings &amp; tax)
                      </td>
                      {offerPhase === 'quote' ? (
                        <>
                          <td className="n text-xs text-[var(--t-tx3)]">
                            {metrics.regretCount > 0 ? `${metrics.regretCount} regret` : ''}
                          </td>
                          <td className="n" />
                          <td className="n">
                            <b>
                              {vCur} {fmt(metrics.quotedBasic, 2, vCur)}
                            </b>
                          </td>
                          {!sameCur ? (
                            <td className="n g">
                              {fxVal == null
                                ? 'FX pending'
                                : `${base} ${fmt(metrics.quotedBasic * fxVal, 0, base)}`}
                            </td>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <td colSpan={4} className="n">
                            Initial: {vCur} {fmt(metrics.quotedBasic, 2, vCur)}
                          </td>
                          <td className="n g">
                            {vCur} {fmt(metrics.negBasic, 2, vCur)}
                          </td>
                        </>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

          {/* Commercial Terms & Conditions (replicated from QuotedTermsView / NegotiationView) */}
          <h3>
            3.{' '}
            {offerPhase === 'quote'
              ? 'Quoted Commercial Terms & Conditions'
              : 'Final Negotiated Commercial Terms & Conditions'}
          </h3>
          <p className="note">
            {offerPhase === 'quote'
              ? 'Enter commercial terms exactly as quoted. Mandatory terms marked with * must be completed (enter 0 where no advance applies).'
              : 'Update agreed commercial terms below. Original quoted terms are shown beneath each field with live improvement indicators.'}
          </p>

          {missingReqTerms.length ? (
            <div className="rounded-lg border border-[var(--t-warn-line)] bg-[var(--t-warn-bg)] text-[var(--t-warn)] px-3.5 py-2 mb-2.5 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                Mandatory commercial terms pending ({missingReqTerms.length}):{' '}
                <b>{missingReqTerms.join(', ')}</b>
              </span>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Commercial Term / Condition</th>
                  <th className="dk">
                    {offerPhase === 'quote'
                      ? `${v.name || `Vendor ${safeIdx + 1}`} — Quoted Terms`
                      : `${v.name || `Vendor ${safeIdx + 1}`} — Revised / Agreed Terms`}
                  </th>
                </tr>
              </thead>
              <tbody>
                {TERMS.map(([k, label, ty]) => {
                  const targetObj = offerPhase === 'quote' ? v.qterms || {} : v.terms || {};
                  const fieldPath =
                    offerPhase === 'quote'
                      ? `vendors.${safeIdx}.qterms.${k}`
                      : `vendors.${safeIdx}.terms.${k}`;
                  const req = QT_REQ.includes(k);
                  const lfVal = qtLf(targetObj as Partial<VendorTerms>);
                  return (
                    <tr key={k}>
                      <td className="l">
                        {label}
                        {req ? <span className="req"> *</span> : null}
                      </td>
                      <td>
                        {ty === 'calc' ? (
                          <b className="tabular-nums">
                            {lfVal == null ? '—' : `${lfVal.toFixed(2)}%`}
                          </b>
                        ) : (
                          <FieldControl
                            path={fieldPath}
                            value={targetObj[k]}
                            type={ty === 'p' ? 'n' : ty}
                            ver={ver}
                            role={role}
                            onChange={onChangeField}
                          />
                        )}
                        {offerPhase === 'negotiation' ? renderQnMini(k) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vendor Quote & Compliance Attachments */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 mb-2">
            <h3 style={{ margin: 0 }}>
              4. Supporting Quote Documents &amp; Technical Attachments ({attachments.length})
            </h3>
            {editable ? (
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="btn w whitespace-nowrap shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> Upload Quote PDF / Image
                </button>
              </div>
            ) : null}
          </div>

          <p className="note">
            Attach signed commercial offer PDFs, price breakups, OEM datasheets, or deviation
            clarifications (max 2 MB per file). Buyers can preview attachments directly during price
            comparison and negotiation.
          </p>

          {uploadError ? (
            <div className="lock mb-2">
              <AlertTriangle size={15} />
              <span>{uploadError}</span>
            </div>
          ) : null}

          {!attachments.length ? (
            <div className="rounded-lg border border-dashed border-[var(--t-line2)] bg-[#FAFAFB] px-4 py-6 text-center text-xs text-[var(--t-tx3)]">
              <Paperclip size={20} className="mx-auto mb-1.5 text-[var(--t-tx3)]" />
              <div>No quote documents uploaded for {v.name || `Vendor ${safeIdx + 1}`} yet.</div>
              {editable ? (
                <button
                  type="button"
                  className="btn w mt-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> Select Files to Attach
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Stage</th>
                    <th className="r">Size</th>
                    <th>Uploaded</th>
                    <th style={{ width: 170 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((att) => (
                    <tr key={att.id}>
                      <td>
                        <div className="flex items-center gap-2 font-semibold text-[var(--t-tx)]">
                          <FileText size={14} className="text-[var(--t-acc)] shrink-0" />
                          <span>{att.name}</span>
                        </div>
                      </td>
                      <td className="text-xs text-[var(--t-tx2)]">
                        {att.phase === 'negotiation' ? 'Revised Offer' : 'Initial Quote'}
                      </td>
                      <td className="n text-xs">{formatBytes(att.sizeBytes)}</td>
                      <td className="text-xs text-[var(--t-tx3)]">{fmtD(att.uploadedAt)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="btn w whitespace-nowrap shrink-0"
                            style={{ padding: '4px 9px', fontSize: 11.5 }}
                            onClick={() => setPreviewAtt(att)}
                          >
                            <Eye size={13} /> Preview
                          </button>
                          {att.dataUrl ? (
                            <button
                              type="button"
                              className="btn w whitespace-nowrap shrink-0"
                              style={{ padding: '4px 9px', fontSize: 11.5 }}
                              onClick={() => {
                                fetch(att.dataUrl!)
                                  .then((r) => r.blob())
                                  .then((b) => downloadBlob(att.name, b, att.mimeType))
                                  .catch(() => setPreviewAtt(att));
                              }}
                              title="Download attachment"
                            >
                              <Download size={13} />
                            </button>
                          ) : null}
                          {editable ? (
                            <button
                              type="button"
                              className="btn r whitespace-nowrap shrink-0"
                              style={{ padding: '4px 8px', fontSize: 11.5 }}
                              title="Remove attachment"
                              onClick={() => onRemoveAttachment(safeIdx, att.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vendor Offer Submit Action Bar */}
          <div className="stage-submit">
            <div className="txt">
              <b>
                {offerPhase === 'quote'
                  ? `Submit Initial Quotation — ${v.name || `Vendor ${safeIdx + 1}`}`
                  : `Submit Revised / Negotiated Offer — ${v.name || `Vendor ${safeIdx + 1}`}`}
              </b>
              <span>
                {offerPhase === 'quote'
                  ? 'Validates quote reference, currency/FX, item rates, and mandatory commercial terms, then records your submission for Buyer evaluation.'
                  : 'Confirms final revised unit rates and agreed commercial terms against your initial quote for Buyer Comparative Statement review.'}
              </span>
            </div>
            <span
              className={`st ${
                (offerPhase === 'quote' ? v.quoteSubmittedAt : v.negSubmittedAt) ? '' : 'no'
              }`}
            >
              {offerPhase === 'quote' ? (
                v.quoteSubmittedAt ? (
                  <>
                    <CheckCircle2 size={13} className="inline mr-1" />
                    Submitted {fmtD(v.quoteSubmittedAt)}
                  </>
                ) : (
                  'Pending submission'
                )
              ) : v.negSubmittedAt ? (
                <>
                  <CheckCircle2 size={13} className="inline mr-1" />
                  Submitted {fmtD(v.negSubmittedAt)}
                </>
              ) : (
                'Pending submission'
              )}
            </span>
            <button
              type="button"
              className="btn g whitespace-nowrap shrink-0"
              disabled={!editable || (offerPhase === 'negotiation' && !vendorAcceptedAny)}
              onClick={() => onSubmitVendorOffer(safeIdx, offerPhase)}
            >
              {offerPhase === 'quote' ? 'Submit Quotation →' : 'Submit Revised Offer →'}
            </button>
          </div>
        </>
      )}

      <AttachmentPreviewModal attachment={previewAtt} onClose={() => setPreviewAtt(null)} />
      {v && safeIdx >= 0 ? (
        <DiscountOptionModal
          open={discountModal.open}
          data={d}
          vendorIdx={safeIdx}
          initialPercent={discountModal.initialPercent}
          initialItemIdx={discountModal.initialItemIdx}
          onApply={(payload) => {
            onApplyDiscount(payload);
            setItemDiscPct((prev) => {
              const next = { ...prev };
              payload.itemIndices.forEach((idx) => {
                delete next[idx];
              });
              return next;
            });
            setVendorDiscPct('');
          }}
          onClose={() => setDiscountModal((prev) => ({ ...prev, open: false }))}
        />
      ) : null}
    </>
  );
};
