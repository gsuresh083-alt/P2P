import React from 'react';
import type { AwardRow, CalcResult, NfaVersion, RoleName } from '../../types/enfa.ts';
import { LPP_J_MIN } from '../../utils/enfaConstants.ts';
import { canEditPath, fmt } from '../../utils/enfaEngine.ts';

export const LppBadge: React.FC<{ lppNo?: boolean; lppPct: number | null }> = ({
  lppNo,
  lppPct,
}) => {
  if (lppNo) return <span className="lpp-badge eq">First purchase</span>;
  if (lppPct == null) return <span className="lpp-na">—</span>;
  const p = lppPct * 100;
  const cls = p > 0.005 ? 'up' : p < -0.005 ? 'dn' : 'eq';
  return (
    <span className={`lpp-badge ${cls}`}>
      {cls === 'up' ? '▲ +' : cls === 'dn' ? '▼ ' : ''}
      {p.toFixed(1)}%
    </span>
  );
};

export const LppTable: React.FC<{
  ver: NfaVersion;
  c: CalcResult;
  role: RoleName;
  editable: boolean;
  onChangeField: (path: string, val: string | number) => void;
}> = ({ ver, c, role, editable, onChangeField }) => {
  const d = ver.data;
  const cu = d.header.cur || 'INR';
  const ls = c.lppSum;
  const n = c.aw.length;
  const okN = c.aw.filter((a) => a.lppOk).length;
  const warnN = c.aw.filter((a) => a.lppWarn.length > 0).length;
  const dis = !editable || !canEditPath(ver, role, 'items.0.lpp.rate');
  const issues = c.aw.map((a, i) => ({ a, i })).filter((x) => !x.a.lppOk);

  const sg = (v: number | null) =>
    v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v, 0, cu)}`;
  const cl = (v: number | null) => ((v || 0) > 0 ? 'lpp-up' : (v || 0) < 0 ? 'lpp-dn' : '');
  const ex = c.aw.map((a, i) => ({ a, i })).filter((x) => x.a.lppVar == null);
  const exVal = ex.reduce((t, x) => t + (x.a.n || 0), 0);

  return (
    <>
      {editable ? (
        <div className={`lpp-val ${issues.length ? 'bad' : 'ok'}`}>
          <b>
            {issues.length
              ? `✕ LPP validation: ${issues.length} of ${n} item(s) need action`
              : `✓ LPP validation passed — ${okN}/${n} items complete`}
          </b>
          {warnN ? <span className="lpp-w"> ⚠ {warnN} warning(s)</span> : null}
          {issues.length ? (
            <ul>
              {issues.map((x) => (
                <li key={x.i}>
                  <b>Item {x.i + 1}</b>
                  {x.a.lppUp && x.a.lppPct != null ? (
                    <>
                      {' '}
                      <span className="lpp-badge up">▲ +{(x.a.lppPct * 100).toFixed(1)}%</span>
                    </>
                  ) : null}{' '}
                  — {x.a.lppIssues.join(' · ')}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="lpp-wrap">
        <table className="lpp-c">
          <colgroup>
            <col style={{ width: 22 }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: 62 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: 86 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 88 }} />
            <col />
            <col style={{ width: 34 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="grp" colSpan={3}>
                Item
              </th>
              <th className="grp" colSpan={3}>
                Last purchase (LPP)
              </th>
              <th className="grp" colSpan={3}>
                Per UOM · basic rate
              </th>
              <th className="grp qty" colSpan={3}>
                On total quantity (Qty × rate)
              </th>
              <th className="grp" colSpan={2} />
            </tr>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th className="r">Qty · UOM</th>
              <th>Status</th>
              <th className="r">LPP rate</th>
              <th>PO ref · vendor</th>
              <th>Awarded vendor</th>
              <th className="r">Current rate</th>
              <th className="r">Δ / UOM · %</th>
              <th className="r grp qty">LPP value</th>
              <th className="r grp qty">Current value</th>
              <th className="r grp qty">Impact</th>
              <th>
                {editable
                  ? `Justification (mandatory if ▲, min ${LPP_J_MIN} chars)`
                  : 'Justification for increase'}
              </th>
              <th>Chk</th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => {
              const a: AwardRow = c.aw[i];
              const it = r.it;
              const lp = it.lpp || {};
              const no = a.lppNo;
              const st = String(lp.status || '');
              const cls = a.lppOk ? (a.lppWarn.length ? 'w' : '') : 'e';
              const tip = [...a.lppIssues, ...a.lppWarn].join('\n') || 'OK';
              const lv = a.lppVar == null || a.lppRate == null ? null : a.lppRate * r.qty;

              return (
                <tr key={i} className={cls}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{it.code}</b>
                    <div className="lpp-d" title={it.desc}>
                      {it.desc}
                    </div>
                  </td>
                  <td className="r">
                    <span className="q">{fmt(r.qty, r.qty % 1 ? 3 : 0, cu)}</span>
                    <br />
                    <small>{it.uom || ''}</small>
                  </td>
                  <td>
                    {editable ? (
                      <select
                        data-p={`items.${i}.lpp.status`}
                        disabled={dis}
                        className={st ? '' : 'lpp-err'}
                        value={st}
                        onChange={(e) => onChangeField(`items.${i}.lpp.status`, e.target.value)}
                      >
                        <option value="">— select —</option>
                        <option value="Available">Available</option>
                        <option value="First purchase – no LPP">First purchase</option>
                      </select>
                    ) : no ? (
                      'First purchase'
                    ) : (
                      st || '—'
                    )}
                  </td>
                  <td className="r">
                    {no ? (
                      <span className="lpp-na">n/a</span>
                    ) : editable ? (
                      <input
                        type="number"
                        step="any"
                        data-p={`items.${i}.lpp.rate`}
                        disabled={dis}
                        className={a.lppRateMiss ? 'lpp-err' : ''}
                        placeholder="0.00"
                        value={lp.rate ?? ''}
                        onChange={(e) =>
                          onChangeField(
                            `items.${i}.lpp.rate`,
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                      />
                    ) : (
                      fmt(lp.rate, 2, cu)
                    )}
                  </td>
                  <td>
                    {no ? (
                      <span className="lpp-na">—</span>
                    ) : editable ? (
                      <>
                        <input
                          type="text"
                          data-p={`items.${i}.lpp.po`}
                          disabled={dis}
                          className={a.lppPoMiss ? 'lpp-err' : ''}
                          placeholder="PO no. / date"
                          value={lp.po ?? ''}
                          onChange={(e) => onChangeField(`items.${i}.lpp.po`, e.target.value)}
                        />
                        <input
                          type="text"
                          data-p={`items.${i}.lpp.vendor`}
                          disabled={dis}
                          className={a.lppVenMiss ? 'lpp-err' : ''}
                          style={{ marginTop: 2 }}
                          placeholder="LPP vendor"
                          value={lp.vendor ?? ''}
                          onChange={(e) => onChangeField(`items.${i}.lpp.vendor`, e.target.value)}
                        />
                      </>
                    ) : (
                      <>
                        {lp.po || '—'}
                        <br />
                        <small>{lp.vendor || ''}</small>
                      </>
                    )}
                  </td>
                  <td
                    className="lpp-v"
                    title={a.j == null ? '' : d.vendors[a.j]?.name || ''}
                  >
                    {a.j == null ? '—' : d.vendors[a.j]?.name}
                  </td>
                  <td className="r">
                    <b>{fmt(a.unit, 2, cu)}</b>
                  </td>
                  <td className="r">
                    <span className={cl(a.lppVar)}>{sg(a.lppVar)}</span>
                    <br />
                    <LppBadge lppNo={a.lppNo} lppPct={a.lppPct} />
                  </td>
                  <td className="r qv">{lv == null ? '—' : fmt(lv, 0, cu)}</td>
                  <td className="r qv">{a.n == null ? '—' : fmt(a.n, 0, cu)}</td>
                  <td className="r qv">
                    <b className={cl(a.lppImpact)}>{sg(a.lppImpact)}</b>
                  </td>
                  <td className="jc">
                    {a.lppUp ? (
                      editable ? (
                        <>
                          <textarea
                            rows={1}
                            data-p={`nfa.lppJ.${i}`}
                            disabled={dis}
                            className={a.lppJMissing ? 'lpp-err' : ''}
                            placeholder="Reason for increase vs LPP"
                            value={d.nfa.lppJ?.[String(i)] || ''}
                            onChange={(e) => onChangeField(`nfa.lppJ.${i}`, e.target.value)}
                          />
                          <div className="print-only">{a.lppJ || '—'}</div>
                          {a.lppJ && a.lppJShort ? (
                            <small className="lpp-cnt">
                              {a.lppJ.length}/{LPP_J_MIN}
                            </small>
                          ) : null}
                        </>
                      ) : a.lppJ ? (
                        a.lppJ
                      ) : (
                        <span className="bad">Missing</span>
                      )
                    ) : (
                      <span className="lpp-na">
                        {no ? 'n/a – first purchase' : a.lppPct == null ? '—' : 'Not required'}
                      </span>
                    )}
                  </td>
                  <td className="text-center" title={tip}>
                    {a.lppOk ? (
                      a.lppWarn.length ? (
                        <span className="lpp-w">⚠</span>
                      ) : (
                        <span className="ok">✓</span>
                      )
                    ) : (
                      <span className="bad">✕</span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="t">
              <td />
              <td colSpan={5}>
                <b>TOTAL — {ls.items} item(s) compared with LPP</b>{' '}
                <small>
                  (▲ {ls.up} · ▼ {ls.down})
                </small>
              </td>
              <td colSpan={2} className="r">
                <small>Overall change on total qty</small>
              </td>
              <td className="r">
                {ls.pct == null ? '—' : <LppBadge lppPct={ls.pct} />}
              </td>
              <td className="r qv">{ls.items ? fmt(ls.basket, 0, cu) : '—'}</td>
              <td className="r qv">{ls.items ? fmt(ls.now, 0, cu) : '—'}</td>
              <td className="r qv">
                <b className={cl(ls.impact)}>{ls.items ? sg(ls.impact) : '—'}</b>
              </td>
              <td colSpan={2}>
                <small>
                  {ls.items
                    ? `${ls.impact > 0 ? 'Paying ' : 'Saving '}${cu} ${fmt(Math.abs(ls.impact), 0, cu)}${
                        ls.impact > 0 ? ' more' : ''
                      } than LPP on the quantities in this NFA`
                    : 'No item has an LPP'}
                </small>
              </td>
            </tr>
            {ex.length ? (
              <tr className="t2">
                <td />
                <td colSpan={8}>
                  Not in comparison: {ex.length} item(s) —{' '}
                  {ex
                    .map(
                      (x) =>
                        `Item ${x.i + 1}${x.a.lppNo ? ' (first purchase)' : ' (LPP missing)'}`
                    )
                    .join(', ')}
                </td>
                <td className="r qv">—</td>
                <td className="r qv">{fmt(exVal, 0, cu)}</td>
                <td className="r qv">—</td>
                <td colSpan={2}>
                  <small>Excluded from impact</small>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="note">
        All values in {cu}, basic rate only (excl. GST, freight, P&amp;F, insurance, other loadings).
        LPP value = Qty × LPP rate; Current value = Qty × awarded negotiated basic rate; Impact =
        Current value − LPP value. Overall % = total impact ÷ total LPP value (weighted by
        quantity).
      </p>
    </>
  );
};
