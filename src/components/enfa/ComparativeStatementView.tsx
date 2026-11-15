import React from 'react';
import { Activity, BarChart3, TrendingUp } from 'lucide-react';
import type { CalcResult, DoaBand, NfaVersion, RoleName, StageId } from '../../types/enfa.ts';
import { fmt, isOkForLine, num, pct } from '../../utils/enfaEngine.ts';
import { LandedVarianceBarChart, LppImpactChart, VendorComparisonChart } from './Charts.tsx';
import { LockBanner, StageSubmitBar } from './FieldControl.tsx';
import { LppTable } from './LppTable.tsx';
import { QuotedVsNegotiatedPanel, QuotedVsNegotiatedTableRO } from './NegotiationView.tsx';

export const ComparativeStatementView: React.FC<{
  ver: NfaVersion;
  c: CalcResult;
  role: RoleName;
  doa: DoaBand[];
  onChangeField: (path: string, val: string | number) => void;
  onDownloadExcel: (mode: 'pre' | 'post') => void;
  onSubmitStage: (stage: StageId) => void;
}> = ({ ver, c, role, doa, onChangeField, onDownloadExcel, onSubmitStage }) => {
  const d = ver.data;
  const cu = d.header.cur || 'INR';
  const editable = ver.status === 'Draft' && role === 'Buyer';

  return (
    <>
      <LockBanner ver={ver} />
      <h2>
        <BarChart3 size={18} /> 5. Comparative Statement — System Ranking &amp; Buyer Award Selection
      </h2>

      <div className="cs-viz screen-only">
        <section className="ch-card">
          <div className="ch-h">
            <BarChart3 size={16} className="text-[var(--t-acc)]" />
            <b>Total landed value by vendor</b>
            <small>Striped = vendor has not quoted / been accepted on every item</small>
          </div>
          <VendorComparisonChart c={c} />
        </section>
        <section className="ch-card">
          <div className="ch-h">
            <Activity size={16} className="text-[var(--t-acc)]" />
            <b>Impact vs LPP</b>
            <small>Per item, on total quantity</small>
          </div>
          <LppImpactChart c={c} />
        </section>
      </div>

      <section className="ch-card screen-only mb-3">
        <div className="ch-h">
          <BarChart3 size={16} className="text-[var(--t-acc)]" />
          <b>Item-wise landed cost variance across vendors</b>
          <small>
            Compares each vendor&apos;s landed value against the item&apos;s L1 baseline to flag
            high-cost outlier bids (crimson outline marks quotes at or above threshold)
          </small>
        </div>
        <LandedVarianceBarChart c={c} vendors={d.vendors} />
      </section>

      <p className="note">
        CS Ref: CS/{d.header.rfqNo || '<RFQ>'}/{ver.ver} · Landed = Qty × Negotiated × (1 + Landing
        factor) × FX, excl. tax · All comparison values in {cu} (NFA base currency); FX is entered
        manually. The system ranks technically accepted vendors with valid negotiated landed prices.
        Buyer selects the recommended award vendor item-wise below; L1 is the default. If L2 or
        another ranked vendor is selected, enter the item-level business justification in the
        adjacent field before submitting the CS.
      </p>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item Code</th>
              <th>Source PR(s)</th>
              <th>Description</th>
              <th>Qty</th>
              {d.vendors.map((v, j) => (
                <th key={j} className="dk">
                  {v.name} · {c.cur[j]}
                  <br />
                  <small>
                    FX {fmt(c.fx[j], 4, cu)} · LF {(c.lf[j] * 100).toFixed(1)}%
                  </small>
                </th>
              ))}
              <th>L1 Landed</th>
              <th>L1 Vendor</th>
              <th>L2 Landed</th>
              <th>L2 Vendor</th>
              <th>L2 vs L1</th>
              <th>Buyer Award Selection</th>
              <th>Buyer Selection Justification (mandatory for non-L1 / tie)</th>
              <th>Selected Landed</th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => {
              const a = c.aw[i];
              const ov = d.nfa.ov?.[String(i)];
              const selected =
                ov !== undefined && ov !== ''
                  ? String(ov)
                  : r.tie
                  ? ''
                  : r.l1j != null
                  ? String(r.l1j)
                  : '';
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{r.it.code}</td>
                  <td>
                    {r.it.erpSource
                      ? `${r.it.erpSource.prNumber} / ${r.it.erpSource.prLineNumber}`
                      : 'Manual'}
                  </td>
                  <td>{r.it.desc}</td>
                  <td className="n">{fmt(r.qty, 2, cu)}</td>
                  {r.landed.map((x, j) => {
                    const cell = r.it.r[j];
                    const regReason = cell?.regretReason;
                    return (
                      <td
                        key={j}
                        className={`n ${j === r.l1j ? 'g' : ''}`}
                        title={cell?.regret ? regReason || 'Vendor regretted this item' : undefined}
                      >
                        {x == null
                          ? cell?.regret
                            ? 'Regret'
                            : !isOkForLine(d, d.vendors[j], i)
                            ? 'Tech ✕'
                            : c.fx[j] == null
                            ? 'FX ✕'
                            : num(cell?.q) == null
                            ? 'NQ'
                            : 'Neg pending'
                          : fmt(x, 0, cu)}
                      </td>
                    );
                  })}
                  <td className="n g">{fmt(r.l1v, 0, cu)}</td>
                  <td className="g">{r.l1j == null ? '—' : d.vendors[r.l1j]?.name}</td>
                  <td className="n">{fmt(r.l2v, 0, cu)}</td>
                  <td>{r.l2j == null ? '—' : d.vendors[r.l2j]?.name}</td>
                  <td className="n">{pct(r.gap)}</td>
                  <td style={{ minWidth: 230 }}>
                    <select
                      data-p={`nfa.ov.${i}`}
                      disabled={!editable}
                      value={selected}
                      onChange={(e) => onChangeField(`nfa.ov.${i}`, e.target.value)}
                    >
                      {r.tie ? <option value="">— Choose tie-break vendor —</option> : null}
                      {r.ranked.map((x) => (
                        <option key={x.j} value={String(x.j)}>
                          L{x.rank} — {d.vendors[x.j]?.name} ({cu} {fmt(x.landed, 0, cu)})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ minWidth: 220 }}>
                    <input
                      type="text"
                      data-p={`nfa.ovr.${i}`}
                      disabled={!editable}
                      value={d.nfa.ovr?.[String(i)] || ''}
                      placeholder={
                        a.nonL1 || r.tie
                          ? 'Required: explain vendor choice'
                          : 'Enter if selecting non-L1'
                      }
                      onChange={(e) => onChangeField(`nfa.ovr.${i}`, e.target.value)}
                    />
                  </td>
                  <td className="n">
                    <b>{a.tieOpen ? 'Pending tie-break' : fmt(a.landed, 0, cu)}</b>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={5 + d.vendors.length + 7} className="l">
                TOTAL AWARD VALUE
              </td>
              <td className="n g">{fmt(c.total, 0, cu)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Item-wise LPP comparison — basic rate only</h3>
      <p className="note">
        Enter LPP basic rate / UOM in {cu} (excl. GST, freight, P&amp;F, insurance, other loadings),
        PO ref and vendor, or select <i>First purchase</i>. Compared with the awarded vendor’s
        negotiated basic rate (quotation FX applied, landing not applied). Red cells must be
        completed before the CS can be submitted; ⚠ = variance above 50%, verify basis.
      </p>
      <LppTable ver={ver} c={c} role={role} editable onChangeField={onChangeField} />

      <h3>Vendor-wise package summary</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Items quoted (tech OK)</th>
              <th>Total quoted ({c.base})</th>
              <th>Total negotiated ({c.base})</th>
              <th>Total landed ({c.base})</th>
              <th>Complete package?</th>
              <th>Package rank</th>
              <th>Neg. saving</th>
              <th>Saving %</th>
            </tr>
          </thead>
          <tbody>
            {c.vs.map((x, idx) => (
              <tr key={idx}>
                <td className="l">
                  {x.name} ({x.currency} → {c.base})
                </td>
                <td className="n">
                  {x.cnt} / {d.items.length}
                </td>
                <td className="n">{fmt(x.q, 0, cu)}</td>
                <td className="n">{fmt(x.n, 0, cu)}</td>
                <td className="n">
                  <b>{fmt(x.l, 0, cu)}</b>
                </td>
                <td>{x.complete ? 'Yes' : 'No'}</td>
                <td className={`n ${x.rank === 1 ? 'g' : ''}`}>
                  {x.rank ? `L${x.rank}` : 'n/a'}
                </td>
                <td className="n ok">{fmt(x.qb - x.nb, 0, cu)}</td>
                <td className="n">{pct(x.qb ? (x.qb - x.nb) / x.qb : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Package L1 vendor:{' '}
        <b>
          {c.pkgJ == null
            ? 'No complete package'
            : `${d.vendors[c.pkgJ].name} — ${cu} ${fmt(c.vs[c.pkgJ].l, 0, cu)}`}
        </b>{' '}
        · NQ = not quoted · Neg pending = accepted but final price not entered · Tech ✕ = not
        technically accepted · FX ✕ = FX rate missing
      </p>
      <p className="note">
        Buyer decision: select the recommended vendor for every item. L1 is preselected; L2 or
        another eligible ranked vendor can be selected where justified, with a mandatory item-level
        reason. The same selection flows into the NFA, vendor-wise PO split and award value. Any
        change after CS submission reopens this stage.
      </p>

      <details className="qt-det screen-only">
        <summary>
          <TrendingUp size={15} /> Negotiation outcome — quoted vs negotiated prices &amp; terms
        </summary>
        <QuotedVsNegotiatedPanel d={d} doa={doa} withBtn onDownloadExcel={onDownloadExcel} />
        <QuotedVsNegotiatedTableRO d={d} doa={doa} />
      </details>

      <StageSubmitBar
        stage="cs"
        label="Comparative Statement"
        ownerRole="Buyer"
        ver={ver}
        currentRole={role}
        onSubmit={onSubmitStage}
      />
    </>
  );
};
