import React, { useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  LayoutGrid,
  Save,
  Shield,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import type {
  CalcResult,
  DoaBand,
  EnfaStore,
  NfaRecord,
  NfaVersion,
  TabId,
} from '../../types/enfa.ts';
import { DOA_FINAL_ROLES, WF_ORDER } from '../../utils/enfaConstants.ts';
import {
  backupDue,
  bandOf,
  checks,
  fmt,
  fmtD,
  nextAction,
  pct,
  portfolioMetrics,
  shortK,
  valOf,
  wfDone,
} from '../../utils/enfaEngine.ts';
import {
  ApprovalTimeline,
  ChartLegend,
  DonutChart,
  HorizontalBars,
  LppImpactChart,
  RingChart,
  SplitDonutChart,
  VendorComparisonChart,
} from './Charts.tsx';
import { LockBanner } from './FieldControl.tsx';

export const OverviewView: React.FC<{
  nfa: NfaRecord;
  ver: NfaVersion;
  c: CalcResult;
  onGoTab: (tab: TabId) => void;
}> = ({ nfa, ver, c, onGoTab }) => {
  const st = ver.status;
  const d = ver.data;
  const cu = d.header.cur || 'INR';
  const ck = checks(d, c);
  const okN = ck.filter((x) => x[1]).length;
  const draft = st === 'Draft';
  const TOT = WF_ORDER.length + 1;
  const done = draft ? WF_ORDER.filter((k) => wfDone(d, k)).length : st === 'Approved' ? TOT : TOT - 1;
  const p = done / TOT;
  const na = nextAction(ver);
  const pj = d.project;
  const lp = c.lppSum;
  const stepN = Math.min(TOT, done + 1);

  return (
    <>
      <LockBanner ver={ver} />
      <div className="ov-hero">
        <div className="ov-l">
          <div className="ov-eyebrow">
            <FileText size={15} /> {nfa.no} · {ver.ver}{' '}
            <span className={`pill ${st}`}>{st.toUpperCase()}</span>
          </div>
          <h2 className="ov-title">{pj?.name || d.header.desc || 'Untitled sourcing project'}</h2>
          <div className="ov-meta">
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} /> Buyer: <b>{d.header.buyer || pj?.buyer || '—'}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shield size={14} /> Final authority: <b>{bandOf(ver, c).final}</b>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileText size={14} /> PR: <b>{d.header.prNo || '—'}</b>
            </span>
          </div>
          <div className="ov-next">
            {na.done ? <CheckCircle2 size={16} /> : <Clock size={16} />}
            <span>{na.txt}</span>
            {na.tab && na.tab !== 'dash' ? (
              <button
                type="button"
                className="btn"
                style={{ padding: '6px 12px' }}
                onClick={() => onGoTab(na.tab)}
              >
                Continue →
              </button>
            ) : null}
          </div>
        </div>
        <div className="ov-r">
          <RingChart progress={p} size={118} label={`${Math.round(p * 100)}%`} />
          <small>{draft ? `Stage ${stepN} of ${TOT}` : st === 'Pending' ? 'In approval' : st}</small>
        </div>
      </div>

      <div className="kx-row">
        <div className="kx">
          <div className="kx-i">
            <TrendingUp size={21} />
          </div>
          <div className="kx-b">
            <span>Award value (landed)</span>
            <b>
              {cu} {shortK(valOf(ver, c), cu)}
            </b>
            <small>{fmt(valOf(ver, c), 0, cu)} excl. tax</small>
          </div>
        </div>
        <div className="kx good">
          <div className="kx-i">
            <Save size={21} />
          </div>
          <div className="kx-b">
            <span>Negotiation saving</span>
            <b>
              {cu} {shortK(c.sav, cu)}
            </b>
            <small>{pct(c.savPct)} vs quoted</small>
          </div>
        </div>
        <div className={`kx ${(lp.pct || 0) > 0 ? 'warn' : (lp.pct || 0) < 0 ? 'good' : ''}`}>
          <div className="kx-i">
            <Activity size={21} />
          </div>
          <div className="kx-b">
            <span>vs Last purchase price</span>
            <b>
              {lp.pct == null
                ? 'No LPP'
                : `${lp.pct > 0 ? '▲ +' : '▼ '}${(lp.pct * 100).toFixed(1)}%`}
            </b>
            <small>
              {lp.items
                ? `${lp.impact > 0 ? '+' : ''}${shortK(lp.impact, cu)} on total qty`
                : 'Add LPP in CS'}
            </small>
          </div>
        </div>
        <div className={`kx ${okN === ck.length ? 'good' : 'warn'}`}>
          <div className="kx-i">
            <CheckCircle2 size={21} />
          </div>
          <div className="kx-b">
            <span>Pre-submission checks</span>
            <b>
              {okN} / {ck.length}
            </b>
            <small>{okN === ck.length ? 'All passed' : `${ck.length - okN} open`}</small>
          </div>
        </div>
      </div>

      <div className="ch-grid">
        <section className="ch-card">
          <div className="ch-h">
            <BarChart3 size={16} className="text-[var(--t-acc)]" />
            <b>Vendor comparison</b>
            <small>Total landed value, technically accepted vendors · L1 highlighted</small>
          </div>
          <VendorComparisonChart c={c} />
        </section>

        <section className="ch-card">
          <div className="ch-h">
            <TrendingUp size={16} className="text-[var(--t-acc)]" />
            <b>Award split by vendor</b>
            <small>Buyer-selected awards</small>
          </div>
          <SplitDonutChart c={c} />
        </section>

        <section className="ch-card">
          <div className="ch-h">
            <Activity size={16} className="text-[var(--t-acc)]" />
            <b>Impact vs last purchase price</b>
            <small>(Current − LPP) basic rate × quantity, per item</small>
          </div>
          <LppImpactChart c={c} />
        </section>

        <section className="ch-card">
          <div className="ch-h">
            <CheckCircle2 size={16} className="text-[var(--t-acc)]" />
            <b>Approval route</b>
            <small>
              DoA band {bandOf(ver, c).final} · {bandOf(ver, c).days}-day cycle
            </small>
          </div>
          <ApprovalTimeline ver={ver} c={c} />
        </section>
      </div>

      <details className="howto">
        <summary>
          <LayoutGrid size={15} /> How the e-NFA process works (stages, owners and controls)
        </summary>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Stage</th>
              <th>Owner</th>
              <th>What happens</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['0', 'Sourcing Project', 'Requester / Buyer', 'Business need, scope, estimate, route and leads', 'Required details gate RFQ access'],
              ['0A', 'PR Details', 'Buyer', 'Manual entry or CSV upload of approved PR lines; select lines & quantities', 'Approved status, open qty, duplicates, dates validated'],
              ['1', 'RFQ Header', 'Buyer', 'RFQ, budget, route, justification, INR rate for non-INR', 'Mandatory fields'],
              ['2', 'Quotes', 'Buyer', 'Quote currency + FX and item-wise quoted rates', 'FX mandatory for foreign quotes'],
              ['2A', 'Quoted Terms', 'Buyer', 'Each vendor’s quoted terms side by side – best / weakest / risk, commercial score and suggested vendor; Excel for vendor and team discussions', 'Key terms mandatory; becomes the baseline for negotiation'],
              ['3', 'Technical Evaluation', 'User HOD (Technical)', '7 criteria per vendor / line; Accepted or Rejected', 'Only accepted lines proceed'],
              ['4', 'Negotiation & Terms', 'Buyer', 'Final prices and commercial terms', 'Negotiated ≤ quoted'],
              ['5', 'Comparative Statement', 'Buyer', 'Ranking, award selection, LPP comparison', 'Reasons for non-L1 and above-LPP'],
              ['6', 'NFA', 'Buyer', 'Two-page NFA with 22 checks', 'Submit blocked until all checks pass'],
              ['7', 'Approval', 'Approvers', 'Sequential DoA routing', 'Comments for Return/Reject; segregation of duties'],
              ['8', 'Lock & Version', 'System', 'SHA-256 seal and version chain', 'Verify integrity on Versions tab'],
            ].map((r) => (
              <tr key={r[0]}>
                {r.map((x, i) => (
                  <td key={i} className={i === 1 ? 'l' : ''}>
                    {x}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="note">
        Data is automatically persisted in this workspace and browser. Use{' '}
        <button
          type="button"
          className="text-[var(--t-acc2)] underline font-semibold bg-transparent border-0 p-0 cursor-pointer"
          onClick={() => onGoTab('data')}
        >
          Data &amp; Backup
        </button>{' '}
        to export a JSON backup regularly. “Acting as” simulates roles for this workflow.
      </p>
    </>
  );
};

export const PortfolioView: React.FC<{
  store: EnfaStore;
  onOpenNfa: (id: string) => void;
}> = ({ store, onOpenNfa }) => {
  const rows = portfolioMetrics(store);
  const by = (s: string) => rows.filter((r) => r.status === s);
  const sts = ['Draft', 'Pending', 'Approved', 'Returned', 'Rejected', 'Superseded'];
  const col: Record<string, string> = {
    Draft: '#94A3B8',
    Pending: '#D97706',
    Approved: '#16A34A',
    Returned: '#EA580C',
    Rejected: '#DC2626',
    Superseded: '#64748B',
  };
  const parts = sts
    .map((s) => ({ v: by(s).length, l: s, c: col[s], t: String(by(s).length) }))
    .filter((x) => x.v > 0);
  const pend = rows.filter((r) => r.status === 'Pending').sort((a, b) => (b.age || 0) - (a.age || 0));
  const roles: Record<string, number> = {};
  pend.forEach((r) => {
    const k = r.pend?.role || '—';
    roles[k] = (roles[k] || 0) + 1;
  });
  const appr = by('Approved');
  const apprV = appr.reduce((s, r) => s + r.val, 0);
  const pendV = pend.reduce((s, r) => s + r.val, 0);

  return (
    <>
      <h2>
        <LayoutGrid size={18} /> Portfolio dashboard
      </h2>
      <p className="note">
        All NFAs saved in this workspace. Values in each NFA&apos;s base currency (mixed currencies
        are added as entered).
      </p>
      <div className="kx-row">
        <div className="kx">
          <div className="kx-i">
            <FileText size={20} />
          </div>
          <div className="kx-b">
            <span>Total NFAs</span>
            <b>{rows.length}</b>
            <small>{by('Draft').length} in draft</small>
          </div>
        </div>
        <div className="kx warn">
          <div className="kx-i">
            <Clock size={20} />
          </div>
          <div className="kx-b">
            <span>Awaiting approval</span>
            <b>{pend.length}</b>
            <small>value {shortK(pendV)}</small>
          </div>
        </div>
        <div className="kx good">
          <div className="kx-i">
            <CheckCircle2 size={20} />
          </div>
          <div className="kx-b">
            <span>Approved</span>
            <b>{appr.length}</b>
            <small>value {shortK(apprV)}</small>
          </div>
        </div>
        <div className={`kx ${pend.some((r) => (r.age || 0) > (r.band || 5)) ? 'bad' : ''}`}>
          <div className="kx-i">
            <AlertTriangle size={20} />
          </div>
          <div className="kx-b">
            <span>Over approval cycle</span>
            <b>{pend.filter((r) => (r.age || 0) > (r.band || 5)).length}</b>
            <small>pending beyond DoA cycle days</small>
          </div>
        </div>
      </div>

      <div className="ch-grid">
        <section className="ch-card">
          <div className="ch-h">
            <LayoutGrid size={16} className="text-[var(--t-acc)]" />
            <b>NFAs by status</b>
          </div>
          {parts.length ? (
            <div className="donut-wrap">
              <DonutChart parts={parts} center={String(rows.length)} sub="NFAs" />
              <ChartLegend parts={parts} />
            </div>
          ) : (
            <div className="ch-empty">No NFAs</div>
          )}
        </section>

        <section className="ch-card">
          <div className="ch-h">
            <Users size={16} className="text-[var(--t-acc)]" />
            <b>Pending with</b>
            <small>approval level currently holding the NFA</small>
          </div>
          <HorizontalBars
            empty="Nothing pending"
            rows={Object.entries(roles).map(([k, n]) => ({
              l: k,
              v: n,
              t: `${n} NFA${n > 1 ? 's' : ''}`,
            }))}
          />
        </section>
      </div>

      <h3>All NFAs</h3>
      <div className="overflow-x-auto">
        <table className="port">
          <thead>
            <tr>
              <th>NFA</th>
              <th>Title</th>
              <th>Version</th>
              <th>Status</th>
              <th className="r">Value</th>
              <th>Pending with</th>
              <th className="r">Days waiting</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => String(b.no).localeCompare(String(a.no)))
              .map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.no}</b>
                  </td>
                  <td>{r.title}</td>
                  <td>{r.ver}</td>
                  <td>
                    <span className={`pill ${r.status}`}>{r.status}</span>
                  </td>
                  <td className="n">
                    {r.cur} {fmt(r.val, 0, r.cur)}
                  </td>
                  <td>{r.pend ? `${r.pend.lv} · ${r.pend.role}` : '—'}</td>
                  <td className={`n ${(r.age || 0) > (r.band || 5) ? 'bad' : ''}`}>
                    {r.age == null ? '—' : r.age.toFixed(1)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn w"
                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                      onClick={() => onOpenNfa(r.id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export const BackupView: React.FC<{
  store: EnfaStore;
  storageKB: number;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onClearAll: () => void;
}> = ({ store, storageKB, onExportBackup, onImportBackup, onClearAll }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const due = backupDue(store);

  return (
    <>
      <h2>
        <Save size={18} /> Data &amp; Backup
      </h2>
      <div className={`lock ${due ? '' : 'lockok'}`} style={{ alignItems: 'flex-start' }}>
        {due ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        <div>
          {store.lastBackup ? (
            <>
              Last backup: <b>{fmtD(store.lastBackup)}</b>.
            </>
          ) : (
            <b>No backup has been taken yet.</b>
          )}{' '}
          All NFAs are stored in this workspace and browser storage. Take a JSON backup at least
          weekly and keep it on OneDrive / SharePoint.
        </div>
      </div>

      <div className="ch-grid">
        <section className="ch-card">
          <div className="ch-h">
            <Download size={16} className="text-[var(--t-acc)]" />
            <b>Export backup</b>
            <small>All NFAs, versions, approvals, audit trail and DoA</small>
          </div>
          <p className="note">
            Downloads one .json file. It contains commercial data — store it in a restricted folder.
          </p>
          <button type="button" className="btn" onClick={onExportBackup}>
            <Download size={14} /> Download backup
          </button>
        </section>

        <section className="ch-card">
          <div className="ch-h">
            <Upload size={16} className="text-[var(--t-acc)]" />
            <b>Restore / merge backup</b>
            <small>Bring NFAs from another PC or browser</small>
          </div>
          <p className="note">
            Adds NFAs from the backup that are not already here. Existing records are never
            overwritten, so sealed approvals stay intact.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportBackup(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn w" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Choose backup file…
          </button>
        </section>
      </div>

      <p className="note">
        Storage used: {storageKB} KB of about 5,000 KB browser quota ·{' '}
        {Object.keys(store.nfas).length} NFA(s).
      </p>
      <p>
        <button type="button" className="btn r" onClick={onClearAll}>
          Reset workspace to default demo data
        </button>
      </p>
    </>
  );
};

export const DoaConfigView: React.FC<{
  store: EnfaStore;
  onEditDoa: (idx: number, key: keyof DoaBand, val: string | number | boolean) => void;
}> = ({ store, onEditDoa }) => {
  const ok = store.role === 'Head – SCM' || store.role === 'CFO';
  const gaps = store.doa
    .map((b, i) =>
      b.from >= b.to
        ? `Band ${i + 1}: From must be below To`
        : i && b.from !== store.doa[i - 1].to
        ? `Band ${i + 1} starts at ${fmt(b.from)} but band ${i} ends at ${fmt(store.doa[i - 1].to)}`
        : ''
    )
    .filter(Boolean);

  return (
    <>
      <h2>Delegation of Authority (DoA) — Configuration</h2>
      <p className="note">
        Placeholder bands – replace with the approved company DoA. All bands are in <b>INR</b>;
        NFAs in another currency are converted with the INR rate recorded in the RFQ Header.
        Editable only by Head – SCM / CFO role. Changes apply to NFAs submitted after the change
        and are logged below.
      </p>
      {gaps.length ? (
        <div className="lock">
          {gaps.map((g, i) => (
            <div key={i}>⚠ {g}</div>
          ))}
        </div>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>From (≥ INR)</th>
            <th>To (&lt; INR)</th>
            <th>Final Approving Authority</th>
            <th>Finance Concurrence</th>
            <th>Approval Cycle (days)</th>
          </tr>
        </thead>
        <tbody>
          {store.doa.map((b, i) => (
            <tr key={i}>
              <td>
                <input
                  type="number"
                  disabled={!ok}
                  value={b.from}
                  onChange={(e) => onEditDoa(i, 'from', Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  disabled={!ok}
                  value={b.to}
                  onChange={(e) => onEditDoa(i, 'to', Number(e.target.value))}
                />
              </td>
              <td>
                <select
                  disabled={!ok}
                  value={b.final}
                  onChange={(e) => onEditDoa(i, 'final', e.target.value)}
                >
                  {DOA_FINAL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  disabled={!ok}
                  value={b.fin ? 'Yes' : 'No'}
                  onChange={(e) => onEditDoa(i, 'fin', e.target.value === 'Yes')}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  disabled={!ok}
                  value={b.days}
                  onChange={(e) => onEditDoa(i, 'days', Number(e.target.value))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>DoA change log</h3>
      {(store.doaLog || []).length ? (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Role</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {[...(store.doaLog || [])]
              .slice(-15)
              .reverse()
              .map((x, idx) => (
                <tr key={idx}>
                  <td>{fmtD(x.t)}</td>
                  <td>{x.u}</td>
                  <td>{x.e}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="note">No changes recorded.</p>
      )}
    </>
  );
};
