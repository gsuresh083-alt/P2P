import React, { useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import type { CalcResult, DoaBand, NfaRecord, NfaVersion, RoleName, TabId } from '../../types/enfa.ts';
import { TERMS } from '../../utils/enfaConstants.ts';
import {
  bandOf,
  checks,
  fmt,
  fmtD,
  num,
  pct,
  route,
  submitBlockers,
} from '../../utils/enfaEngine.ts';
import { FieldControl, LockBanner } from './FieldControl.tsx';
import { LppTable } from './LppTable.tsx';

export const ApprovalMatrix: React.FC<{
  ver: NfaVersion;
  c: CalcResult;
  full?: boolean;
}> = ({ ver, c, full = false }) => {
  const rows = ver.approvals.length
    ? ver.approvals
    : full
    ? []
    : route(c).map((x) => ({
        ...x,
        action: '' as const,
        name: '',
        date: '',
        comment: '',
      }));

  if (!rows.length) return null;

  return (
    <div className="nfa-sign-wrap">
      <h3>{full ? 'Approval log' : '6. Approval & sign-off'}</h3>
      {!ver.approvals.length && !full ? (
        <p className="note screen-only">
          Approval route preview per DoA band ({c.band.final}) – confirmed at submission.
        </p>
      ) : null}
      <table className="nfa-sign">
        <thead>
          <tr>
            <th style={{ width: 42 }}>Level</th>
            <th>Role</th>
            <th>Name &amp; Designation</th>
            <th style={{ width: 90 }}>Decision</th>
            <th style={{ width: 105 }}>Date / Time</th>
            <th>Comments</th>
            <th style={{ width: 120 }}>Signature</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="lv">L0</td>
            <td className="l">Prepared By (Buyer)</td>
            <td>{ver.data.header.buyer || ''}</td>
            <td>{ver.submittedOn ? 'Submitted' : ''}</td>
            <td>{fmtD(ver.submittedOn)}</td>
            <td />
            <td className="sigcell">
              {ver.submittedOn ? <span className="ok">e-submitted ✓</span> : ''}
            </td>
          </tr>
          {rows.map((a, idx) => (
            <tr key={idx}>
              <td className="lv">{a.lv}</td>
              <td className="l">{a.role}</td>
              <td>{a.name || ''}</td>
              <td
                className={
                  a.action === 'Approve'
                    ? 'ok'
                    : a.action && a.action !== 'Pending'
                    ? 'bad'
                    : ''
                }
              >
                {a.action === 'Pending' ? 'Pending' : a.action || ''}
              </td>
              <td>{fmtD(a.date)}</td>
              <td>{a.comment || ''}</td>
              <td className="sigcell">
                {a.action === 'Approve' ? (
                  <span className="ok">e-approved ✓</span>
                ) : a.action && a.action !== 'Pending' ? (
                  <span className="bad">{a.action}</span>
                ) : (
                  ''
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const NfaDocumentView: React.FC<{
  nfa: NfaRecord;
  ver: NfaVersion;
  c: CalcResult;
  role: RoleName;
  doa: DoaBand[];
  onChangeField: (path: string, val: string | number) => void;
  onGoTab: (tab: TabId) => void;
  onSubmitForApproval: () => Promise<boolean>;
  onOpenPrint: () => void;
}> = ({
  nfa,
  ver,
  c,
  role,
  doa,
  onChangeField,
  onGoTab,
  onSubmitForApproval,
  onOpenPrint,
}) => {
  const d = ver.data;
  const h = d.header;
  const cu = h.cur || 'INR';
  const ck = checks(d, c);
  const ready = ck.every((x) => x[1]);
  const editable = ver.status === 'Draft' && role === 'Buyer';
  const blockers = submitBlockers(ver, role, doa);
  const awV = c.split
    .filter((s) => s.val > 0)
    .map((s) => s.name)
    .join(', ');

  const subBlockRef = useRef<HTMLDivElement>(null);
  const declRef = useRef<HTMLTableElement>(null);
  const [flashBlock, setFlashBlock] = useState(false);

  const wasT = (j: number, k: string) => {
    const v = d.vendors[j];
    if (!v?.qterms) return null;
    const a = String(v.qterms[k] ?? '').trim();
    const b = String(v.terms[k] ?? '').trim();
    if (!a || a === b) return null;
    const isPct = TERMS.find((t) => t[0] === k)?.[2] === 'p';
    return (
      <>
        <br />
        <small className="was">
          quoted: {a}
          {isPct ? '%' : ''}
        </small>
      </>
    );
  };

  const handleSubmitClick = async () => {
    const ok = await onSubmitForApproval();
    if (!ok && subBlockRef.current) {
      subBlockRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashBlock(true);
      setTimeout(() => setFlashBlock(false), 1600);
    }
  };

  const scrollToDecl = () => {
    declRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      <LockBanner ver={ver} />
      <div className="nfa-document">
        <div className="nfa-hero">
          <div className="nfa-hero-main">
            <div className="nfa-brandline">AFRZEN · SUPPLY CHAIN MANAGEMENT</div>
            <div className="nfa-hero-title">NOTE FOR APPROVAL</div>
            <div className="nfa-hero-sub">
              Purchase proposal · Commercial evaluation and award recommendation
            </div>
            <div className="mt-2.5">
              <span className="nfa-status-chip">{ver.status.toUpperCase()}</span>
            </div>
          </div>
          <div className="nfa-hero-meta">
            <div className="nfa-meta-chip">
              <span>NFA Reference</span>
              <b>{nfa.no}</b>
            </div>
            <div className="nfa-meta-chip">
              <span>Version</span>
              <b>{ver.ver}</b>
            </div>
            <div className="nfa-meta-chip">
              <span>Company</span>
              <b>{h.company || '—'}</b>
            </div>
            <div className="nfa-meta-chip">
              <span>Prepared Date</span>
              <b>{(ver.createdOn || '').slice(0, 10) || '—'}</b>
            </div>
          </div>
          <button type="button" className="btn w noprint" onClick={onOpenPrint}>
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>

        {ver.status !== 'Draft' ? (
          <p className="note screen-only">
            Submitted NFA record — read-only during approval. The approval screen also displays the
            award decision snapshot.
          </p>
        ) : null}

        <table>
          <tbody>
            <tr>
              <td className="l">Company / Plant</td>
              <td>
                {h.company} / {h.plant || '—'}
              </td>
              <td className="l">PR No / Date</td>
              <td>
                {h.prNo || '—'} / {h.prDate || '—'}
              </td>
            </tr>
            <tr>
              <td className="l">Budget / Code</td>
              <td>
                {h.budget} / {h.budgetCode || '—'}
              </td>
              <td className="l">Required By</td>
              <td>{h.needBy || '—'}</td>
            </tr>
            <tr>
              <td className="l">Category / Route</td>
              <td>
                {h.cat} / <b>{h.route}</b>
              </td>
              <td className="l">RFQ No / Date</td>
              <td>
                {h.rfqNo || '—'} / {h.rfqDate || '—'}
              </td>
            </tr>
          </tbody>
        </table>

        <h3 className={d.items.some((it) => it.erpSource) ? '' : 'print-hide'}>
          Source PR allocation register
        </h3>
        {d.items.some((it) => it.erpSource) ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>RFQ Item</th>
                  <th>Source PR / Line</th>
                  <th>Plant</th>
                  <th>Allocated Qty</th>
                  <th>Source Document Revision(s)</th>
                </tr>
              </thead>
              <tbody>
                {d.items
                  .filter((it) => it.erpSource)
                  .map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        {it.code} · {it.desc}
                      </td>
                      <td>
                        {it.erpSource!.prNumber} / {it.erpSource!.prLineNumber}
                      </td>
                      <td>{it.erpSource!.plantName || it.erpSource!.plantCode}</td>
                      <td className="n">
                        {fmt(it.qty, 3, cu)} {it.uom}
                      </td>
                      <td>
                        {(it.erpSource!.documents || [])
                          .map((x) => `${x.documentName} — ${x.documentRevision || 'n/a'}`)
                          .join('; ') || 'No document linked'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note print-hide">No ERP PR line allocation is attached to this record.</p>
        )}

        <h3>Procurement snapshot</h3>
        <div className="kpis">
          <div className="kpi">
            <span>Order value (landed, excl. tax)</span>
            <b>
              {cu} {fmt(c.total, 0, cu)}
            </b>
          </div>
          <div className="kpi s">
            <span>Negotiation saving</span>
            <b>
              {fmt(c.sav, 0, cu)} · {pct(c.savPct)}
            </b>
          </div>
          <div className="kpi">
            <span>Vendors contacted / quoted / tech OK</span>
            <b>
              {h.contacted || '—'} / {c.quoted} / {c.tokCount}
            </b>
          </div>
          <div className="kpi">
            <span>vs LPP on total qty (basic) / vs Estimate</span>
            <b>
              {c.lppSum.pct == null
                ? 'No LPP'
                : `${c.lppSum.pct > 0 ? '▲ +' : '▼ '}${(c.lppSum.pct * 100).toFixed(1)}% (${
                    c.lppSum.impact > 0 ? '+' : ''
                  }${fmt(c.lppSum.impact, 0, cu)})`}{' '}
              / {num(h.estimate) != null ? fmt(c.total - Number(h.estimate), 0, cu) : '—'}
            </b>
          </div>
        </div>

        <div className="rec">
          <b>RECOMMENDATION:</b>{' '}
          {c.total ? (
            <>
              Award on <b>item-wise Buyer-selected ranked vendor basis</b> to {awV} for a total
              landed value of{' '}
              <b>
                {cu} {fmt(c.total, 0, cu)}
              </b>{' '}
              (excl. tax), with negotiated saving of {cu} {fmt(c.sav, 0, cu)} ({pct(c.savPct)}).
              Final approving authority: <b>{bandOf(ver, c).final}</b>.
              {c.lppSum.items ? (
                <>
                  {' '}
                  Versus last purchase price, the basic value for the quantities in this NFA is{' '}
                  <b>
                    {c.lppSum.impact > 0 ? '▲ higher' : '▼ lower'} by {cu}{' '}
                    {fmt(Math.abs(c.lppSum.impact), 0, cu)} (
                    {(c.lppSum.pct || 0) > 0 ? '+' : ''}
                    {((c.lppSum.pct || 0) * 100).toFixed(1)}%)
                  </b>{' '}
                  across {c.lppSum.items} item(s).
                </>
              ) : null}
            </>
          ) : (
            'Enter quotes to generate.'
          )}
        </div>

        <h3>1. Buyer award selection &amp; approval rationale</h3>
        <table>
          <tbody>
            <tr>
              <td className="l">Award Basis *</td>
              <td>
                <b>
                  Item-wise L1 by default; Buyer may select another eligible ranked vendor with
                  documented justification
                </b>
              </td>
              <td className="l">Package L1 (CS)</td>
              <td>{c.pkgJ == null ? 'No complete package' : d.vendors[c.pkgJ]?.name}</td>
            </tr>
            <tr>
              <td className="l">Requirement &amp; Justification</td>
              <td colSpan={3}>
                {h.desc}
                {h.just ? ` — ${h.just}` : ''}
              </td>
            </tr>
            <tr>
              <td className="l">Selection Rationale *</td>
              <td colSpan={3}>
                <FieldControl
                  path="nfa.rationale"
                  value={d.nfa.rationale}
                  type="a"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr className={String(d.nfa.nonL1 || '').trim() ? '' : 'print-hide'}>
              <td className="l">Overall justification for Non-L1 selection / Single Source</td>
              <td colSpan={3}>
                <FieldControl
                  path="nfa.nonL1"
                  value={d.nfa.nonL1}
                  type="a"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr className={String(d.nfa.lppJust || '').trim() ? '' : 'print-hide'}>
              <td className="l">Overall LPP Remarks (item-wise justification in 2A)</td>
              <td colSpan={3}>
                <FieldControl
                  path="nfa.lppJust"
                  value={d.nfa.lppJust}
                  type="a"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr className={String(d.nfa.special || '').trim() ? '' : 'print-hide'}>
              <td className="l">Special Conditions for PO</td>
              <td colSpan={3}>
                <FieldControl
                  path="nfa.special"
                  value={d.nfa.special}
                  type="a"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr className={String(d.nfa.remarks || '').trim() ? '' : 'print-hide'}>
              <td className="l">Buyer Remarks</td>
              <td colSpan={3}>
                <FieldControl
                  path="nfa.remarks"
                  value={d.nfa.remarks}
                  type="a"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="nfa-award-section">
          <h3>2. Item-wise Buyer vendor selection</h3>
          <p className="note screen-only">
            L1 is selected automatically by default. The Buyer may select L2 or another eligible
            ranked vendor for an item where commercially or operationally justified. The selection
            is carried forward from the Comparative Statement and requires an item-level reason
            whenever a non-L1 vendor is selected or a tied landed-cost result is resolved. Only
            technically accepted vendors with valid negotiated landed prices are selectable.
          </p>
          {d.nfa.award === 'Non-L1 (Justified)' ? (
            <p className="note">
              <b>Non-L1 basis:</b> select L1 or L2 for every item and enter the reason for each L2
              selection; the justification above is mandatory.
            </p>
          ) : null}
          {c.aw.some((a) => a.tieOpen) ? (
            <p className="note bad">
              Some items have equal L1 landed prices – confirm the selected L1 / L2 vendor and
              record the reason.
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Code</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>CS L1 Vendor</th>
                  <th>CS L2 Vendor</th>
                  <th>Buyer-selected Ranked Vendor</th>
                  <th>Buyer Selection Justification</th>
                  <th>Awarded Vendor</th>
                  <th>CS L1 Landed ({cu})</th>
                  <th>Awarded Landed ({cu})</th>
                  <th>Quoted (basic, {cu})</th>
                  <th>Neg. Saving (base)</th>
                  <th>Var. vs L1 (base)</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r, i) => {
                  const a = c.aw[i];
                  const ov = d.nfa.ov?.[String(i)];
                  const selVal =
                    ov !== undefined && ov !== ''
                      ? String(ov)
                      : r.tie
                      ? ''
                      : r.l1j != null
                      ? String(r.l1j)
                      : '';
                  const needReason = (a.nonL1 || r.tie) && !(d.nfa.ovr?.[String(i)] || '').trim();
                  return (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{r.it.code}</td>
                      <td>{r.it.desc}</td>
                      <td className="n">{fmt(r.qty, 2, cu)}</td>
                      <td>{r.l1j == null ? '—' : d.vendors[r.l1j]?.name}</td>
                      <td>{r.l2j == null ? '—' : d.vendors[r.l2j]?.name}</td>
                      <td style={{ minWidth: 230 }}>
                        <select
                          data-p={`nfa.ov.${i}`}
                          disabled={!editable}
                          value={selVal}
                          onChange={(e) => onChangeField(`nfa.ov.${i}`, e.target.value)}
                        >
                          {r.tie && (ov === undefined || ov === '') ? (
                            <option value="">— Choose tie-break vendor —</option>
                          ) : null}
                          {r.ranked.map((x) => (
                            <option key={x.j} value={String(x.j)}>
                              L{x.rank} — {d.vendors[x.j]?.name} ({cu} {fmt(x.landed, 0, cu)})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        style={{
                          minWidth: 170,
                          outline: needReason ? '2px solid #b42318' : undefined,
                        }}
                      >
                        <FieldControl
                          path={`nfa.ovr.${i}`}
                          value={d.nfa.ovr?.[String(i)] || ''}
                          type="t"
                          placeholder={a.nonL1 || r.tie ? 'Mandatory for non-L1 / tie' : ''}
                          ver={ver}
                          role={role}
                          onChange={onChangeField}
                        />
                      </td>
                      <td className="g">
                        {a.tieOpen
                          ? 'Selection pending'
                          : a.j == null
                          ? '—'
                          : d.vendors[a.j]?.name}
                      </td>
                      <td className="n">{fmt(r.l1v, 0, cu)}</td>
                      <td className="n">
                        <b>{a.tieOpen ? 'Pending tie-break' : fmt(a.landed, 0, cu)}</b>
                      </td>
                      <td className="n">{fmt(a.q, 0, cu)}</td>
                      <td className="n ok">{fmt(a.sav, 0, cu)}</td>
                      <td className={`n ${(a.varL1 || 0) > 0 ? 'bad' : ''}`}>
                        {fmt(a.varL1, 0, cu)}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={9} className="l">
                    TOTAL
                  </td>
                  <td className="n">
                    {fmt(
                      c.rows.reduce((s, r) => s + (r.l1v || 0), 0),
                      0,
                      cu
                    )}
                  </td>
                  <td className="n g">{fmt(c.total, 0, cu)}</td>
                  <td className="n">{fmt(c.qt, 0, cu)}</td>
                  <td className="n ok">{fmt(c.sav, 0, cu)}</td>
                  <td className="n">
                    {fmt(
                      c.aw.reduce((s, a) => s + (a.varL1 || 0), 0),
                      0,
                      cu
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3>2A. Item-wise LPP comparison (basic rate)</h3>
        <p className="note screen-only">
          Carried from the Comparative Statement. Basis: basic rate only — awarded negotiated basic
          rate per UOM vs last purchase basic rate per UOM, in {cu}; GST, freight, P&amp;F,
          insurance and other loadings excluded.
        </p>
        <LppTable ver={ver} c={c} role={role} editable={false} onChangeField={onChangeField} />

        <div className="nfa-split">
          <h3>3. Vendor-wise PO split &amp; commercial terms (negotiated; quoted shown where changed)</h3>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Quote Cur. / FX</th>
                  <th>Award Value (base)</th>
                  <th>Share</th>
                  <th>Status</th>
                  <th>Price Basis</th>
                  <th>Payment Terms</th>
                  <th>Delivery</th>
                  <th>Freight</th>
                  <th>Warranty</th>
                  <th>PBG / LD</th>
                  <th>GST %</th>
                  <th>Validity (d)</th>
                </tr>
              </thead>
              <tbody>
                {c.split.map((s) => {
                  const t = d.vendors[s.j].terms;
                  return (
                    <tr
                      key={s.j}
                      className={s.val > 0 ? '' : 'print-hide'}
                      style={s.val > 0 ? { background: 'var(--t-ok-bg)' } : undefined}
                    >
                      <td className="l">{s.name}</td>
                      <td>
                        {t.cur || cu}
                        {(t.cur || cu) !== cu ? (
                          <>
                            {' '}
                            @ {fmt(t.fxRate, 4, cu)}
                            <br />
                            <small>
                              {t.fxDate || ''} · {t.fxSource || ''}
                            </small>
                          </>
                        ) : null}
                      </td>
                      <td className="n">
                        <b>{fmt(s.val, 0, cu)}</b>
                      </td>
                      <td className="n">{pct(s.share)}</td>
                      <td>{s.val > 0 ? 'Awarded' : 'Not awarded'}</td>
                      <td>
                        {t.basis}
                        {wasT(s.j, 'basis')}
                      </td>
                      <td>
                        {t.pay}
                        {wasT(s.j, 'pay')}
                      </td>
                      <td>
                        {t.delTxt}
                        {wasT(s.j, 'delTxt')}
                      </td>
                      <td>
                        {t.freight}
                        {wasT(s.j, 'freight')}
                      </td>
                      <td>
                        {t.warr}
                        {wasT(s.j, 'warr')}
                      </td>
                      <td>
                        {t.pbg || '—'}% / {t.ld || '—'}
                      </td>
                      <td className="n">{t.gst}</td>
                      <td className="n">{t.valid}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {c.split.some((s) => !(s.val > 0) && s.name) ? (
            <p className="note print-block">
              Also evaluated (not awarded):{' '}
              {c.split
                .filter((s) => !(s.val > 0) && s.name)
                .map((s) => s.name)
                .join(', ')}{' '}
              — full comparison in the Comparative Statement.
            </p>
          ) : null}
        </div>

        <div className="nfa-check-section">
          <h3>4. Pre-submission checks</h3>
          <div className="nfa-check-grid">
            {ck.map((x, i) => (
              <div key={i} className={`nfa-check-item ${x[1] ? 'pass' : 'fail'}`}>
                <div className="nfa-check-head">
                  <span className="nfa-check-no">{i + 1}</span>
                  <span className="nfa-check-label">{x[0]}</span>
                  <span className="nfa-check-status">{x[1] ? '✓ PASS' : '✕ ACTION'}</span>
                </div>
                {!x[1] ? <p className="nfa-check-detail">{x[2]}</p> : null}
              </div>
            ))}
          </div>
          <div className={`nfa-readiness ${ready ? '' : 'not-ready'}`}>
            <div>
              <span>SUBMISSION READINESS</span>
              <strong>{ready ? 'READY TO SUBMIT' : 'SUBMISSION BLOCKED'}</strong>
            </div>
            <b>
              {ready ? 'All checks passed' : `${ck.filter((x) => !x[1]).length} check(s) require action`}
            </b>
          </div>
          <div className="nfa-check-compact">
            <b>
              System validation: {ck.filter((x) => x[1]).length} of {ck.length} checks passed
              {ready ? ' — ready for approval' : ` — ${ck.filter((x) => !x[1]).length} open`}.
            </b>{' '}
            {ck.map((x, i) => (
              <span key={i} className={`ck ${x[1] ? '' : 'f'}`}>
                {x[1] ? '✓' : '✕'} {x[0]}
                {x[1] ? '' : ` (${x[2]})`}{' '}
              </span>
            ))}
          </div>
        </div>

        <h3>5. Buyer declaration</h3>
        <table ref={declRef} className="nfa-decl">
          <tbody>
            <tr>
              <td className="l" style={{ width: 120 }}>
                Confirm *
              </td>
              <td style={{ width: 100 }} className={d.nfa.decl === 'Yes' ? '' : 'decl-need'}>
                <FieldControl
                  path="nfa.decl"
                  value={d.nfa.decl}
                  type="s:yn"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
              <td>
                I confirm the CS is complete, all quotations / negotiation records are on file,
                terms are as agreed with vendors and there is no conflict of interest.
              </td>
            </tr>
          </tbody>
        </table>

        <ApprovalMatrix ver={ver} c={c} />

        {ver.status === 'Draft' ? (
          <div className="noprint sub-zone">
            {!blockers.length ? (
              <div className="sub-ready">
                ✓ All stages submitted and all {ck.length} checks passed — ready to submit for
                approval.
              </div>
            ) : (
              <div
                ref={subBlockRef}
                id="subBlock"
                className={`sub-block ${flashBlock ? 'ring-2 ring-red-400' : ''}`}
              >
                <b>✕ Submission blocked — {blockers.length} item(s) to fix:</b>
                <ol>
                  {blockers.map((x, idx) => (
                    <li key={idx}>
                      {x.t}
                      {x.tab && x.tab !== 'nfa' ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="fix-link"
                            onClick={() => onGoTab(x.tab!)}
                          >
                            Fix in {x.label} →
                          </button>
                        </>
                      ) : x.tab === 'nfa' ? (
                        <>
                          {' '}
                          <button type="button" className="fix-link" onClick={scrollToDecl}>
                            Fix above ↑
                          </button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className={`btn g sub-btn ${blockers.length ? 'is-blocked' : ''}`}
                onClick={handleSubmitClick}
              >
                Submit for Approval ➜
              </button>
              <button type="button" className="btn w" onClick={onOpenPrint}>
                <Printer size={14} /> Print / Save PDF
              </button>
            </div>
            {blockers.length ? (
              <span className="note">Click to see what is still required.</span>
            ) : null}
          </div>
        ) : null}

        <p className="note">
          System-generated NFA. Valid only when status = APPROVED · LOCKED. Any change after approval
          requires a new version and fresh approval.
        </p>
        <div className="nfa-footer">
          <span>AFRZEN · CONFIDENTIAL PROCUREMENT DOCUMENT</span>
          <span>
            {nfa.no} · {ver.ver} · {ver.status}
          </span>
          <span>Generated from e-NFA</span>
        </div>
      </div>
    </>
  );
};
