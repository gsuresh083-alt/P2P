import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Download,
  Eye,
  LayoutGrid,
  Paperclip,
  Plus,
} from 'lucide-react';
import type { DoaBand, NfaVersion, RoleName, StageId, VendorAttachment } from '../../types/enfa.ts';
import { QT_REQ, TERMS } from '../../utils/enfaConstants.ts';
import {
  fmt,
  num,
  qtCore,
  qtDisp,
  qtFlagOf,
  qtHas,
  qtPoints,
  shortK,
} from '../../utils/enfaEngine.ts';
import { RingChart } from './Charts.tsx';
import { FieldControl, LockBanner, StageSubmitBar } from './FieldControl.tsx';
import { AttachmentPreviewModal } from './VendorView.tsx';

export const QuotesView: React.FC<{
  ver: NfaVersion;
  role: RoleName;
  onChangeField: (path: string, val: string | number) => void;
  onChangeQuoteScope: (vendorIdx: number, scope: 'all' | 'partial') => void;
  onToggleRegret: (itemIdx: number, vendorIdx: number, regret: boolean) => void;
  onAddVendor: () => void;
  onDeleteVendor: (idx: number) => void;
  onAddItem: () => void;
  onDeleteItem: (idx: number) => void;
  onSubmitStage: (stage: StageId) => void;
}> = ({
  ver,
  role,
  onChangeField,
  onChangeQuoteScope,
  onToggleRegret,
  onAddVendor,
  onDeleteVendor,
  onAddItem,
  onDeleteItem,
  onSubmitStage,
}) => {
  const [previewAtt, setPreviewAtt] = useState<VendorAttachment | null>(null);
  const d = ver.data;
  const e = ver.status === 'Draft' && role === 'Buyer';
  const base = d.header.cur || 'INR';
  const vc = (j: number) => d.vendors[j]?.terms?.cur || base;
  const fx = (j: number) =>
    vc(j) === base
      ? 1
      : (num(d.vendors[j]?.terms?.fxRate) || 0) > 0
      ? num(d.vendors[j]?.terms?.fxRate)
      : null;
  const tot = (j: number) =>
    d.items.reduce(
      (s, it) =>
        s +
        (!it.r[j]?.regret && num(it.r[j]?.q) != null
          ? (Number(it.qty) || 0) * Number(it.r[j].q)
          : 0),
      0
    );
  const fxOk = (j: number) =>
    vc(j) === base ||
    (fx(j) != null &&
      d.vendors[j]?.terms?.fxDate &&
      String(d.vendors[j]?.terms?.fxSource || '').trim());
  const scopeOf = (j: number): 'all' | 'partial' =>
    d.vendors[j]?.quoteScope ||
    (d.items.some((it) => it.r?.[j]?.regret) ? 'partial' : 'all');

  return (
    <>
      <LockBanner ver={ver} />
      <h2>2. Vendors &amp; Quotations</h2>
      <p className="note">
        Capture each vendor&apos;s quotation <b>in the currency it was offered</b>. NFA base currency:{' '}
        <b>{base}</b> (set in RFQ Header). For a foreign-currency quote, record the FX rate ({base}{' '}
        per 1 unit of quote currency), the rate date and its source — this rate is frozen with the
        quotation and used for the negotiated price, CS ranking, savings, budget and DoA.
      </p>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>V#</th>
              <th>Vendor Name</th>
              <th>Vendor Code</th>
              <th>Quotation Ref *</th>
              <th>Quote Date</th>
              <th>Final Offer Date</th>
              <th style={{ minWidth: 95 }}>Quote Currency *</th>
              <th style={{ minWidth: 110 }}>FX → {base} *</th>
              <th>FX Rate Date *</th>
              <th style={{ minWidth: 150 }}>FX Source *</th>
              <th style={{ minWidth: 145 }}>Quote Scope</th>
              <th>Status</th>
              {e ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {d.vendors.map((v, j) => {
              const same = vc(j) === base;
              return (
                <tr key={j}>
                  <td className="l" style={{ width: 40 }}>
                    V{j + 1}
                  </td>
                  <td style={{ minWidth: 190 }}>
                    <FieldControl
                      path={`vendors.${j}.name`}
                      value={v.name}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    <FieldControl
                      path={`vendors.${j}.code`}
                      value={v.code}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <FieldControl
                      path={`vendors.${j}.ref`}
                      value={v.ref}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    <FieldControl
                      path={`vendors.${j}.qdate`}
                      value={v.qdate}
                      type="d"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    <FieldControl
                      path={`vendors.${j}.fdate`}
                      value={v.fdate}
                      type="d"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    <FieldControl
                      path={`vendors.${j}.terms.cur`}
                      value={v.terms?.cur}
                      type="s:cur"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </td>
                  <td>
                    {same ? (
                      <span className="note">1.0000 (base)</span>
                    ) : (
                      <FieldControl
                        path={`vendors.${j}.terms.fxRate`}
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
                    {same ? (
                      <span className="note">n/a</span>
                    ) : (
                      <FieldControl
                        path={`vendors.${j}.terms.fxDate`}
                        value={v.terms?.fxDate}
                        type="d"
                        ver={ver}
                        role={role}
                        onChange={onChangeField}
                      />
                    )}
                  </td>
                  <td>
                    {same ? (
                      <span className="note">n/a</span>
                    ) : (
                      <FieldControl
                        path={`vendors.${j}.terms.fxSource`}
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
                    <select
                      aria-label={`Quote scope for ${v.name || `Vendor ${j + 1}`}`}
                      disabled={!e}
                      value={scopeOf(j)}
                      onChange={(ev) =>
                        onChangeQuoteScope(j, ev.target.value as 'all' | 'partial')
                      }
                    >
                      <option value="all">All items</option>
                      <option value="partial">Partial (Regret items)</option>
                    </select>
                  </td>
                  <td>
                    {!v.name ? (
                      '—'
                    ) : fxOk(j) ? (
                      <span className="ok">✓ {vc(j)}</span>
                    ) : (
                      <span className="bad">FX pending</span>
                    )}
                  </td>
                  {e ? (
                    <td>
                      <button
                        type="button"
                        className="x"
                        title="Remove vendor"
                        onClick={() => onDeleteVendor(j)}
                      >
                        ✕
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {e ? (
        <p className="my-2">
          <button type="button" className="btn w" onClick={onAddVendor}>
            <Plus size={14} /> Add vendor
          </button>
        </p>
      ) : null}

      <h3>Item-wise quoted rates (per UOM, basic, excl. tax — in quote currency)</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>#</th>
              <th rowSpan={2}>Item Code</th>
              <th rowSpan={2} style={{ minWidth: 220 }}>
                Description
              </th>
              <th rowSpan={2}>UOM</th>
              <th rowSpan={2}>Qty</th>
              {d.vendors.map((v, j) => (
                <th key={j} className="dk">
                  {v.name || '—'}
                  <br />
                  <small>
                    {vc(j)}
                    {vc(j) !== base ? ` · FX ${fx(j) == null ? '—' : fmt(fx(j), 4, base)}` : ''}
                  </small>
                </th>
              ))}
              {e ? <th rowSpan={2} /> : null}
            </tr>
            <tr>
              {d.vendors.map((_v, j) => (
                <th key={j}>Quoted ({vc(j)})</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  {it.erpSource ? (
                    <b>{it.code}</b>
                  ) : (
                    <FieldControl
                      path={`items.${i}.code`}
                      value={it.code}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  )}
                </td>
                <td>
                  <FieldControl
                    path={`items.${i}.desc`}
                    value={it.desc}
                    type="a"
                    ver={ver}
                    role={role}
                    onChange={onChangeField}
                  />
                  {it.erpSource ? (
                    <small className="note block">
                      Imported from {it.erpSource.prNumber} / {it.erpSource.prLineNumber}
                    </small>
                  ) : null}
                </td>
                <td style={{ width: 65 }}>
                  {it.erpSource ? (
                    it.uom
                  ) : (
                    <FieldControl
                      path={`items.${i}.uom`}
                      value={it.uom}
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  )}
                </td>
                <td style={{ width: 70 }}>
                  {it.erpSource ? (
                    <b>{fmt(it.qty, 3, base)}</b>
                  ) : (
                    <FieldControl
                      path={`items.${i}.qty`}
                      value={it.qty}
                      type="n"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  )}
                </td>
                {d.vendors.map((_v, j) => {
                  const cell = it.r[j];
                  const isRegret = Boolean(cell?.regret);
                  const q = num(cell?.q);
                  const fxRate = fx(j);
                  return (
                    <td key={j} style={{ minWidth: 145 }}>
                      {isRegret ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="bad text-xs">Regretted</span>
                            {e ? (
                              <button
                                type="button"
                                className="btn w whitespace-nowrap shrink-0"
                                style={{ padding: '2px 7px', fontSize: 11 }}
                                onClick={() => onToggleRegret(i, j, false)}
                              >
                                Quote
                              </button>
                            ) : null}
                          </div>
                          <FieldControl
                            path={`items.${i}.r.${j}.regretReason`}
                            value={cell?.regretReason || ''}
                            placeholder="Regret reason (optional)"
                            ver={ver}
                            role={role}
                            onChange={onChangeField}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <FieldControl
                                path={`items.${i}.r.${j}.q`}
                                value={cell?.q}
                                type="n"
                                ver={ver}
                                role={role}
                                onChange={onChangeField}
                              />
                            </div>
                            {e ? (
                              <button
                                type="button"
                                className="btn w whitespace-nowrap shrink-0"
                                style={{ padding: '4px 7px', fontSize: 11 }}
                                title="Mark this item as regretted (vendor declines to quote)"
                                onClick={() => onToggleRegret(i, j, true)}
                              >
                                Regret
                              </button>
                            ) : null}
                          </div>
                          {q != null && vc(j) !== base ? (
                            <small className="note block text-right mt-0.5">
                              ≈ {base} {fxRate == null ? 'FX pending' : fmt(q * fxRate, 2, base)}
                            </small>
                          ) : null}
                        </>
                      )}
                    </td>
                  );
                })}
                {e ? (
                  <td>
                    <button
                      type="button"
                      className="x"
                      title="Remove item"
                      onClick={() => onDeleteItem(i)}
                    >
                      ✕
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="l">
                Item coverage (Quoted / Regretted)
              </td>
              {d.vendors.map((_v, j) => {
                const qCnt = d.items.filter((it) => !it.r[j]?.regret && num(it.r[j]?.q) != null).length;
                const regCnt = d.items.filter((it) => it.r[j]?.regret).length;
                return (
                  <td key={j} className="text-xs text-right tabular-nums">
                    <span className="ok">{qCnt} quoted</span>
                    {regCnt > 0 ? <span className="bad"> · {regCnt} regret</span> : null}
                    {qCnt + regCnt < d.items.length ? (
                      <span className="note"> · {d.items.length - qCnt - regCnt} blank</span>
                    ) : null}
                  </td>
                );
              })}
              {e ? <td /> : null}
            </tr>
            <tr>
              <td colSpan={5} className="l">
                Total quoted value (quote currency)
              </td>
              {d.vendors.map((_v, j) => (
                <td key={j} className="n">
                  <b>
                    {vc(j)} {fmt(tot(j), 2, vc(j))}
                  </b>
                </td>
              ))}
              {e ? <td /> : null}
            </tr>
            <tr>
              <td colSpan={5} className="l">
                Total quoted value in {base} (basic, before landing)
              </td>
              {d.vendors.map((_v, j) => {
                const fxRate = fx(j);
                return (
                  <td key={j} className="n g">
                    {fxRate == null ? (
                      <span className="bad">FX pending</span>
                    ) : (
                      `${base} ${fmt(tot(j) * fxRate, 0, base)}`
                    )}
                  </td>
                );
              })}
              {e ? <td /> : null}
            </tr>
          </tbody>
        </table>
      </div>

      {e ? (
        <p className="my-2">
          <button type="button" className="btn w" onClick={onAddItem}>
            <Plus size={14} /> Add item
          </button>
        </p>
      ) : null}
      <p className="note">
        Negotiated / final prices are entered later on the Negotiation stage in the{' '}
        <b>same quote currency</b> and converted with the FX rate captured here. Changing a
        vendor&apos;s currency or FX reopens this stage and everything after it.
      </p>
      {d.vendors.some((v) => (v.attachments || []).length > 0) ? (
        <div className="mt-3 rounded-lg border border-[var(--t-line)] bg-[#F9FAFB] p-3">
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
        stage="quo"
        label="Vendor Quotations"
        ownerRole="Buyer"
        ver={ver}
        currentRole={role}
        onSubmit={onSubmitStage}
      />

      <AttachmentPreviewModal attachment={previewAtt} onClose={() => setPreviewAtt(null)} />
    </>
  );
};

export const QuotedTermsView: React.FC<{
  ver: NfaVersion;
  role: RoleName;
  doa: DoaBand[];
  onChangeField: (path: string, val: string | number) => void;
  onDownloadExcel: (mode: 'pre' | 'post') => void;
  onSubmitStage: (stage: StageId) => void;
}> = ({ ver, role, doa, onChangeField, onDownloadExcel, onSubmitStage }) => {
  const d = ver.data;
  const M = qtCore(d, 'q', doa);
  const base = d.header.cur || 'INR';

  if (!M.vend.length) {
    return (
      <>
        <LockBanner ver={ver} />
        <h2>
          <ArrowLeftRight size={18} /> 2A. Quoted Terms &amp; Conditions
        </h2>
        <div className="ch-empty">
          No vendor has quoted yet – enter vendors and quoted rates on the Quotes stage first.
        </div>
      </>
    );
  }

  const P = qtPoints(M);
  const hi = P.filter((p) => p.pri === 'High');
  const vb = M.vend.filter((V) => V.complete).sort((a, b) => a.landed - b.landed);
  const n = M.vend.length;

  return (
    <>
      <LockBanner ver={ver} />
      <h2>
        <ArrowLeftRight size={18} /> 2A. Quoted Terms &amp; Conditions — compare before technical
        evaluation &amp; negotiation
      </h2>
      <p className="note">
        Enter each vendor’s terms <b>exactly as quoted</b>. The system compares them side by side,
        highlights the best and weakest offer for every term, flags risks and suggests the
        commercially strongest vendor. Download the Excel to discuss with vendors and team leads
        before negotiation. On submission these quoted terms become the starting point of the
        Negotiation stage, and the final NFA shows quoted → negotiated.
      </p>

      {M.best ? (
        <div className="qt-sugg">
          <CheckCircle2 size={22} />
          <div className="t">
            Commercially strongest quote: <b>{M.best.name}</b> — score{' '}
            <b>{M.best.score.toFixed(1)}</b>/100
            {vb[0] ? (
              <>
                {' '}
                · lowest landed value: <b>{vb[0].name}</b> ({base} {fmt(vb[0].landed, 0, base)})
              </>
            ) : null}
            <small>
              {P.length} negotiation point(s) identified · {hi.length} high priority · decision aid
              only – award follows the CS after technical evaluation &amp; negotiation
            </small>
          </div>
          <button type="button" className="btn" onClick={() => onDownloadExcel('pre')}>
            <Download size={14} /> Download comparison (Excel)
          </button>
        </div>
      ) : null}

      <div className="qt-cards">
        {[...M.vend]
          .sort((a, b) => a.rank - b.rank)
          .map((V) => (
            <div key={V.j} className={`qt-card ${V.rank === 1 ? 'top' : ''}`}>
              <RingChart progress={V.score / 100} size={58} label={V.score.toFixed(0)} />
              <div className="qt-cb">
                <b title={V.name}>{V.name}</b>
                <span>
                  {V.rank === 1 ? <em className="qt-tag">Suggested</em> : `Rank ${V.rank}`} ·{' '}
                  {V.items}/{M.items.length} items
                </span>
                <span>
                  Landed {base} <b>{shortK(V.landed, base)}</b>
                  {vb[0] === V ? (
                    <>
                      {' '}
                      <em className="qt-tag l1">L1</em>
                    </>
                  ) : V.complete && vb[0] ? (
                    <>
                      {' '}
                      <small>+{((V.landed / vb[0].landed - 1) * 100).toFixed(1)}%</small>
                    </>
                  ) : null}
                </span>
                <span>
                  Best on <b>{V.bestCount}</b> term(s)
                  {V.flags.length ? (
                    <>
                      {' '}
                      ·{' '}
                      <i className="qt-fl" title={V.flags.join('\n')}>
                        ⚠ {V.flags.length} risk
                      </i>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
      </div>

      <div className="qt-leg">
        <span>
          <i className="qt-b" />
          Best in this RFQ
        </span>
        <span>
          <i className="qt-w" />
          Weakest
        </span>
        <span>
          <i className="qt-f" />
          Risk – review
        </span>
        <span>
          <i className="qt-i" />
          Differs – verify
        </span>
      </div>

      <div className="lpp-wrap">
        <table className="qt-tbl">
          <thead>
            <tr>
              <th style={{ width: '24%' }}>Term / condition</th>
              {M.vend.map((V) => (
                <th key={V.j} className="dk">
                  {V.name}
                  <br />
                  <small>
                    {V.cur}
                    {V.ref ? ` · ${V.ref}` : ''}
                  </small>
                </th>
              ))}
              <th style={{ width: '24%' }}>Assessment</th>
            </tr>
          </thead>
          <tbody>
            <tr className="qt-sum">
              <td className="l">Landed value ({base}, quoted terms)</td>
              {M.vend.map((V) => (
                <td
                  key={V.j}
                  className={`n ${
                    vb[0] === V ? 'qt-b' : vb.length > 1 && vb[vb.length - 1] === V ? 'qt-w' : ''
                  }`}
                >
                  <b>{fmt(V.landed, 0, base)}</b>
                  {V.complete ? null : (
                    <div>
                      <small className="qt-part">
                        {V.items} of {M.items.length} items
                      </small>
                    </div>
                  )}
                </td>
              ))}
              <td>
                <small>
                  Lowest among vendors quoting every item: <b>{vb[0]?.name || '—'}</b>
                </small>
              </td>
            </tr>
            <tr className="qt-sum">
              <td className="l">Commercial score (/100)</td>
              {M.vend.map((V) => (
                <td
                  key={V.j}
                  className={`n ${V.rank === 1 ? 'qt-b' : V.rank === n && n > 1 ? 'qt-w' : ''}`}
                >
                  <b>{V.score.toFixed(1)}</b> <small>· rank {V.rank}</small>
                </td>
              ))}
              <td>
                <small>
                  Weighted: price 60 · delivery 10 · advance 10 · warranty 8 · validity 4 · LD 4 · PBG
                  4
                </small>
              </td>
            </tr>
            {M.rows.map((row) => {
              const flags: string[] = [];
              return (
                <tr key={row.k}>
                  <td className="l">
                    {row.lab}
                    {QT_REQ.includes(row.k) ? <span className="req"> *</span> : null}
                  </td>
                  {M.vend.map((V) => {
                    const fl = qtFlagOf(row.k, V.t, M.band);
                    if (fl) flags.push(V.name);
                    const cls = fl
                      ? 'qt-f'
                      : row.ev.best.includes(V.j)
                      ? 'qt-b'
                      : row.ev.worst.includes(V.j)
                      ? 'qt-w'
                      : row.ev.diff
                      ? 'qt-i'
                      : '';
                    const miss = QT_REQ.includes(row.k) && !qtHas(V.t[row.k]);
                    const ty = TERMS.find((t) => t[0] === row.k)?.[2] || 't';
                    return (
                      <td key={V.j} className={`${cls} ${miss ? 'qt-miss' : ''}`}>
                        {row.ty === 'calc' ? (
                          <b>{V.t.__lf == null ? '—' : `${V.t.__lf.toFixed(2)}%`}</b>
                        ) : (
                          <FieldControl
                            path={`vendors.${V.j}.qterms.${row.k}`}
                            value={d.vendors[V.j]?.qterms?.[row.k]}
                            type={ty === 'p' ? 'n' : ty}
                            ver={ver}
                            role={role}
                            onChange={onChangeField}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="qt-as">
                    {row.ev.best.length && !row.ev.equal ? (
                      <div className="ok">
                        <b>
                          Best:{' '}
                          {row.ev.best
                            .map((j) => M.vend.find((V) => V.j === j)?.name || '')
                            .join(', ')}
                        </b>
                      </div>
                    ) : null}
                    {row.ev.diff ? <b className="qt-it">Differs </b> : null}
                    <small>
                      {row.ev.equal && !row.ev.diff
                        ? M.vend.some((V) => qtHas(V.t[row.k]))
                          ? 'Equal for all vendors'
                          : ''
                        : row.ev.note || ''}
                    </small>
                    {flags.length ? (
                      <div className="qt-fl text-[11px]">⚠ Review: {flags.join(', ')}</div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="qt-det" open={hi.length > 0}>
        <summary>
          <AlertTriangle size={15} /> Negotiation points ({P.length}) – also in the Excel with space
          to record the agreed outcome
        </summary>
        <ol className="qt-pts">
          {P.slice(0, 40).map((p, idx) => (
            <li key={idx}>
              <b>{p.v}</b> · {p.topic} — {p.cur} <span className="note">(best: {p.best})</span> →{' '}
              <i>{p.ask}</i> <span className={`p-${p.pri}`}>{p.pri}</span>
            </li>
          ))}
        </ol>
      </details>

      <details className="qt-det">
        <summary>
          <LayoutGrid size={15} /> How the commercial score is calculated
        </summary>
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Weight</th>
              {M.vend.map((V) => (
                <th key={V.j}>{V.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {M.scores.map((s) => (
              <tr key={s.key}>
                <td className="l">{s.lab}</td>
                <td className="n">{s.w}</td>
                {s.pts.map((p, k) => (
                  <td key={k} className="n">
                    {p.toFixed(1)}{' '}
                    <small className="note">
                      ({s.vals[k] == null ? '—' : s.key === 'price' ? s.vals[k]!.toFixed(3) : s.vals[k]})
                    </small>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="l">
                <b>Total</b>
              </td>
              <td className="n">100</td>
              {M.vend.map((V) => (
                <td key={V.j} className="n">
                  <b>{V.score.toFixed(1)}</b>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="note">
          Price uses landed value with quoted loadings, compared on the items each vendor quoted.
          Weights can be changed in the Excel Scoring sheet.
        </p>
      </details>

      <StageSubmitBar
        stage="qtc"
        label="Quoted Terms"
        ownerRole="Buyer"
        ver={ver}
        currentRole={role}
        onSubmit={onSubmitStage}
      />
    </>
  );
};
