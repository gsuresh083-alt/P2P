import React, { useState } from 'react';
import { CheckCircle2, Shield } from 'lucide-react';
import type {
  CalcResult,
  DoaBand,
  NfaRecord,
  NfaVersion,
  RoleName,
  TabId,
} from '../../types/enfa.ts';
import {
  bandOf,
  calc,
  curLevel,
  diffObjects,
  fmt,
  fmtD,
  route,
  valOf,
} from '../../utils/enfaEngine.ts';
import { ApprovalTimeline } from './Charts.tsx';
import { LockBanner } from './FieldControl.tsx';
import { ApprovalMatrix } from './NfaDocumentView.tsx';

export const ApprovalView: React.FC<{
  ver: NfaVersion;
  c: CalcResult;
  role: RoleName;
  onGoTab: (tab: TabId) => void;
  onAct: (kind: 'Approve' | 'Return for Revision' | 'Reject', name: string, comment: string) => void;
  onRevise: () => void;
}> = ({ ver, c, role, onGoTab, onAct, onRevise }) => {
  const [apn, setApn] = useState('');
  const [cmt, setCmt] = useState('');

  const d = ver.data;
  const cu = d.header.cur || 'INR';
  const a = curLevel(ver);
  const can = ver.status === 'Pending' && a && a.role === role;
  const bb = bandOf(ver, c);
  const inrV = ver.status === 'Draft' ? c.totalInr : ver.valueInr;

  const submitAction = (kind: 'Approve' | 'Return for Revision' | 'Reject') => {
    onAct(kind, apn.trim(), cmt.trim());
  };

  return (
    <>
      <LockBanner ver={ver} />
      <h2>
        <CheckCircle2 size={18} /> 7. Approval Workflow
      </h2>

      <div className="tl-wide">
        <ApprovalTimeline ver={ver} c={c} />
      </div>

      <p>
        Routing for value{' '}
        <b>
          {cu} {fmt(valOf(ver, c), 0, cu)}
        </b>
        {cu !== 'INR'
          ? inrV != null
            ? ` (≈ INR ${fmt(inrV, 0, 'INR')})`
            : ' (INR rate missing – highest band assumed)'
          : ''}{' '}
        → DoA band (INR){' '}
        <b>
          {fmt(bb.from, 0, 'INR')} – {bb.to > 1e14 ? 'above' : fmt(bb.to, 0, 'INR')}
        </b>
        , final authority <b>{bb.final}</b>, finance concurrence{' '}
        <b>{bb.fin ? 'Yes' : 'No'}</b>, expected cycle <b>{bb.days} days</b>.
      </p>

      {ver.status === 'Draft' ? (
        <>
          <div className="flow">
            {route(c).map((x, idx) => (
              <React.Fragment key={x.lv}>
                {idx > 0 ? <i>➜</i> : null}
                <div>
                  {x.lv} · {x.role}
                </div>
              </React.Fragment>
            ))}
          </div>
          <p className="note">Preview – route is frozen at submission.</p>
        </>
      ) : (
        <ApprovalMatrix ver={ver} c={c} full />
      )}

      {ver.status !== 'Draft' ? (
        <>
          <h3>Submitted NFA — Award Decision Snapshot</h3>
          <p className="note">
            This is the NFA submitted for approval. The approved / pending approvers can review the
            exact item-wise Buyer award decisions and their justifications here. Use the NFA tab for
            the complete printable NFA.
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>CS L1 Vendor</th>
                  <th>Buyer-selected Vendor</th>
                  <th className="r">Award Value</th>
                  <th>Buyer Selection Justification</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((r, i) => {
                  const a0 = c.aw[i];
                  return (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{r.it.code || r.it.desc}</td>
                      <td>{r.l1j == null ? '—' : d.vendors[r.l1j]?.name}</td>
                      <td>
                        <b>{a0.j == null ? 'Not selected' : d.vendors[a0.j]?.name}</b>
                      </td>
                      <td className="n">{fmt(a0.landed, 0, cu)}</td>
                      <td>
                        {a0.nonL1 || r.tie ? d.nfa.ovr?.[String(i)] || 'Missing' : '—'}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={4} className="l">
                    TOTAL NFA VALUE
                  </td>
                  <td className="n">
                    <b>{fmt(c.total, 0, cu)}</b>
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">
            <b>Buyer selection rationale:</b> {d.nfa.rationale || '—'}
          </p>
          <p className="mt-1">
            <b>Overall non-L1 / route justification:</b> {d.nfa.nonL1 || '—'}
          </p>
          <p className="mt-2">
            <button type="button" className="btn" onClick={() => onGoTab('nfa')}>
              View complete submitted NFA →
            </button>
          </p>
        </>
      ) : null}

      {ver.status === 'Pending' ? (
        can && a ? (
          <>
            <h3>
              Your action — {a.lv} · {a.role}
            </h3>
            <table>
              <tbody>
                <tr>
                  <td className="l">Name &amp; Designation *</td>
                  <td>
                    <input
                      value={apn}
                      placeholder="e.g. A. Kumar, HOD Mechanical"
                      onChange={(e) => setApn(e.target.value)}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="l">Comments</td>
                  <td>
                    <textarea
                      value={cmt}
                      placeholder="Mandatory for Return / Reject"
                      onChange={(e) => setCmt(e.target.value)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="flex gap-2 flex-wrap mt-2">
              <button
                type="button"
                className="btn g"
                onClick={() => submitAction('Approve')}
              >
                ✔ Approve
              </button>
              <button
                type="button"
                className="btn o"
                onClick={() => submitAction('Return for Revision')}
              >
                ↩ Return for Revision
              </button>
              <button
                type="button"
                className="btn r"
                onClick={() => submitAction('Reject')}
              >
                ✖ Reject
              </button>
            </p>
          </>
        ) : (
          <p className="note">
            Pending at{' '}
            <b>
              {a?.lv} · {a?.role}
            </b>
            . Switch “Acting as” to that role to act. Out-of-turn approval is not allowed.
          </p>
        )
      ) : null}

      {(ver.status === 'Returned' || ver.status === 'Approved') && role === 'Buyer' ? (
        <p className="mt-3">
          <button type="button" className="btn" onClick={onRevise}>
            {ver.status === 'Approved'
              ? 'Revise approved NFA → new major version'
              : 'Create revised version'}
          </button>
        </p>
      ) : null}

      {ver.status === 'Approved' ? (
        <div className="lock lockok mt-3">
          ✅ NFA approved. Any PO must match the vendor, value and terms of {ver.ver}.
        </div>
      ) : null}
    </>
  );
};

export const VersionsAuditView: React.FC<{
  nfa: NfaRecord;
  doa: DoaBand[];
  verifyState: { nfaId: string; res: Record<string, boolean | null> } | null;
  onVerifyChain: () => void;
}> = ({ nfa, doa, verifyState, onVerifyChain }) => {
  const vs = nfa.versions;
  const auditEntries = vs
    .flatMap((v) => v.audit.map((a) => ({ ...a, ver: v.ver })))
    .sort((a, b) => b.t.localeCompare(a.t));

  return (
    <>
      <h2>
        <Shield size={18} /> 8. Version Control, Lock Register &amp; Audit Trail
      </h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Created</th>
              <th>By</th>
              <th>Reason</th>
              <th className="r">Value</th>
              <th>Status</th>
              <th>Locked On</th>
              <th>SHA-256</th>
              <th>Integrity</th>
              <th>Changes vs previous</th>
            </tr>
          </thead>
          <tbody>
            {vs.map((v, i) => {
              const ch = i ? diffObjects(vs[i - 1].data, v.data) : [];
              const cur = v.data.header?.cur || 'INR';
              const val =
                v.status === 'Draft' ? calc(v.data, doa).total : v.value ?? calc(v.data, doa).total;
              const vRes =
                verifyState && verifyState.nfaId === nfa.id ? verifyState.res[v.ver] : undefined;

              return (
                <tr key={v.ver}>
                  <td className="l">{v.ver}</td>
                  <td>{fmtD(v.createdOn)}</td>
                  <td>{v.createdBy}</td>
                  <td>{v.reason}</td>
                  <td className="n">{fmt(val, 0, cur)}</td>
                  <td>
                    <span className={`pill ${v.status}`}>{v.status}</span>
                  </td>
                  <td>{fmtD(v.lockedOn)}</td>
                  <td>
                    <code className="text-[10px]">{(v.hash || '').slice(0, 16)}</code>
                  </td>
                  <td className="text-[11px]">
                    {vRes !== undefined ? (
                      vRes === null ? (
                        '—'
                      ) : vRes ? (
                        <span className="ok">✔ intact</span>
                      ) : (
                        <span className="bad">✖ altered</span>
                      )
                    ) : v.hash ? (
                      `not verified${v.hashV === 2 ? '' : ' (legacy hash)'}`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-[11px]">
                    {i ? (
                      ch.length ? (
                        <>
                          {ch.slice(0, 8).map(([p, oldV, newV], idx) => (
                            <div key={idx}>
                              {p}: {String(oldV ?? '')} → <b>{String(newV ?? '')}</b>
                            </div>
                          ))}
                          {ch.length > 8 ? <div>+{ch.length - 8} more</div> : null}
                        </>
                      ) : (
                        'No change'
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="noprint mt-2">
        <button type="button" className="btn w" onClick={onVerifyChain}>
          Verify integrity of all locked versions
        </button>
      </p>

      <h3>Audit trail (all versions)</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Version</th>
              <th>User / Role</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>
            {auditEntries.map((a, idx) => (
              <tr key={idx}>
                <td>{fmtD(a.t)}</td>
                <td>{a.ver}</td>
                <td>{a.u}</td>
                <td>{a.e}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Lock rules</h3>
      <ul className="note list-disc pl-5 text-xs space-y-1">
        <li>
          Approved / Returned / Rejected versions are frozen with a SHA-256 hash of the full record
          (header, quotes, terms, CS, NFA) plus approvals, value, DoA band snapshot, version
          metadata and the previous version’s hash (chain). Audit-trail lines are not hashed.
        </li>
        <li>
          Return for revision → minor version (V1.1); revision after approval → major version
          (V2.0); approved version is marked Superseded but stays locked and viewable.
        </li>
        <li>
          Each new version restarts approval from Level L1. Rejected NFAs are closed — a fresh NFA
          number is needed.
        </li>
        <li>Only the latest APPROVED version may be referenced by a PO.</li>
      </ul>
    </>
  );
};
