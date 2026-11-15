import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  Paperclip,
  Percent,
  TrendingDown,
  UserCheck,
} from 'lucide-react';
import type {
  CalcResult,
  DoaBand,
  NfaData,
  NfaVersion,
  RoleName,
  StageId,
  Vendor,
  VendorAttachment,
  VendorTerms,
} from '../../types/enfa.ts';
import { QT_CH, QT_KEYS, TERMS } from '../../utils/enfaConstants.ts';
import {
  fmt,
  isOk,
  isOkForLine,
  num,
  qnStats,
  qtChange,
  qtCore,
  qtDisp,
  qtHas,
  qtLf,
  shortK,
  te,
  techBlockReason,
} from '../../utils/enfaEngine.ts';
import { DiscountOptionModal, type DiscountApplyPayload } from './DiscountOptionModal.tsx';
import { FieldControl, LockBanner, StageSubmitBar } from './FieldControl.tsx';
import { AttachmentPreviewModal } from './VendorView.tsx';

export const QuotedVsNegotiatedPanel: React.FC<{
  d: NfaData;
  doa: DoaBand[];
  withBtn?: boolean;
  onDownloadExcel: (mode: 'pre' | 'post') => void;
}> = ({ d, doa, withBtn = true, onDownloadExcel }) => {
  const hasQterms = d.vendors.some(
    (v) => v.qterms && QT_KEYS().some((k) => qtHas(v.qterms![k]))
  );
  if (!hasQterms) {
    return (
      <div className="rec flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>
          Quoted terms were not captured for this record (created before the Quoted Terms stage) –
          quoted-vs-negotiated comparison is not available.
        </span>
      </div>
    );
  }

  const st = qnStats(d, doa);
  const base = d.header.cur || 'INR';

  return (
    <div className="qn-panel">
      <div className="ch-h">
        <TrendingDown size={16} className="text-[var(--t-acc)]" />
        <b>Negotiation outcome — quoted vs negotiated</b>
        <small>
          Landed values in {base} on items with a negotiated price; terms compared line by line
        </small>
      </div>
      <div className="qn-cards">
        {st.map((s) => (
          <div key={s.V.j} className="qn-card">
            <b title={s.V.name}>{s.V.name}</b>
            {s.NV ? (
              <>
                <div className="qn-v">
                  <span>
                    Quoted <s>{shortK(s.ql, base)}</s>
                  </span>
                  <span>
                    Negotiated <b>{shortK(s.nl, base)}</b>
                  </span>
                </div>
                <div className={`qn-s ${(s.sav || 0) > 0 ? 'ok' : (s.sav || 0) < 0 ? 'bad' : ''}`}>
                  {(s.sav || 0) > 0
                    ? '▼ saving '
                    : (s.sav || 0) < 0
                    ? '▲ increase '
                    : 'no change '}
                  {s.sav
                    ? `${shortK(Math.abs(s.sav), base)} · ${(Math.abs(s.pct || 0) * 100).toFixed(1)}%`
                    : ''}
                </div>
              </>
            ) : (
              <div className="qn-v">
                <span className="lpp-na">Not negotiated (not technically accepted)</span>
              </div>
            )}
            <div className="qn-t">
              <span className="ok">▲ {s.imp} improved</span>
              <span className="bad">▼ {s.wor} worsened</span>
              <span>{s.chg} changed</span>
            </div>
          </div>
        ))}
      </div>
      {withBtn ? (
        <p className="noprint mt-2.5 flex items-center gap-2 flex-wrap">
          <button type="button" className="btn" onClick={() => onDownloadExcel('post')}>
            <Download size={14} /> Download quoted vs negotiated (Excel)
          </button>
          <span className="note">
            Summary, price changes item by item, every term quoted → negotiated, and scoring on final
            terms.
          </span>
        </p>
      ) : null}
    </div>
  );
};

