import React from 'react';
import {
  AlertTriangle,
  FileText,
  LayoutGrid,
  Lock,
  Plus,
  Save,
  Shield,
  Users,
} from 'lucide-react';
import type {
  CalcResult,
  EnfaStore,
  NfaRecord,
  NfaVersion,
  RoleName,
  StageId,
  TabId,
  ThemeId,
} from '../../types/enfa.ts';
import { ROLES, STAGE_META, STEP_ITEMS, WF_ORDER } from '../../utils/enfaConstants.ts';
import {
  backupDue,
  bandOf,
  fmt,
  nextAction,
  valOf,
  wfCanOpen,
  wfDone,
} from '../../utils/enfaEngine.ts';
import { SavingSummaryText } from './Charts.tsx';

export const AppHeader: React.FC<{
  store: EnfaStore;
  theme: ThemeId;
  onSelectNfa: (id: string) => void;
  onChangeRole: (role: RoleName) => void;
  onChangeTheme: (theme: ThemeId) => void;
  onNewNfa: () => void;
}> = ({ store, theme, onSelectNfa, onChangeRole, onChangeTheme, onNewNfa }) => {
  const initials = store.role
    .split(/[\s(–/]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="enfa-header">
      <span className="logo" aria-label="e-NFA">
        <svg viewBox="0 0 40 40" className="w-10 h-10 block">
          <defs>
            <linearGradient id="enfaLogoBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#dbe4f0" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#enfaLogoBg)" />
          <path
            d="M12 10h11l5 5v15H12z"
            fill="none"
            stroke="var(--t-hdr)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M23 10v5h5" fill="none" stroke="var(--t-hdr)" strokeWidth="2.2" />
          <path
            d="M15.5 22.5l3 3 6-6.5"
            fill="none"
            stroke="var(--t-acc)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="brand">
        <h1>e-NFA · Purchase Proposal Approval</h1>
        <div className="sub">AFRZEN · Supply Chain Management</div>
      </div>
      <label className="ctl">
        Record
        <select value={store.cur} onChange={(e) => onSelectNfa(e.target.value)}>
          {Object.values(store.nfas).map((n) => {
            const last = n.versions[n.versions.length - 1];
            return (
              <option key={n.id} value={n.id}>
                {n.no} · {last.ver} ({last.status})
              </option>
            );
          })}
        </select>
      </label>
      <label className="ctl">
        <span className="avatar">{initials}</span>
        Acting as
        <select value={store.role} onChange={(e) => onChangeRole(e.target.value as RoleName)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="ctl themepick" title="Colour theme">
        Theme
        <select value={theme} onChange={(e) => onChangeTheme(e.target.value as ThemeId)}>
          <option value="slate">Executive Slate</option>
          <option value="navy">Midnight Navy</option>
          <option value="steel">Steel &amp; Copper</option>
        </select>
      </label>
      {store.role !== 'Vendor' ? (
        <button type="button" className="btn w" onClick={onNewNfa}>
          <Plus size={14} /> New NFA
        </button>
      ) : null}
    </header>
  );
};

export const RecordBar: React.FC<{
  store: EnfaStore;
  nfa: NfaRecord;
  ver: NfaVersion;
  c: CalcResult;
  onGoTab: (tab: TabId) => void;
}> = ({ store, nfa, ver, c, onGoTab }) => {
  const d = ver.data;
  const draft = ver.status === 'Draft';
  const doneN = draft ? WF_ORDER.filter((k) => wfDone(d, k)).length : WF_ORDER.length;
  const tot = WF_ORDER.length + 1;
  const doneAll = doneN + (ver.status === 'Approved' ? 1 : 0);
  const pctv = Math.round((doneAll / tot) * 100);
  const na = nextAction(ver);
  const mine = Boolean(na.who && na.who === store.role && !na.done);
  const p = d.project;
  const isLocked = ['Approved', 'Rejected', 'Returned', 'Superseded'].includes(ver.status);
  const cur = d.header.cur || 'INR';
  const inrVal = draft ? c.totalInr : ver.valueInr;

  const utils: [TabId, string, React.ReactNode][] = [
    ['dash', 'Overview', <FileText size={13} key="d" />],
    ['port', 'Dashboard', <LayoutGrid size={13} key="p" />],
    ['ver', 'Versions & Audit', <Shield size={13} key="v" />],
    ['cfg', 'DoA', <Users size={13} key="c" />],
    ['data', 'Backup', <Save size={13} key="b" />],
  ];

  return (
    <div className="bar">
      <div className="recbar">
        <div className="id">
          {nfa.no}{' '}
          <span className={`pill ${ver.status}`}>
            {ver.status.toUpperCase()}
            {isLocked ? ' · LOCKED' : ''}
          </span>
          <small>
            {p?.name || d.header.desc || 'Untitled sourcing project'} · {ver.ver}
          </small>
        </div>

        <div className="facts">
          <div className="fact">
            <span>Award value (landed)</span>
            <b>
              {cur} {fmt(valOf(ver, c), 0, cur)}
            </b>
          </div>
          {cur !== 'INR' && inrVal != null ? (
            <div className="fact">
              <span>≈ INR</span>
              <b>{fmt(inrVal, 0, 'INR')}</b>
            </div>
          ) : null}
          <div className="fact">
            <span>Negotiation saving</span>
            <b className="ok">{SavingSummaryText(c)}</b>
          </div>
          <div className="fact">
            <span>Final authority</span>
            <b>{bandOf(ver, c).final}</b>
          </div>
          <div className="fact">
            <span>Buyer</span>
            <b>{d.header.buyer || p?.buyer || '—'}</b>
          </div>
        </div>

        <div className="prog">
          <div className="t">
            <span>Workflow progress</span>
            <span className="tabular-nums">{pctv}%</span>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${pctv}%` }} />
          </div>
          <div className="util">
            {utils.map(([k, label, icon]) => (
              <button
                key={k}
                type="button"
                className={store.tab === k ? 'on' : ''}
                onClick={() => onGoTab(k)}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          {backupDue(store) ? (
            <div className="text-right mt-1.5">
              <span className="bk-due" onClick={() => onGoTab('data')}>
                <AlertTriangle size={13} /> Backup due
              </span>
            </div>
          ) : null}
        </div>

        <div className={`nextact ${mine ? 'mine' : ''}`}>
          <b>{mine ? '▶ Your action:' : '●'}</b>
          <span className="flex-1">{na.txt}</span>
          {na.tab && na.tab !== store.tab ? (
            <button
              type="button"
              className="btn w"
              style={{ padding: '4px 10px' }}
              onClick={() => onGoTab(na.tab)}
            >
              Go →
            </button>
          ) : null}
          {!(ver.status === 'Draft' && store.role === 'Buyer') && draft && !mine ? (
            <span className="note" style={{ margin: 0 }}>
              You are viewing as <b>{store.role}</b> — read-only for Buyer fields.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const Stepper: React.FC<{
  ver: NfaVersion;
  currentTab: TabId;
  onGoTab: (tab: TabId) => void;
}> = ({ ver, currentTab, onGoTab }) => {
  const draft = ver.status === 'Draft';

  return (
    <div className="steps">
      <nav className="stepper" aria-label="Workflow">
        {STEP_ITEMS.map(({ key, no }) => {
          const done =
            key === 'apr'
              ? ver.status === 'Approved'
              : draft
              ? wfDone(ver.data, key as StageId)
              : true;
          const locked = !wfCanOpen(ver, key);
          const cur = currentTab === key;
          const [name, owner] = STAGE_META[key];
          return (
            <button
              key={key}
              type="button"
              className={`stp ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${locked ? 'locked' : ''}`}
              aria-current={cur ? 'step' : undefined}
              title={`${name} — ${owner}${locked ? ' (locked until previous stage is submitted)' : ''}`}
              onClick={() => onGoTab(key)}
            >
              <span className="dot">
                {done ? '✓' : locked ? <Lock size={12} /> : no}
              </span>
              <span className="lb">
                <b>{name}</b>
                <small>{owner}</small>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