export const QuotedVsNegotiatedTableRO: React.FC<{ d: NfaData; doa: DoaBand[] }> = ({ d, doa }) => {
  const Q = qtCore(d, 'q', doa);
  if (!Q.vend.length) return null;
  return (
    <div className="lpp-wrap">
      <table className="qt-tbl">
        <thead>
          <tr>
            <th style={{ width: '22%' }}>Term / condition</th>
            {Q.vend.map((V) => (
              <th key={V.j} className="dk">
                {V.name}
                <br />
                <small>quoted → negotiated</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TERMS.map(([k, lab]) => (
            <tr key={k}>
              <td className="l">{lab}</td>
              {Q.vend.map((V) => {
                const ch = qtChange(k, V.qt, V.nt);
                const a = qtDisp(k, V.qt);
                const b = qtDisp(k, V.nt);
                return (
                  <td
                    key={V.j}
                    className={
                      ch === 'better'
                        ? 'qt-b'
                        : ch === 'worse'
                        ? 'qt-w'
                        : ch === 'changed'
                        ? 'qt-f'
                        : ''
                    }
                  >
                    {ch === 'same' ? (
                      b || <i className="lpp-na">—</i>
                    ) : (
                      <>
                        <small>
                          <s>{a || '—'}</s>
                        </small>
                        <br />
                        <b>{b || '—'}</b>{' '}
                        <em className={`qn-chip ${ch}`}>{QT_CH[ch][0]}</em>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const NegotiationView: React.FC<{
  ver: NfaVersion;
  c: CalcResult;
  role: RoleName;
  doa: DoaBand[];
  onChangeField: (path: string, val: string | number) => void;
  onCopyQuoted: (vendorIdx: number) => void;
  onApplyDiscount: (payload: DiscountApplyPayload) => void;
  onDownloadExcel: (mode: 'pre' | 'post') => void;
  onSubmitStage: (stage: StageId) => void;
  onSwitchToVendorPortal?: (vendorIdx?: number) => void;
}> = ({
  ver,
  c,
  role,
  doa,
  onChangeField,
  onCopyQuoted,
  onApplyDiscount,
  onDownloadExcel,
  onSubmitStage,
  onSwitchToVendorPortal,
}) => {
  const [previewAtt, setPreviewAtt] = useState<VendorAttachment | null>(null);
  const [itemDiscPct, setItemDiscPct] = useState<Record<string, string>>({});
  const [vendorDiscPct, setVendorDiscPct] = useState<Record<number, string>>({});
  const [discountModal, setDiscountModal] = useState<{
    open: boolean;
    vendorIdx: number;
    initialPercent: number;
    initialItemIdx: number | null;
  }>({
    open: false,
    vendorIdx: 0,
    initialPercent: 0,
    initialItemIdx: null,
  });
  const d = ver.data;
  const editable = ver.status === 'Draft' && role === 'Buyer';
  const roleMsg =
    ver.status !== 'Draft'
      ? 'This version is locked because it has been submitted or closed.'
      : role !== 'Buyer'
      ? 'Switch the “Acting as” selector at the top to Buyer to enter negotiated prices.'
      : '';

  const blocked = d.vendors
    .map((v, j) => ({ v, j }))
    .filter(
      (x) =>
        x.v.name &&
        (d.techMode === 'Line-wise'
          ? !d.items.some((_it, i) => isOkForLine(d, x.v, i))
          : !isOk(x.v))
    );

  const renderQnMini = (v: Vendor, k: string) => {
    if (!v.qterms) return null;
    const qt = Object.assign({}, v.qterms) as Partial<VendorTerms>;
    const nt = Object.assign({}, v.terms) as Partial<VendorTerms>;
    qt.__lf = qtLf(qt);
    nt.__lf = qtLf(nt);
    const ch = qtChange(k, qt, nt);
    return (
      <div className="qn-mini">
        <small>Quoted: {qtDisp(k, qt) || '—'}</small>
        {ch !== 'same' ? (
          <>
            {' '}
            <em className={`qn-chip ${ch}`}>{QT_CH[ch][0]}</em>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <LockBanner ver={ver} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex-1" style={{ marginBottom: 6 }}>
          4. Negotiation &amp; Commercial Terms — Vendor-wise
        </h2>
        {onSwitchToVendorPortal ? (
          <button
            type="button"
            className="btn w whitespace-nowrap shrink-0 mb-2"
            onClick={() => onSwitchToVendorPortal(0)}
          >
            <UserCheck size={14} /> Open Vendor Portal View
          </button>
        ) : null}
      </div>
      {roleMsg ? <div className="lock">{roleMsg}</div> : null}

      <QuotedVsNegotiatedPanel d={d} doa={doa} withBtn onDownloadExcel={onDownloadExcel} />

      <h3>Negotiated Prices — Technically Accepted Vendors Only</h3>
      <p className="note">
        Negotiated prices unlock only after a complete Accepted technical evaluation. Rejected,
        Pending, or incomplete vendors are locked; prices already entered are kept but ignored until
        the vendor is accepted. <b>Every accepted vendor needs a final price on each line it quoted</b>{' '}
        – enter the negotiated price, or use “Copy quoted → negotiated” where no negotiation took
        place. Without it the vendor cannot be ranked and submission is blocked.
      </p>

      {blocked.length ? (
        <div className="rec">
          <b>Vendors currently locked:</b>
          <ul className="list-disc pl-5 mt-1">
            {blocked.map((x) => (
              <li key={x.j}>
                {x.v.name || `Vendor ${x.j + 1}`}: {techBlockReason(x.v)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              {d.vendors.map((v, j) => {
                const okV =
                  d.techMode === 'Line-wise'
                    ? d.items.some((_it, i) => isOkForLine(d, v, i))
                    : isOk(v);
                return (
                  <th key={j}>
                    {v.name || '—'} ({v.terms.cur || d.header.cur}) —{' '}
                    {okV ? 'Negotiated' : 'locked'}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {d.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.desc}</td>
                {d.vendors.map((v, j) => {
                  const cell = it.r[j];
                  const isRegret = Boolean(cell?.regret);
                  const q = num(cell?.q);
                  if (isRegret) {
                    return (
                      <td key={j} className="text-slate-500 text-xs">
                        <div>
                          <b>Regretted — NQ</b>
                        </div>
                        {cell?.regretReason ? (
                          <div className="text-[11px] text-[var(--t-tx3)]">{cell.regretReason}</div>
                        ) : null}
                      </td>
                    );
                  }
                  if (q == null) {
                    return (
                      <td key={j} className="text-slate-500 text-xs">
                        Not quoted
                      </td>
                    );
                  }
                  const okLine = isOkForLine(d, v, i);
                  if (!okLine) {
                    const txt =
                      d.techMode === 'Line-wise'
                        ? v.techEval?.lines?.[String(i)]?.status === 'Rejected'
                          ? 'Rejected — locked'
                          : 'Not accepted / pending — locked'
                        : te(v).status === 'Rejected'
                        ? 'Rejected — locked'
                        : 'Not yet accepted — locked';
                    return (
                      <td key={j} className="text-slate-500 text-xs">
                        {txt}
                      </td>
                    );
                  }
                  const n = num(cell?.n);
                  const ch = n != null && q > 0 ? n / q - 1 : null;
                  const cellKey = `${i}-${j}`;
                  const pctDraft = itemDiscPct[cellKey] ?? '';
                  const openLineDiscountModal = () => {
                    const parsed = Number(pctDraft);
                    setDiscountModal({
                      open: true,
                      vendorIdx: j,
                      initialPercent: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                      initialItemIdx: i,
                    });
                  };
                  return (
                    <td key={j}>
                      <FieldControl
                        path={`items.${i}.r.${j}.n`}
                        value={cell?.n}
                        type="n"
                        ver={ver}
                        role={role}
                        onChange={onChangeField}
                      />
                      <div className="qp-mini">
                        Quoted: {fmt(q, 2, v.terms.cur || d.header.cur)}
                        {ch != null && Math.abs(ch) > 1e-9 ? (
                          <>
                            {' '}
                            ·{' '}
                            <b className={ch < 0 ? 'ok' : 'bad'}>
                              {ch < 0 ? '▼' : '▲'} {(Math.abs(ch) * 100).toFixed(1)}%
                            </b>
                          </>
                        ) : null}
                      </div>
                      {editable ? (
                        <div className="flex items-center gap-1 mt-1.5">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            max={99.99}
                            placeholder="Disc %"
                            aria-label={`Discount percent for item ${i + 1} vendor ${j + 1}`}
                            value={pctDraft}
                            onChange={(ev) =>
                              setItemDiscPct((prev) => ({ ...prev, [cellKey]: ev.target.value }))
                            }
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') {
                                ev.preventDefault();
                                openLineDiscountModal();
                              }
                            }}
                            style={{ width: 68, fontSize: 11, padding: '3px 6px' }}
                          />
                          <button
                            type="button"
                            className="btn w whitespace-nowrap shrink-0"
                            style={{ padding: '3px 7px', fontSize: 11 }}
                            onClick={openLineDiscountModal}
                            title="Enter discount % and choose calculation options"
                          >
                            <Percent size={11} /> Apply %
                          </button>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="l">
                Final price status &amp; quick actions
              </td>
              {d.vendors.map((v, j) => {
                const okV =
                  d.techMode === 'Line-wise'
                    ? d.items.some(
                        (it, i) => !it.r?.[j]?.regret && num(it.r?.[j]?.q) != null && isOkForLine(d, v, i)
                      )
                    : isOk(v) &&
                      d.items.some((it) => !it.r?.[j]?.regret && num(it.r?.[j]?.q) != null);
                const vPct = vendorDiscPct[j] ?? '';
                const openVendorDiscountModal = () => {
                  const parsed = Number(vPct);
                  setDiscountModal({
                    open: true,
                    vendorIdx: j,
                    initialPercent: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                    initialItemIdx: null,
                  });
                };
                return (
                  <td key={j}>
                    {okV ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.negMissing[j] ? (
                            <>
                              <span className="bad">{c.negMissing[j]} line(s) pending</span>
                              {editable ? (
                                <button
                                  type="button"
                                  className="btn w"
                                  onClick={() => onCopyQuoted(j)}
                                >
                                  Copy quoted → negotiated
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <span className="ok">Complete</span>
                          )}
                        </div>
                        {editable ? (
                          <div className="flex items-center gap-1 pt-0.5">
                            <input
                              type="number"
                              step="any"
                              min={0}
                              max={99.99}
                              placeholder="Vendor Disc %"
                              aria-label={`Vendor-wide discount percent for ${v.name || `Vendor ${j + 1}`}`}
                              value={vPct}
                              onChange={(ev) =>
                                setVendorDiscPct((prev) => ({ ...prev, [j]: ev.target.value }))
                              }
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter') {
                                  ev.preventDefault();
                                  openVendorDiscountModal();
                                }
                              }}
                              style={{ width: 92, fontSize: 11.5, padding: '4px 7px' }}
                            />
                            <button
                              type="button"
                              className="btn w whitespace-nowrap shrink-0"
                              style={{ padding: '4px 9px', fontSize: 11.5 }}
                              onClick={openVendorDiscountModal}
                            >
                              <Percent size={12} /> Discount % Options
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto mt-3">
        <table>
          <thead>
            <tr>
              <th>Term</th>
              {d.vendors.map((v, j) => (
                <th key={j} className="dk">
                  {v.name || '—'} · {v.terms.cur || d.header.cur}
                  <br />
                  <small>negotiated (quoted shown below)</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TERMS.map(([k, l, t]) => (
              <tr key={k}>
                <td className="l">{l}</td>
                {d.vendors.map((v, j) => (
                  <td key={j} style={{ minWidth: 200 }}>
                    {t === 'calc' ? (
                      <b>{(c.lf[j] * 100).toFixed(2)}%</b>
                    ) : (
                      <FieldControl
                        path={`vendors.${j}.terms.${k}`}
                        value={v.terms?.[k]}
                        type={t === 'p' ? 'n' : t}
                        ver={ver}
                        role={role}
                        onChange={onChangeField}
                      />
                    )}
                    {v.name ? renderQnMini(v, k) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="note">
        % fields are entered as whole numbers (e.g. 4.5 = 4.5%). Landing factor = Freight + P&amp;F
        + Insurance + Other loadings. Quote currency and FX rate are captured at the Quotes stage
        and applied here unchanged; negotiated prices are entered in the quote currency.
        Comparisons, savings, budget and DoA use the NFA base currency. Only technically accepted
        vendors (or accepted vendor-item lines in Line-wise mode) are ranked in the CS.
      </p>

      {d.vendors.some((v) => (v.attachments || []).length > 0) ? (
        <div className="mt-4 rounded-lg border border-[var(--t-line)] bg-[#F9FAFB] p-3">
          <div className="text-xs font-bold text-[var(--t-tx)] flex items-center gap-1.5 mb-2">
            <Paperclip size={13} /> Vendor Quote Attachments
          </div>
          <div className="flex flex-wrap gap-2">
            {d.vendors.map((v, j) =>
              (v.attachments || []).map((att) => (
                <button
                  key={`${j}-${att.id}`}
                  type="button"
                  className="btn w whitespace-nowrap shrink-0"
                  style={{ padding: '4px 9px', fontSize: 11.5 }}
                  onClick={() => setPreviewAtt(att)}
                >
                  <Eye size={12} /> {v.name || `V${j + 1}`}: {att.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <StageSubmitBar
        stage="trm"
        label="Negotiation & Terms"
        ownerRole="Buyer"
        ver={ver}
        currentRole={role}
        onSubmit={onSubmitStage}
      />

      <AttachmentPreviewModal attachment={previewAtt} onClose={() => setPreviewAtt(null)} />
      <DiscountOptionModal
        open={discountModal.open}
        data={d}
        vendorIdx={discountModal.vendorIdx}
        initialPercent={discountModal.initialPercent}
        initialItemIdx={discountModal.initialItemIdx}
        onApply={(payload) => {
          onApplyDiscount(payload);
          setItemDiscPct((prev) => {
            const next = { ...prev };
            payload.itemIndices.forEach((idx) => {
              delete next[`${idx}-${payload.vendorIdx}`];
            });
            return next;
          });
          setVendorDiscPct((prev) => {
            const next = { ...prev };
            delete next[payload.vendorIdx];
            return next;
          });
        }}
        onClose={() => setDiscountModal((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
};
