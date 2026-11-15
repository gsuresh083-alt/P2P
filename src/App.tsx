import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApprovalView,
  VersionsAuditView,
} from './components/enfa/ApprovalAuditViews.tsx';
import { AppHeader, RecordBar, Stepper } from './components/enfa/Chrome.tsx';
import { ComparativeStatementView } from './components/enfa/ComparativeStatementView.tsx';
import type { DiscountApplyPayload } from './components/enfa/DiscountOptionModal.tsx';
import {
  DialogModal,
  DialogRequest,
  PrintPreviewModal,
  ToastContainer,
  ToastItem,
} from './components/enfa/DialogModal.tsx';
import {
  BackupView,
  DoaConfigView,
  OverviewView,
  PortfolioView,
} from './components/enfa/OverviewPortfolioViews.tsx';
import { NfaDocumentView } from './components/enfa/NfaDocumentView.tsx';
import { NegotiationView } from './components/enfa/NegotiationView.tsx';
import { PrDetailsView } from './components/enfa/PrDetailsView.tsx';
import { ProjectView, RfqHeaderView } from './components/enfa/ProjectHeaderViews.tsx';
import { QuotedTermsView, QuotesView } from './components/enfa/QuotesViews.tsx';
import { TechEvalView } from './components/enfa/TechEvalView.tsx';
import { VendorOfferPhase, VendorView } from './components/enfa/VendorView.tsx';
import type {
  DoaBand,
  EnfaStore,
  NfaData,
  NfaRecord,
  PrLine,
  RoleName,
  StageId,
  TabId,
  ThemeId,
  VendorAttachment,
} from './types/enfa.ts';
import {
  HDR_FIELDS,
  PR_COLS,
  PR_DATE,
  PR_NUM,
  QT_KEYS,
  QT_REQ,
  STAGE_META,
  TERMS,
  WF_NEXT,
  WF_ORDER,
} from './utils/enfaConstants.ts';
import {
  calc,
  canEditPath,
  clone,
  csvCell,
  csvParse,
  curLevel,
  downloadBlob,
  fmt,
  getActiveNfa,
  getActiveVersion,
  invalidateForPath,
  invalidateWorkflow,
  isOkForLine,
  lineTechComplete,
  normalizeNfaData,
  nowIso,
  num,
  prLineIssues,
  prLineKey,
  prNewId,
  prNormDate,
  prNum,
  prRecalc,
  projectReady,
  qtHas,
  qtQV,
  route,
  sealVersion,
  submitBlockers,
  syncProject,
  techComplete,
  verifyVersionChain,
  wfCanOpen,
  wfDone,
} from './utils/enfaEngine.ts';
import { buildPrintableNfaHtml } from './utils/printNfa.ts';
import {
  blankTerms,
  createInitialStore,
  createNewNfaRecord,
  DEMO_ERP_PR_LINES,
  migrateStore,
} from './utils/seedDemo.ts';
import { buildQtExcelBytes } from './utils/xlsxExport.ts';

function readInitialLocalStore(): EnfaStore {
  try {
    const raw = localStorage.getItem('enfa_v1');
    if (raw) {
      return migrateStore(JSON.parse(raw) as EnfaStore);
    }
  } catch {
    // ignore storage errors
  }
  return createInitialStore();
}

function readInitialTheme(): ThemeId {
  try {
    const t = localStorage.getItem('enfa_theme');
    if (t === 'slate' || t === 'navy' || t === 'steel') return t;
  } catch {
    // ignore
  }
  return 'slate';
}

function setNestedPath(obj: Record<string, unknown>, path: string, val: unknown): void {
  const keys = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== 'object') {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = val;
}

function getNestedPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

export default function App() {
  const [store, setStore] = useState<EnfaStore>(() => readInitialLocalStore());
  const [theme, setTheme] = useState<ThemeId>(() => readInitialTheme());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [vendorOfferPhase, setVendorOfferPhase] = useState<VendorOfferPhase>('quote');
  const [verifyState, setVerifyState] = useState<{
    nfaId: string;
    res: Record<string, boolean | null>;
  } | null>(null);

  const hydratedRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);

  // Apply theme attribute & persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('enfa_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Initial server hydration
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/enfa/state', { headers: { Accept: 'application/json' } });
        if (!active) return;
        if (res.status === 200) {
          const serverData = (await res.json()) as EnfaStore;
          const localRaw = localStorage.getItem('enfa_v1');
          if (!localRaw && serverData && serverData.nfas) {
            setStore(migrateStore(serverData));
          }
        }
      } catch {
        // Server sync optional on startup; local state already loaded
      } finally {
        hydratedRef.current = true;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Persist store to localStorage and debounced server endpoint
  useEffect(() => {
    try {
      localStorage.setItem('enfa_v1', JSON.stringify(store));
    } catch {
      // ignore quota errors
    }
    if (!hydratedRef.current) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      fetch('/api/enfa/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      }).catch(() => {
        // ignore offline errors
      });
    }, 400);
  }, [store]);

  const toast = useCallback((msg: string, kind?: 'ok' | 'err' | 'info') => {
    const resolvedKind: 'ok' | 'err' | 'info' =
      kind ||
      (/(blocked|cannot|must|missing|failed|required|only |not allowed|locked|correct|complete |enter |select |submit .* first|exceed)/i.test(
        msg
      )
        ? 'err'
        : 'info');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, msg, kind: resolvedKind }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      resolvedKind === 'err' ? 9000 : 4500
    );
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const uiConfirm = useCallback(
    (
      body: string,
      opts: { title?: string; okLabel?: string; cancelLabel?: string | false; danger?: boolean } = {}
    ) =>
      new Promise<boolean>((resolve) => {
        setDialog({
          title: opts.title || 'Please confirm',
          body,
          okLabel: opts.okLabel || 'OK',
          cancelLabel: opts.cancelLabel ?? 'Cancel',
          danger: opts.danger,
          resolve: (v) => resolve(Boolean(v)),
        });
      }),
    []
  );

  const uiPrompt = useCallback(
    (title: string, placeholder = 'Enter reason...') =>
      new Promise<string | null>((resolve) => {
        setDialog({
          title,
          input: true,
          placeholder,
          okLabel: 'Confirm',
          cancelLabel: 'Cancel',
          resolve: (v) => resolve(typeof v === 'string' ? v : null),
        });
      }),
    []
  );

  const uiHtmlDialog = useCallback(
    (title: string, html: React.ReactNode, okLabel = 'Confirm') =>
      new Promise<boolean>((resolve) => {
        setDialog({
          title,
          html,
          okLabel,
          cancelLabel: 'Cancel',
          resolve: (v) => resolve(Boolean(v)),
        });
      }),
    []
  );

  const updateStore = useCallback((mutator: (draft: EnfaStore) => void) => {
    setStore((prev) => {
      const next = clone(prev);
      mutator(next);
      return next;
    });
  }, []);

  // Derive active NFA, version, normalized data, and computed CS
  const activeNfa = useMemo(() => getActiveNfa(store), [store]);
  const activeVer = useMemo(() => {
    const v = clone(getActiveVersion(activeNfa));
    normalizeNfaData(v);
    return v;
  }, [activeNfa]);

  const effectiveTab: TabId = useMemo(() => {
    let tab = store.tab;
    if (
      ['pr', 'hdr', 'quo', 'qtc', 'tech', 'trm', 'cs', 'nfa', 'apr', 'ver'].includes(tab) &&
      !projectReady(activeVer)
    ) {
      return 'proj';
    }
    if (!wfCanOpen(activeVer, tab)) {
      const idx = WF_ORDER.indexOf(tab as StageId);
      return idx > 0 ? WF_ORDER[idx - 1] : 'proj';
    }
    return tab;
  }, [store.tab, activeVer]);

  const calcResult = useMemo(
    () => calc(activeVer.data, store.doa),
    [activeVer.data, store.doa]
  );

  const storageKB = useMemo(() => {
    try {
      return Math.round(JSON.stringify(store).length / 1024);
    } catch {
      return 0;
    }
  }, [store]);

  const handleGoTab = useCallback(
    (k: TabId) => {
      if (['port', 'data'].includes(k)) {
        updateStore((s) => {
          s.tab = k;
        });
        return;
      }
      if (!wfCanOpen(activeVer, k)) {
        const idx = WF_ORDER.indexOf(k as StageId);
        const prev = k === 'apr' ? 'nfa' : WF_ORDER[Math.max(0, idx - 1)];
        const prevLabel = STAGE_META[prev]?.[0] || prev.toUpperCase();
        toast(
          `This step is locked. First submit: ${prevLabel} (open it from the step bar and click its Submit button).`,
          'err'
        );
        return;
      }
      if (
        ['pr', 'hdr', 'quo', 'qtc', 'tech', 'trm', 'cs', 'nfa', 'apr', 'ver'].includes(k) &&
        !projectReady(activeVer)
      ) {
        toast('Complete the required sourcing project details first.', 'err');
        updateStore((s) => {
          s.tab = 'proj';
        });
        return;
      }
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        normalizeNfaData(v);
        if (k === 'hdr' && projectReady(v) && v.status === 'Draft' && s.role === 'Buyer') {
          syncProject(v.data);
        }
        s.tab = k;
      });
    },
    [activeVer, toast, updateStore]
  );

  const handleNewNfa = useCallback(() => {
    updateStore((s) => {
      const seq = ++s.seq;
      const rec = createNewNfaRecord(seq, s.role);
      s.nfas[rec.id] = rec;
      s.cur = rec.id;
      s.tab = 'proj';
    });
    toast('New NFA created — start with the Sourcing Project', 'ok');
  }, [toast, updateStore]);

  const handleFieldChange = useCallback(
    (path: string, val: string | number) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        normalizeNfaData(v);
        if (!canEditPath(v, s.role, path)) return;

        const d = v.data;
        const z = path.split('.');
        const previous = getNestedPath(d, path);
        if (String(previous ?? '') === String(val ?? '')) return;

        if (/^items\.\d+\.r\.\d+\.n$/.test(path)) {
          const itemIdx = Number(z[1]);
          const vendorIdx = Number(z[3]);
          const cell = d.items[itemIdx]?.r?.[vendorIdx];
          if (cell?.regret || num(cell?.q) == null || !isOkForLine(d, d.vendors[vendorIdx], itemIdx)) {
            return;
          }
        }

        if (z[0] === 'nfa' && z[1] === 'ov' && String(previous ?? '') !== String(val ?? '')) {
          setNestedPath(d as unknown as Record<string, unknown>, `nfa.ovr.${z[2]}`, '');
        }

        setNestedPath(d as unknown as Record<string, unknown>, path, val);

        if (/^items\.\d+\.r\.\d+\.q$/.test(path) && (num(val) || 0) > 0) {
          const itemIdx = Number(z[1]);
          const vendorIdx = Number(z[3]);
          const cell = d.items[itemIdx]?.r?.[vendorIdx];
          if (cell?.regret) {
            cell.regret = false;
            cell.regretReason = '';
          }
        }

        if (z[0] === 'vendors' && z[2] === 'terms' && z[3] === 'cur') {
          const j = Number(z[1]);
          const t = d.vendors[j].terms;
          const base = d.header.cur || 'INR';
          if (val === base) {
            t.fxRate = 1;
            t.fxDate = '';
            t.fxSource = 'Not applicable – base currency';
          } else {
            if (Number(t.fxRate) === 1) t.fxRate = '';
            if (/^Not applicable/.test(t.fxSource || '')) t.fxSource = '';
          }
          v.audit.push({
            t: nowIso(),
            u: s.role,
            e: `Quote currency for ${d.vendors[j].name || `Vendor ${j + 1}`} set to ${val || '—'}`,
          });
        }

        invalidateForPath(d, path);

        if (z[0] === 'vendors' && z[2] === 'techEval') {
          const j = Number(z[1]);
          const vd = d.vendors[j];
          if (vd?.techEval) {
            if (vd.techEval.legacy && z[3] !== 'legacy') {
              delete vd.techEval.legacy;
            }
            vd.techEval.submitted = false;
            delete vd.techEval.submittedOn;
            if (z[3] === 'lines' && z[4] != null && vd.techEval.lines?.[z[4]]) {
              vd.techEval.lines[z[4]].submitted = false;
              delete vd.techEval.lines[z[4]].submittedOn;
            }
          }
          if (z[3] === 'status') {
            v.audit.push({
              t: nowIso(),
              u: s.role,
              e: `Technical outcome for ${vd.name || `Vendor ${j + 1}`}: ${val || 'cleared'}`,
            });
          }
        }
      });
    },
    [updateStore]
  );

  // Quotes add / delete vendors & items
  const handleAddVendor = useCallback(() => {
    updateStore((s) => {
      const v = getActiveVersion(getActiveNfa(s));
      normalizeNfaData(v);
      const d = v.data;
      invalidateWorkflow(d, 'quo');
      d.vendors.push({
        name: '',
        code: '',
        ref: '',
        qdate: '',
        fdate: '',
        terms: Object.assign(blankTerms(), { cur: d.header.cur || 'INR', fxRate: 1 }),
        techEval: { evaluator: '', date: '', status: 'Pending', decisionNote: '', criteria: {} },
      });
      d.items.forEach((it) => it.r.push({ q: '', n: '' }));
      if (s.role === 'Vendor') {
        s.activeVendorIdx = d.vendors.length - 1;
      }
    });
  }, [updateStore]);

  const handleDeleteVendor = useCallback(
    async (j: number) => {
      const ok = await uiConfirm('Remove this vendor and all its prices?', {
        danger: true,
        okLabel: 'Remove',
      });
      if (!ok) return;
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        normalizeNfaData(v);
        const d = v.data;
        invalidateWorkflow(d, 'quo');
        const ov = d.nfa.ov || {};
        const next: Record<string, string> = {};
        Object.keys(ov).forEach((i) => {
          if (ov[i] === '' || ov[i] == null) return;
          const x = Number(ov[i]);
          if (x < j) next[i] = String(x);
          else if (x > j) next[i] = String(x - 1);
        });
        v.audit.push({
          t: nowIso(),
          u: s.role,
          e: `Vendor ${j + 1} (${d.vendors[j]?.name || 'unnamed'}) removed`,
        });
        d.vendors.splice(j, 1);
        d.items.forEach((it) => it.r.splice(j, 1));
        d.nfa.ov = next;
      });
    },
    [uiConfirm, updateStore]
  );

  const handleAddItem = useCallback(() => {
    updateStore((s) => {
      const v = getActiveVersion(getActiveNfa(s));
      normalizeNfaData(v);
      const d = v.data;
      invalidateWorkflow(d, 'quo');
      d.items.push({
        code: '',
        desc: '',
        uom: 'NOS',
        qty: 1,
        r: d.vendors.map(() => ({ q: '', n: '' })),
      });
    });
  }, [updateStore]);

  const handleDeleteItem = useCallback(
    async (i: number) => {
      const ok = await uiConfirm('Remove this item?', { danger: true, okLabel: 'Remove' });
      if (!ok) return;
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        normalizeNfaData(v);
        const d = v.data;
        invalidateWorkflow(d, 'quo');
        const shiftMap = <T,>(o?: Record<string, T>) => {
          const n: Record<string, T> = {};
          Object.keys(o || {}).forEach((k) => {
            const x = Number(k);
            if (x < i) n[k] = o![k];
            else if (x > i) n[String(x - 1)] = o![k];
          });
          return n;
        };
        d.items.splice(i, 1);
        d.nfa.ov = shiftMap(d.nfa.ov);
        d.nfa.ovr = shiftMap(d.nfa.ovr);
        d.nfa.lppJ = shiftMap(d.nfa.lppJ);
        d.vendors.forEach((vd) => {
          if (vd.techEval?.lines) vd.techEval.lines = shiftMap(vd.techEval.lines);
        });
        v.audit.push({ t: nowIso(), u: s.role, e: `Item ${i + 1} removed` });
      });
    },
    [uiConfirm, updateStore]
  );

  const handleCopyQuoted = useCallback(
    (j: number) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || (s.role !== 'Buyer' && s.role !== 'Vendor')) return;
        normalizeNfaData(v);
        const d = v.data;
        let count = 0;
        d.items.forEach((it, i) => {
          const r = it.r[j];
          if (
            isOkForLine(d, d.vendors[j], i) &&
            r &&
            !r.regret &&
            num(r.q) != null &&
            num(r.n) == null
          ) {
            r.n = r.q;
            count++;
          }
        });
        if (count) {
          v.audit.push({
            t: nowIso(),
            u: s.role,
            e: `Final price set equal to quoted price (no negotiation) for ${d.vendors[j]?.name} – ${count} line(s)`,
          });
        }
      });
      toast('Quoted prices copied to negotiated prices', 'ok');
    },
    [toast, updateStore]
  );

  const handleChangeQuoteScope = useCallback(
    (vendorIdx: number, scope: 'all' | 'partial') => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || (s.role !== 'Buyer' && s.role !== 'Vendor')) return;
        normalizeNfaData(v);
        const d = v.data;
        const vd = d.vendors[vendorIdx];
        if (!vd) return;
        vd.quoteScope = scope;
        if (scope === 'all') {
          d.items.forEach((it) => {
            if (it.r?.[vendorIdx]) {
              it.r[vendorIdx].regret = false;
              it.r[vendorIdx].regretReason = '';
            }
          });
        }
        invalidateForPath(d, `vendors.${vendorIdx}.quoteScope`);
        v.audit.push({
          t: nowIso(),
          u: s.role,
          e: `Quote scope set to "${scope === 'all' ? 'All items' : 'Partial (Regret items)'}" for ${
            vd.name || `Vendor ${vendorIdx + 1}`
          }`,
        });
      });
      toast(
        scope === 'all'
          ? 'Quote scope set to All items (regret flags cleared).'
          : 'Partial Quote mode enabled — mark unquoted items as Regret.',
        'info'
      );
    },
    [toast, updateStore]
  );

  const handleToggleRegret = useCallback(
    (itemIdx: number, vendorIdx: number, regret: boolean) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || (s.role !== 'Buyer' && s.role !== 'Vendor')) return;
        normalizeNfaData(v);
        const d = v.data;
        const vd = d.vendors[vendorIdx];
        const cell = d.items[itemIdx]?.r?.[vendorIdx];
        if (!vd || !cell) return;
        cell.regret = regret;
        if (regret) {
          cell.q = '';
          cell.n = '';
          vd.quoteScope = 'partial';
        } else {
          cell.regretReason = '';
        }
        invalidateForPath(d, `items.${itemIdx}.r.${vendorIdx}.regret`);
        v.audit.push({
          t: nowIso(),
          u: s.role,
          e: `${regret ? 'Marked Regret' : 'Re-opened for quote'} on Item ${itemIdx + 1} (${
            d.items[itemIdx]?.code || d.items[itemIdx]?.desc || 'item'
          }) for ${vd.name || `Vendor ${vendorIdx + 1}`}`,
        });
      });
    },
    [updateStore]
  );

  const handleApplyDiscount = useCallback(
    (payload: DiscountApplyPayload) => {
      let appliedCount = 0;
      let vendorName = `Vendor ${payload.vendorIdx + 1}`;
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || (s.role !== 'Buyer' && s.role !== 'Vendor')) return;
        normalizeNfaData(v);
        const d = v.data;
        const vd = d.vendors[payload.vendorIdx];
        if (!vd) return;
        vendorName = vd.name || vendorName;
        payload.itemIndices.forEach((itemIdx) => {
          const cell = d.items[itemIdx]?.r?.[payload.vendorIdx];
          const q = num(cell?.q);
          const n = num(cell?.n);
          if (!cell || cell.regret || q == null || q <= 0 || !isOkForLine(d, vd, itemIdx)) return;
          const baseRate = payload.basis === 'current' && n != null ? n : q;
          const nextRate = Math.max(
            0.01,
            Math.round(baseRate * (1 - payload.percent / 100) * 100) / 100
          );
          cell.n = nextRate;
          appliedCount++;
        });
        if (appliedCount > 0) {
          invalidateForPath(d, `items.${payload.itemIndices[0]}.r.${payload.vendorIdx}.n`);
          v.audit.push({
            t: nowIso(),
            u: s.role,
            e: `Applied ${payload.percent}% discount off ${
              payload.basis === 'quoted' ? 'initial quoted' : 'current negotiated'
            } rate for ${vendorName} across ${appliedCount} item(s)`,
          });
        }
      });
      if (appliedCount > 0) {
        toast(
          `Applied ${payload.percent}% discount to ${appliedCount} item(s) for ${vendorName}`,
          'ok'
        );
      } else {
        toast('No eligible accepted quoted items matched for discount.', 'info');
      }
    },
    [toast, updateStore]
  );

  const handleChangeRole = useCallback(
    (nextRole: RoleName, preferredVendorIdx?: number) => {
      if (nextRole === 'Vendor') {
        const d = activeVer.data;
        const shouldUseNeg =
          effectiveTab === 'trm' ||
          effectiveTab === 'cs' ||
          effectiveTab === 'nfa' ||
          wfDone(d, 'tech');
        setVendorOfferPhase(shouldUseNeg ? 'negotiation' : 'quote');
        updateStore((s) => {
          if (s.role !== 'Vendor') {
            s.lastInternalTab = effectiveTab;
          }
          s.role = 'Vendor';
          if (preferredVendorIdx != null) {
            s.activeVendorIdx = preferredVendorIdx;
          } else if (s.activeVendorIdx == null) {
            s.activeVendorIdx = 0;
          }
        });
        toast(
          shouldUseNeg
            ? 'Switched to Vendor Portal — Revised / Negotiated Offer view'
            : 'Switched to Vendor Portal — Initial Quotation view',
          'info'
        );
      } else {
        updateStore((s) => {
          const wasVendor = s.role === 'Vendor';
          s.role = nextRole;
          if (wasVendor && s.lastInternalTab) {
            s.tab = s.lastInternalTab;
          }
        });
      }
    },
    [activeVer.data, effectiveTab, toast, updateStore]
  );

  const handleAddVendorAttachment = useCallback(
    (vendorIdx: number, att: VendorAttachment) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || (s.role !== 'Vendor' && s.role !== 'Buyer')) return;
        normalizeNfaData(v);
        const vd = v.data.vendors[vendorIdx];
        if (!vd) return;
        vd.attachments = [...(vd.attachments || []), att];
        v.audit.push({
          t: nowIso(),
          u: s.role,
          e: `Uploaded attachment "${att.name}" for ${vd.name || `Vendor ${vendorIdx + 1}`}`,
        });
      });
      toast(`Attachment added: ${att.name}`, 'ok');
    },
    [toast, updateStore]
  );

  const handleRemoveVendorAttachment = useCallback(
    (vendorIdx: number, attId: string) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || (s.role !== 'Vendor' && s.role !== 'Buyer')) return;
        normalizeNfaData(v);
        const vd = v.data.vendors[vendorIdx];
        if (!vd || !vd.attachments) return;
        const target = vd.attachments.find((x) => x.id === attId);
        vd.attachments = vd.attachments.filter((x) => x.id !== attId);
        if (target) {
          v.audit.push({
            t: nowIso(),
            u: s.role,
            e: `Removed attachment "${target.name}" from ${vd.name || `Vendor ${vendorIdx + 1}`}`,
          });
        }
      });
      toast('Attachment removed', 'info');
    },
    [toast, updateStore]
  );

  const handleSubmitVendorOffer = useCallback(
    (vendorIdx: number, phase: VendorOfferPhase) => {
      const d = activeVer.data;
      if (activeVer.status !== 'Draft') {
        toast('This NFA version is locked.', 'err');
        return;
      }
      const vd = d.vendors[vendorIdx];
      if (!vd) return;

      if (phase === 'quote') {
        if (!String(vd.name || '').trim()) {
          toast('Enter your Vendor Name before submitting.', 'err');
          return;
        }
        if (!String(vd.ref || '').trim()) {
          toast('Enter your Quotation Reference before submitting.', 'err');
          return;
        }
        const scope =
          vd.quoteScope || (d.items.some((it) => it.r?.[vendorIdx]?.regret) ? 'partial' : 'all');
        const hasAnyRate = d.items.some(
          (it) => !it.r?.[vendorIdx]?.regret && (num(it.r?.[vendorIdx]?.q) || 0) > 0
        );
        if (!hasAnyRate) {
          toast('Enter at least one unit rate (> 0) before submitting your quotation.', 'err');
          return;
        }
        if (scope === 'all') {
          const unquotedAll = d.items.filter(
            (it) => it.r?.[vendorIdx]?.regret || !((num(it.r?.[vendorIdx]?.q) || 0) > 0)
          );
          if (unquotedAll.length) {
            toast(
              `Quote Scope is set to All items — enter rates for all ${d.items.length} items or switch to Partial Quote (Regret Specific Items).`,
              'err'
            );
            return;
          }
        } else {
          const undecided = d.items.filter(
            (it) => !it.r?.[vendorIdx]?.regret && !((num(it.r?.[vendorIdx]?.q) || 0) > 0)
          );
          if (undecided.length) {
            toast(
              `${undecided.length} item(s) have neither a unit rate nor Regret marked. Complete or mark Regret before submitting.`,
              'err'
            );
            return;
          }
        }
        const cur = vd.terms?.cur || d.header.cur;
        if (
          cur !== d.header.cur &&
          (!((num(vd.terms?.fxRate) || 0) > 0) ||
            !vd.terms?.fxDate ||
            !String(vd.terms?.fxSource || '').trim())
        ) {
          toast(`Foreign currency (${cur}): complete FX rate, date, and source.`, 'err');
          return;
        }
        const missingTerms = QT_REQ.filter((k) => !qtHas(vd.qterms?.[k])).map(
          (k) => TERMS.find((t) => t[0] === k)?.[1] || k
        );
        if (missingTerms.length) {
          toast(`Complete mandatory quoted terms: ${missingTerms.join(', ')}`, 'err');
          return;
        }

        updateStore((s) => {
          const v = getActiveVersion(getActiveNfa(s));
          normalizeNfaData(v);
          const targetV = v.data.vendors[vendorIdx];
          if (!targetV) return;
          targetV.terms = targetV.terms || blankTerms();
          QT_KEYS().forEach((k) => {
            if (k === 'reg' && !qtHas(targetV.qterms?.[k])) return;
            if (!targetV.termsNeg || !qtHas(targetV.terms[k])) {
              targetV.terms[k] = targetV.qterms?.[k] ?? '';
            }
          });
          targetV.quoteSubmittedAt = nowIso();
          v.audit.push({
            t: targetV.quoteSubmittedAt,
            u: s.role,
            e: `Vendor quotation submitted via Vendor Portal by ${targetV.name} (Ref: ${targetV.ref})`,
          });
        });
        toast(`Quotation submitted for ${vd.name}`, 'ok');
      } else {
        const acceptedQuoted = d.items.filter(
          (it, i) => isOkForLine(d, vd, i) && num(it.r?.[vendorIdx]?.q) != null
        );
        if (!acceptedQuoted.length) {
          toast('No technically accepted quoted lines are available for revised offer entry.', 'err');
          return;
        }
        const missingNeg = acceptedQuoted.filter((it) => num(it.r?.[vendorIdx]?.n) == null);
        if (missingNeg.length) {
          toast(
            `${missingNeg.length} accepted line(s) still need a revised unit rate (or click Copy Initial Quote → Revised).`,
            'err'
          );
          return;
        }
        const overQuoted = acceptedQuoted.filter(
          (it) => Number(num(it.r?.[vendorIdx]?.n)) > Number(num(it.r?.[vendorIdx]?.q))
        );
        if (overQuoted.length) {
          toast('Revised offer rate cannot exceed initial quoted rate.', 'err');
          return;
        }

        updateStore((s) => {
          const v = getActiveVersion(getActiveNfa(s));
          normalizeNfaData(v);
          const targetV = v.data.vendors[vendorIdx];
          if (!targetV) return;
          targetV.negSubmittedAt = nowIso();
          v.audit.push({
            t: targetV.negSubmittedAt,
            u: s.role,
            e: `Revised / negotiated offer submitted via Vendor Portal by ${targetV.name}`,
          });
        });
        toast(`Revised offer submitted for ${vd.name}`, 'ok');
      }
    },
    [activeVer, toast, updateStore]
  );

  // PR Details handlers
  const handleAddManualPR = useCallback(
    (copyFrom: boolean) => {
      if (activeVer.status !== 'Draft' || store.role !== 'Buyer') {
        toast('Only the Buyer can add PR lines in Draft status.', 'err');
        return;
      }
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        normalizeNfaData(v);
        const d = v.data;
        d.erp.mode = 'manual';
        const last = copyFrom ? d.erp.prLines[d.erp.prLines.length - 1] : null;
        const l: PrLine = {
          prLineId: prNewId(),
          approvalStatus: 'Approved',
          lineStatus: 'Open',
          source: 'Manual',
          prNumber: '',
          prLineNumber: '',
          prDate: '',
          companyCode: '',
          plantCode: '',
          plantName: '',
          departmentName: '',
          requesterName: '',
          budgetCode: '',
          itemCode: '',
          itemDescription: '',
          itemLongDescription: '',
          uomCode: '',
          requestedQty: '',
          previouslySourcedQty: 0,
          openQty: 0,
          needByDate: '',
          category: '',
          specDocRef: '',
        };
        if (last) {
          const keys = [
            'prNumber',
            'prDate',
            'companyCode',
            'plantCode',
            'plantName',
            'departmentName',
            'requesterName',
            'budgetCode',
            'needByDate',
            'category',
          ] as const;
          keys.forEach((k) => {
            l[k] = last[k] ?? '';
          });
          const n = parseInt(last.prLineNumber, 10);
          if (Number.isFinite(n)) l.prLineNumber = String(n + 10);
        }
        prRecalc(l);
        d.erp.prLines.push(l);
        d.erp.selectionApplied = false;
        invalidateWorkflow(d, 'pr');
      });
    },
    [activeVer.status, store.role, toast, updateStore]
  );

  const handleSetPRField = useCallback(
    (id: string, key: string, rawVal: string) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || s.role !== 'Buyer') return;
        normalizeNfaData(v);
        const d = v.data;
        const l = d.erp.prLines.find((x) => prLineKey(x) === id);
        if (!l) return;
        l[key] = PR_NUM.includes(key)
          ? prNum(rawVal)
          : PR_DATE.includes(key)
          ? prNormDate(rawVal)
          : String(rawVal).trim();
        prRecalc(l);
        const sel = d.erp.selected[id];
        if (sel && PR_NUM.includes(key)) sel.selectedQty = l.openQty;
        if (sel && prLineIssues(l, d.erp.prLines).length) sel.selected = false;
        d.erp.selectionApplied = false;
        invalidateWorkflow(d, 'pr');
      });
    },
    [updateStore]
  );

  const handleDeletePRLine = useCallback(
    async (id: string) => {
      const ok = await uiConfirm('Delete this PR line?', { danger: true, okLabel: 'Delete' });
      if (!ok) return;
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || s.role !== 'Buyer') return;
        normalizeNfaData(v);
        const d = v.data;
        d.erp.prLines = d.erp.prLines.filter((x) => prLineKey(x) !== id);
        delete d.erp.selected[id];
        d.erp.selectionApplied = false;
        invalidateWorkflow(d, 'pr');
      });
    },
    [uiConfirm, updateStore]
  );

  const handleSelectPRLine = useCallback(
    (id: string, checked: boolean) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || s.role !== 'Buyer') return;
        normalizeNfaData(v);
        const d = v.data;
        const l = d.erp.prLines.find((x) => prLineKey(x) === id);
        if (!l) return;
        d.erp.selected[id] = d.erp.selected[id] || {
          selected: false,
          selectedQty: Number(l.openQty) || 0,
        };
        d.erp.selected[id].selected = checked;
        d.erp.selectionApplied = false;
        d.erp.reservationId = null;
        invalidateWorkflow(d, 'pr');
      });
    },
    [updateStore]
  );

  const handleSelectAllValidPR = useCallback(
    (on: boolean) => {
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || s.role !== 'Buyer') return;
        normalizeNfaData(v);
        const d = v.data;
        d.erp.prLines.forEach((l) => {
          const id = prLineKey(l);
          if (on && prLineIssues(l, d.erp.prLines).length) return;
          d.erp.selected[id] = d.erp.selected[id] || {
            selected: false,
            selectedQty: Number(l.openQty) || 0,
          };
          d.erp.selected[id].selected = on;
        });
        d.erp.selectionApplied = false;
        invalidateWorkflow(d, 'pr');
      });
    },
    [updateStore]
  );

  const handleSetPRSelectedQty = useCallback(
    (id: string, val: string) => {
      const l = activeVer.data.erp.prLines.find((x) => prLineKey(x) === id);
      if (!l) return;
      const qty = Number(val);
      if (!Number.isFinite(qty) || qty <= 0 || qty > Number(l.openQty)) {
        toast(
          `Selected quantity must be greater than zero and cannot exceed current open quantity (${l.openQty} ${l.uomCode}).`,
          'err'
        );
        return;
      }
      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        if (v.status !== 'Draft' || s.role !== 'Buyer') return;
        normalizeNfaData(v);
        const d = v.data;
        d.erp.selected[id] = d.erp.selected[id] || { selected: false, selectedQty: qty };
        d.erp.selected[id].selectedQty = qty;
        d.erp.selectionApplied = false;
        d.erp.reservationId = null;
        invalidateWorkflow(d, 'pr');
      });
    },
    [activeVer.data.erp.prLines, toast, updateStore]
  );

  const handleDownloadPRTemplate = useCallback((withSample: boolean) => {
    const csvText = '\uFEFF' + (withSample ? '' : '');
    void csvText;
    // Use existing prTemplateCSV from engine
    import('./utils/enfaEngine.ts').then(({ prTemplateCSV }) => {
      downloadBlob(
        withSample ? 'eNFA_PR_Upload_Template_with_example.csv' : 'eNFA_PR_Upload_Template.csv',
        '\uFEFF' + prTemplateCSV(withSample),
        'text/csv;charset=utf-8'
      );
    });
  }, []);

  const handleExportPRLines = useCallback(() => {
    const d = activeVer.data;
    const content = [
      PR_COLS.map((c) => c[1]).join(','),
      ...d.erp.prLines.map((l) => PR_COLS.map((c) => csvCell(l[c[0]])).join(',')),
    ].join('\r\n') + '\r\n';
    downloadBlob(
      `PR_lines_${(activeNfa.no || 'NFA').replace(/\W+/g, '_')}.csv`,
      '\uFEFF' + content,
      'text/csv;charset=utf-8'
    );
  }, [activeNfa.no, activeVer.data]);

  const handleLoadDemoPRs = useCallback(() => {
    if (activeVer.status !== 'Draft' || store.role !== 'Buyer') {
      toast('Only the Buyer can import PR lines in Draft status.', 'err');
      return;
    }
    updateStore((s) => {
      const v = getActiveVersion(getActiveNfa(s));
      normalizeNfaData(v);
      const d = v.data;
      d.erp.mode = 'demo';
      d.erp.prLines = clone(DEMO_ERP_PR_LINES).map((l) => {
        l.specDocRef = (l.documents || []).map((x) => x.documentName).join('; ');
        return l;
      });
      d.erp.selected = {};
      d.erp.selectionApplied = false;
      d.erp.reservationId = null;
      d.erp.pageInfo = { page: 1, pageSize: 3, total: 3 };
      d.erp.lastSync = nowIso();
      invalidateWorkflow(d, 'pr');
      v.audit.push({
        t: nowIso(),
        u: s.role,
        e: 'Loaded clearly labelled DEMO PR records for interface testing; no ERP reservation created.',
      });
    });
  }, [activeVer.status, store.role, toast, updateStore]);

  const handleImportCSV = useCallback(
    (text: string, fileName: string) => {
      if (activeVer.status !== 'Draft' || store.role !== 'Buyer') {
        toast('Only the Buyer can upload PR lines in Draft status.', 'err');
        return;
      }
      const rows = csvParse(text);
      if (rows.length < 2) {
        toast('The CSV has no data rows. Use the template: header row + one row per PR line.', 'err');
        return;
      }
      const keyNorm = (x: string) => String(x).toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9]/g, '');
      const alias: Record<string, string> = {
        prno: 'prnumber',
        prnum: 'prnumber',
        prline: 'prline',
        linenumber: 'prline',
        line: 'prline',
        status: 'prapprovalstatus',
        approvalstatus: 'prapprovalstatus',
        plant: 'plantname',
        dept: 'department',
        itemdesc: 'itemdescription',
        description: 'itemdescription',
        specification: 'specificationlongtext',
        longtext: 'specificationlongtext',
        uomcode: 'uom',
        qty: 'prqty',
        quantity: 'prqty',
        requestedqty: 'prqty',
        sourcedqty: 'alreadysourcedqty',
        needby: 'needbydate',
        specdoc: 'specdocumentref',
        documentref: 'specdocumentref',
      };
      const hdr = rows[0].map((h) => {
        const k = keyNorm(h);
        return alias[k] || k;
      });
      const map: Record<string, number> = {};
      PR_COLS.forEach(([f, h]) => {
        const i = hdr.indexOf(keyNorm(h));
        if (i >= 0) map[f] = i;
      });
      const missingCols = PR_COLS.filter((c) => c[2] && map[c[0]] == null).map((c) => c[1]);
      if (missingCols.length) {
        toast(
          `CSV header is missing mandatory column(s): ${missingCols.join(', ')}. Download the template and keep the header row unchanged.`,
          'err'
        );
        return;
      }

      const existing = activeVer.data.erp.prLines || [];
      const parsed: { l: PrLine; row: number }[] = [];
      const errors: string[] = [];
      rows.slice(1).forEach((r, ri) => {
        const l: PrLine = {
          prLineId: prNewId() + ri,
          prNumber: '',
          prLineNumber: '',
          approvalStatus: 'Approved',
          lineStatus: 'Open',
          itemCode: '',
          itemDescription: '',
          uomCode: '',
          requestedQty: '',
          previouslySourcedQty: 0,
          openQty: 0,
          source: `CSV: ${fileName || 'upload'}`,
        };
        PR_COLS.forEach(([f]) => {
          const raw = map[f] == null ? '' : String(r[map[f]] ?? '').trim();
          l[f] = PR_NUM.includes(f) ? prNum(raw) : PR_DATE.includes(f) ? prNormDate(raw) : raw;
        });
        if (l.previouslySourcedQty === '') l.previouslySourcedQty = 0;
        const st = String(l.approvalStatus || '').toLowerCase();
        l.approvalStatus = st.startsWith('approv')
          ? 'Approved'
          : st.startsWith('pend')
          ? 'Pending Approval'
          : st.startsWith('rej')
          ? 'Rejected'
          : st.startsWith('clos')
          ? 'Closed'
          : l.approvalStatus;
        prRecalc(l);
        parsed.push({ l, row: ri + 2 });
      });

      const all = [...existing, ...parsed.map((x) => x.l)];
      parsed.forEach(({ l, row }) => {
        const e = prLineIssues(l, all);
        if (e.length) {
          errors.push(`Row ${row} (${l.prNumber || '?'} / ${l.prLineNumber || '?'}): ${e.join('; ')}`);
        }
      });

      if (errors.length) {
        updateStore((s) => {
          const v = getActiveVersion(getActiveNfa(s));
          v.data.erp.importLog = {
            at: nowIso(),
            file: fileName,
            ok: false,
            rows: parsed.length,
            errors,
          };
        });
        toast(`CSV not imported – ${errors.length} row(s) have errors. Check list on screen.`, 'err');
        return;
      }

      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        normalizeNfaData(v);
        const d = v.data;
        d.erp.mode = 'manual';
        parsed.forEach(({ l }) => {
          d.erp.prLines.push(l);
          d.erp.selected[l.prLineId] = { selected: true, selectedQty: l.openQty };
        });
        d.erp.selectionApplied = false;
        d.erp.importLog = { at: nowIso(), file: fileName, ok: true, rows: parsed.length, errors: [] };
        invalidateWorkflow(d, 'pr');
        v.audit.push({
          t: nowIso(),
          u: s.role,
          e: `Uploaded ${parsed.length} PR line(s) from CSV ${fileName || ''} (${[
            ...new Set(parsed.map((x) => x.l.prNumber)),
          ].join(', ')})`,
        });
      });
      toast(`${parsed.length} PR line(s) imported and selected — review, then click Apply`, 'ok');
    },
    [activeVer.data.erp.prLines, activeVer.status, store.role, toast, updateStore]
  );

  const handleApplySelectedPRs = useCallback(() => {
    if (activeVer.status !== 'Draft' || store.role !== 'Buyer') {
      toast('Only the Buyer can apply PR lines in Draft status.', 'err');
      return;
    }
    const d0 = activeVer.data;
    const chosen = d0.erp.prLines.filter((l) => d0.erp.selected[prLineKey(l)]?.selected);
    if (!chosen.length) {
      toast('Select at least one approved PR line.', 'err');
      return;
    }
    const inval = chosen.filter((l) => prLineIssues(l, d0.erp.prLines).length > 0);
    if (inval.length) {
      toast(
        `Correct the highlighted PR line(s) before applying: ${inval
          .map((l) => `${l.prNumber || '?'} / ${l.prLineNumber || '?'}`)
          .join(', ')}`,
        'err'
      );
      return;
    }
    const bad = chosen.filter((l) => {
      const q = Number(d0.erp.selected[prLineKey(l)]?.selectedQty);
      return l.approvalStatus !== 'Approved' || l.lineStatus !== 'Open' || !(q > 0) || q > Number(l.openQty);
    });
    if (bad.length) {
      toast(
        `Correct eligibility / quantities for: ${bad.map((l) => `${l.prNumber} / ${l.prLineNumber}`).join(', ')}`,
        'err'
      );
      return;
    }

    updateStore((s) => {
      const v = getActiveVersion(getActiveNfa(s));
      normalizeNfaData(v);
      const d = v.data;
      const linesChosen = d.erp.prLines.filter((l) => d.erp.selected[prLineKey(l)]?.selected);
      d.items = linesChosen.map((l) => {
        const q = Number(d.erp.selected[prLineKey(l)].selectedQty);
        return {
          code: l.itemCode,
          desc: l.itemDescription + (l.itemLongDescription ? `\n${l.itemLongDescription}` : ''),
          uom: l.uomCode,
          qty: q,
          r: d.vendors.map(() => ({ q: '', n: '' })),
          erpSource: {
            companyCode: l.companyCode,
            prId: l.prId,
            prLineId: prLineKey(l),
            prNumber: l.prNumber,
            prLineNumber: l.prLineNumber,
            prDate: l.prDate,
            plantCode: l.plantCode,
            plantName: l.plantName,
            departmentCode: l.departmentCode,
            departmentName: l.departmentName,
            budgetCode: l.budgetCode,
            selectedQty: q,
            requestedQty: l.requestedQty,
            openQty: l.openQty,
            sourceRowVersion: l.sourceRowVersion,
            lastModifiedAt: l.lastModifiedAt,
            snapshot: clone(l),
            documents: clone(l.documents || []),
          },
        };
      });
      const prNums = [...new Set(linesChosen.map((l) => l.prNumber))];
      const plants = [...new Set(linesChosen.map((l) => l.plantName || l.plantCode || ''))].filter(Boolean);
      const depts = [...new Set(linesChosen.map((l) => l.departmentName || l.departmentCode || '').filter(Boolean))];
      const budgets = [...new Set(linesChosen.map((l) => l.budgetCode || '').filter(Boolean))];
      const dates = linesChosen.map((l) => l.prDate || '').filter(Boolean).sort();
      const need = linesChosen.map((l) => l.needByDate || '').filter(Boolean).sort();

      d.header.prNo = prNums.join(', ');
      d.header.prDate = dates[0] || d.header.prDate;
      d.header.plant = plants.length === 1 ? plants[0] : 'Multiple plants — see PR allocation';
      d.header.dept =
        depts.length === 1 ? depts[0] : depts.length ? 'Multiple departments — see PR allocation' : d.header.dept;
      d.header.budgetCode =
        budgets.length === 1 ? budgets[0] : budgets.length ? 'Multiple budgets — see PR allocation' : d.header.budgetCode;
      d.header.needBy = need[0] || d.header.needBy;
      d.header.desc = `Sourcing of ${linesChosen.length} selected PR line(s) across ${prNums.length} PR(s). Refer to the PR allocation register for line-level requirement and plant details.`;

      d.erp.selectionApplied = true;
      d.erp.appliedAt = nowIso();
      d.erp.appliedLines = linesChosen.map((l) => ({
        prLineId: prLineKey(l),
        prNumber: l.prNumber,
        prLineNumber: l.prLineNumber,
        itemCode: l.itemCode,
        selectedQty: Number(d.erp.selected[prLineKey(l)].selectedQty),
        uomCode: l.uomCode,
        plantCode: l.plantCode,
        plantName: l.plantName,
        documents: clone(l.documents || []),
      }));
      invalidateWorkflow(d, 'pr');
      v.audit.push({
        t: nowIso(),
        u: s.role,
        e: `Applied ${linesChosen.length} approved PR line(s) to RFQ items: ${d.erp.appliedLines
          .map((x) => `${x.prNumber}/${x.prLineNumber} Qty ${x.selectedQty} ${x.uomCode}`)
          .join('; ')}`,
      });
    });
    toast(`${chosen.length} PR line(s) applied to RFQ`, 'ok');
  }, [activeVer, store.role, toast, updateStore]);

  // Stage submit validation & progression
  const handleSubmitStage = useCallback(
    (stage: StageId) => {
      const d = activeVer.data;
      const c = calcResult;
      if (activeVer.status !== 'Draft') {
        toast('This NFA version is locked.', 'err');
        return;
      }
      if (store.role !== 'Buyer') {
        toast('Only Buyer can submit this stage.', 'err');
        return;
      }

      if (stage === 'proj') {
        if (!projectReady(activeVer)) {
          toast('Complete all mandatory sourcing project fields before submission.', 'err');
          return;
        }
      } else if (stage === 'pr') {
        if (!wfDone(d, 'proj')) {
          toast('Submit the Sourcing Project first.', 'err');
          return;
        }
        if (!d.erp.selectionApplied || !d.erp.appliedLines?.length) {
          toast(
            'Enter or upload PR lines, tick the lines to source and click Apply Selected PR Lines to RFQ.',
            'err'
          );
          return;
        }
        const selected = d.erp.prLines.filter((l) => d.erp.selected[prLineKey(l)]?.selected);
        if (selected.length !== d.erp.appliedLines.length) {
          toast(
            'PR selection changed after application. Click Apply Selected PR Lines to RFQ again.',
            'err'
          );
          return;
        }
        const bad = selected.filter((l) => {
          const q = Number(d.erp.selected[prLineKey(l)]?.selectedQty);
          return (
            l.approvalStatus !== 'Approved' ||
            l.lineStatus !== 'Open' ||
            !(q > 0) ||
            q > Number(l.openQty)
          );
        });
        if (bad.length || selected.some((l) => prLineIssues(l, d.erp.prLines).length > 0)) {
          toast(
            'PR line data or open quantity changed. Correct the lines and Apply again before submitting.',
            'err'
          );
          return;
        }
      } else if (stage === 'hdr') {
        if (!wfDone(d, 'pr')) {
          toast('Submit PR Details first.', 'err');
          return;
        }
        const hRec = d.header as unknown as Record<string, unknown>;
        const missing = HDR_FIELDS.filter((f) => f[3] && (hRec[f[0]] === '' || hRec[f[0]] == null));
        if (missing.length) {
          toast(`Complete mandatory RFQ Header fields: ${missing.map((f) => f[1]).join(', ')}`, 'err');
          return;
        }
        if (
          d.header.cur !== 'INR' &&
          (!((num(d.header.inrRate) || 0) > 0) ||
            !d.header.inrRateDate ||
            !String(d.header.inrRateSrc || '').trim())
        ) {
          toast('Enter INR conversion rate, date and source for DoA routing.', 'err');
          return;
        }
      } else if (stage === 'quo') {
        if (!wfDone(d, 'hdr')) {
          toast('Submit the RFQ Header first.', 'err');
          return;
        }
        const named = d.vendors.filter((v) => String(v.name || '').trim());
        if (!named.length) {
          toast('Add at least one vendor.', 'err');
          return;
        }
        const missingRefs = named.filter((v) => !String(v.ref || '').trim());
        if (missingRefs.length) {
          toast(`Enter quotation references for: ${missingRefs.map((v) => v.name).join(', ')}`, 'err');
          return;
        }
        const badItems = d.items
          .map((it, i) => ({ it, i }))
          .filter(
            (x) =>
              !String(x.it.code || '').trim() ||
              !String(x.it.desc || '').trim() ||
              !(Number(x.it.qty) > 0)
          );
        if (badItems.length) {
          toast(
            `Complete item code, description and quantity for item(s): ${badItems
              .map((x) => x.i + 1)
              .join(', ')}`,
            'err'
          );
          return;
        }
        const noQuote = d.items
          .map((it, i) => ({ it, i }))
          .filter(
            ({ it }) =>
              !it.r.some((r, j) => d.vendors[j]?.name && !r.regret && (num(r.q) || 0) > 0)
          );
        if (noQuote.length) {
          toast(
            `At least one valid non-regretted vendor quotation is required for item(s): ${noQuote
              .map((x) => x.i + 1)
              .join(', ')}`,
            'err'
          );
          return;
        }
        const quotedV = named.filter((v) => {
          const vIdx = d.vendors.indexOf(v);
          return d.items.some((it) => !it.r[vIdx]?.regret && num(it.r[vIdx]?.q) != null);
        });
        const badScopeVendors = quotedV.filter((v) => {
          const vIdx = d.vendors.indexOf(v);
          const sc = v.quoteScope || (d.items.some((it) => it.r[vIdx]?.regret) ? 'partial' : 'all');
          if (sc === 'all') {
            return d.items.some((it) => !it.r[vIdx]?.regret && num(it.r[vIdx]?.q) == null);
          }
          return d.items.some((it) => !it.r[vIdx]?.regret && !((num(it.r[vIdx]?.q) || 0) > 0));
        });
        if (badScopeVendors.length) {
          toast(
            `Complete missing item rates or mark items as Regret (or set Quote Scope to Partial) for: ${badScopeVendors
              .map((v) => v.name)
              .join(', ')}`,
            'err'
          );
          return;
        }
        const noCur = quotedV.filter((v) => !v.terms.cur);
        if (noCur.length) {
          toast(`Select the quote currency for: ${noCur.map((v) => v.name).join(', ')}`, 'err');
          return;
        }
        const badFxQ = quotedV.filter(
          (v) =>
            v.terms.cur !== d.header.cur &&
            (!((num(v.terms.fxRate) || 0) > 0) ||
              !v.terms.fxDate ||
              !String(v.terms.fxSource || '').trim())
        );
        if (badFxQ.length) {
          toast(
            `Foreign-currency quote: enter FX rate to ${d.header.cur}, rate date and source for: ${badFxQ
              .map((v) => `${v.name} (${v.terms.cur})`)
              .join(', ')}`,
            'err'
          );
          return;
        }
      } else if (stage === 'qtc') {
        if (!wfDone(d, 'quo')) {
          toast('Submit Vendor Quotations first.', 'err');
          return;
        }
        const miss: string[] = [];
        qtQV(d).forEach(({ v }) => {
          const q = v.qterms || {};
          const m = QT_REQ.filter((k) => !qtHas(q[k])).map(
            (k) => (TERMS.find((t) => t[0] === k) || [])[1] || k
          );
          if (m.length) miss.push(`${v.name}: ${m.join(', ')}`);
        });
        if (miss.length) {
          toast(
            `Capture the key quoted terms (enter 0 where the vendor asks no advance):\n${miss.join(
              '\n'
            )}`,
            'err'
          );
          return;
        }
      } else if (stage === 'trm') {
        if (!wfDone(d, 'tech')) {
          toast('Submit Technical Evaluation first.', 'err');
          return;
        }
        if (!d.items.some((_it, i) => d.vendors.some((v) => isOkForLine(d, v, i)))) {
          toast(
            'No technically accepted vendor-item lines are available. Review the technical decisions.',
            'err'
          );
          return;
        }
        const missing = c.negMissing.reduce((a, b) => a + b, 0);
        if (missing) {
          toast(
            `${missing} negotiated price line(s) are pending. Complete negotiated prices for all accepted quoted lines.`,
            'err'
          );
          return;
        }
        const bad = d.items.some((it, i) =>
          it.r.some(
            (r, j) =>
              isOkForLine(d, d.vendors[j], i) &&
              num(r.n) != null &&
              num(r.q) != null &&
              Number(r.n) > Number(r.q)
          )
        );
        if (bad) {
          toast(
            'Negotiated prices cannot exceed quoted prices. Correct the highlighted commercial values before submission.',
            'err'
          );
          return;
        }
        const badFx = d.vendors.filter(
          (v) =>
            v.name &&
            d.items.some((_it, i) => isOkForLine(d, v, i)) &&
            (v.terms.cur || d.header.cur) !== d.header.cur &&
            (!((num(v.terms.fxRate) || 0) > 0) ||
              !v.terms.fxDate ||
              !String(v.terms.fxSource || '').trim())
        );
        if (badFx.length) {
          toast(
            `FX details missing (enter on the Quotes stage) for: ${badFx
              .map((v) => v.name)
              .join(', ')}`,
            'err'
          );
          return;
        }
      } else if (stage === 'cs') {
        if (!wfDone(d, 'trm')) {
          toast('Submit Negotiation & Terms first.', 'err');
          return;
        }
        const noL1 = c.rows.filter((r) => r.l1j == null);
        if (noL1.length) {
          toast(
            `Comparative Statement cannot be submitted. No valid L1 price is available for item(s): ${noL1
              .map((r) => r.it.code || r.it.desc)
              .join(', ')}`,
            'err'
          );
          return;
        }
        const noAward = c.aw
          .map((a, i) => ({ a, i }))
          .filter(
            (x) =>
              x.a.landed == null ||
              x.a.j == null ||
              !c.rows[x.i].ranked.some((r) => r.j === x.a.j)
          );
        if (noAward.length) {
          toast(
            `Select a valid eligible ranked award vendor for item(s): ${noAward
              .map((x) => x.i + 1)
              .join(', ')}`,
            'err'
          );
          return;
        }
        const tieOpen = c.aw.map((a, i) => ({ a, i })).filter((x) => x.a.tieOpen);
        if (tieOpen.length) {
          toast(
            `Resolve equal landed-cost rankings by explicitly selecting a vendor for item(s): ${tieOpen
              .map((x) => x.i + 1)
              .join(', ')}`,
            'err'
          );
          return;
        }
        const missingReason = c.aw
          .map((a, i) => ({ a, i }))
          .filter(
            (x) =>
              (x.a.nonL1 || c.rows[x.i].tie) && !String(d.nfa.ovr?.[String(x.i)] || '').trim()
          );
        if (missingReason.length) {
          toast(
            `Enter a mandatory reason for each non-L1 / tied-price selection on item(s): ${missingReason
              .map((x) => x.i + 1)
              .join(', ')}`,
            'err'
          );
          return;
        }
        const lppBad = c.aw.map((a, i) => ({ a, i })).filter((x) => !x.a.lppOk);
        if (lppBad.length) {
          toast(
            `LPP validation failed – CS not submitted:\n${lppBad
              .map(
                (x) =>
                  `Item ${x.i + 1}${
                    x.a.lppUp && x.a.lppPct != null
                      ? ` (▲ +${(x.a.lppPct * 100).toFixed(1)}%)`
                      : ''
                  }: ${x.a.lppIssues.join('; ')}`
              )
              .join('\n')}`,
            'err'
          );
          return;
        }
      }

      updateStore((s) => {
        const v = getActiveVersion(getActiveNfa(s));
        normalizeNfaData(v);
        const dd = v.data;
        if (stage === 'proj') syncProject(dd);
        if (stage === 'pr') dd.erp.reservationStatus = 'Local workspace PR lines applied';
        if (stage === 'quo') {
          const quotedV = dd.vendors.filter(
            (vd) =>
              String(vd.name || '').trim() &&
              dd.items.some((it) => num(it.r[dd.vendors.indexOf(vd)]?.q) != null)
          );
          v.audit.push({
            t: nowIso(),
            u: s.role,
            e: `Quotation currencies captured: ${quotedV
              .map(
                (vd) =>
                  `${vd.name} = ${vd.terms.cur}${
                    vd.terms.cur !== dd.header.cur
                      ? ` @ ${vd.terms.fxRate} ${dd.header.cur} (${vd.terms.fxDate}, ${vd.terms.fxSource})`
                      : ''
                  }`
              )
              .join('; ')}`,
          });
        }
        if (stage === 'qtc') {
          let cp = 0;
          qtQV(dd).forEach(({ v: vd }) => {
            vd.terms = vd.terms || blankTerms();
            QT_KEYS().forEach((k) => {
              if (k === 'reg' && !qtHas(vd.qterms?.[k])) return;
              if (!vd.termsNeg || !qtHas(vd.terms[k])) {
                if (vd.terms[k] !== vd.qterms?.[k]) cp++;
                vd.terms[k] = vd.qterms?.[k] ?? '';
              }
            });
          });
          if (cp) {
            v.audit.push({
              t: nowIso(),
              u: s.role,
              e: `Quoted terms copied as the starting point for negotiated terms (${cp} value(s))`,
            });
          }
        }
        const stageIdx = WF_ORDER.indexOf(stage);
        WF_ORDER.slice(stageIdx + 1).forEach((k) => {
          delete dd.workflow!.submitted[k];
        });
        dd.workflow!.submitted[stage] = { at: nowIso(), by: s.role };
        const cc = calc(dd, s.doa);
        v.audit.push({
          t: nowIso(),
          u: s.role,
          e: `${stage.toUpperCase()} stage submitted by ${s.role}; ${
            stage === 'cs'
              ? `buyer award decisions: ${cc.aw
                  .map(
                    (a, i) =>
                      `Item ${i + 1}=${a.j == null ? 'Unselected' : dd.vendors[a.j].name}${
                        a.nonL1 || cc.rows[i].tie
                          ? ` [Reason: ${dd.nfa.ovr?.[String(i)] || 'Missing'}]`
                          : ''
                      }`
                  )
                  .join('; ')}; LPP: ${cc.aw
                  .map(
                    (a, i) =>
                      `Item ${i + 1}${
                        a.lppNo
                          ? ' first purchase'
                          : a.lppPct == null
                          ? ' n/a'
                          : ` ${a.lppPct >= 0 ? '+' : ''}${(a.lppPct * 100).toFixed(
                              1
                            )}% vs LPP basic rate${a.lppUp ? ` [Justification: ${a.lppJ}]` : ''}`
                      }`
                  )
                  .join('; ')}; `
              : ''
          }next stage: ${WF_NEXT[stage] || 'Approval'}`,
        });
        s.tab = WF_NEXT[stage] || 'apr';
      });
      toast(
        `${STAGE_META[stage]?.[0] || stage} submitted — next: ${
          STAGE_META[WF_NEXT[stage]]?.[0] || 'Approval'
        }`,
        'ok'
      );
    },
    [activeVer, calcResult, store.role, toast, updateStore]
  );

  // Stage 3: Technical Evaluation submission
  const handleSubmitTechEval = useCallback(() => {
    const d = activeVer.data;
    if (activeVer.status !== 'Draft' || store.role !== 'User HOD (Technical)') {
      toast('Only the User HOD (Technical) can submit the technical evaluation in Draft status.', 'err');
      return;
    }
    if (!wfDone(d, 'qtc')) {
      toast('The Buyer must first submit the Quoted Terms stage.', 'err');
      return;
    }
    if (!['Vendor-wise', 'Line-wise'].includes(d.techMode)) {
      toast('Select Vendor-wise or Line-wise evaluation before starting.', 'err');
      return;
    }
    const quoted = d.vendors
      .map((v, j) => ({
        v,
        j,
        items: d.items.map((it, i) => ({ it, i })).filter((x) => num(x.it.r?.[j]?.q) != null),
      }))
      .filter((x) => x.v.name && x.items.length);
    if (!quoted.length) {
      toast('Enter vendor quotations before submitting the technical evaluation.', 'err');
      return;
    }
    const incomplete: string[] = [];
    quoted.forEach(({ v, items }) => {
      if (d.techMode === 'Line-wise') {
        items.forEach(({ it, i }) => {
          if (!lineTechComplete(v.techEval?.lines?.[String(i)])) {
            incomplete.push(`${v.name} — ${it.code || `Item ${i + 1}`}`);
          }
        });
      } else if (!techComplete(v)) {
        incomplete.push(v.name);
      }
    });
    if (incomplete.length) {
      toast(`Complete all required technical evaluations before submitting:\n${incomplete.join('\n')}`, 'err');
      return;
    }

    updateStore((s) => {
      const v = getActiveVersion(getActiveNfa(s));
      normalizeNfaData(v);
      const dd = v.data;
      const ts = nowIso();
      dd.vendors.forEach((vd, j) => {
        const itemsQ = dd.items.map((it, i) => ({ it, i })).filter((x) => num(x.it.r?.[j]?.q) != null);
        if (!vd.name || !itemsQ.length) return;
        vd.techEval = vd.techEval || {
          evaluator: '',
          date: '',
          status: 'Pending',
          decisionNote: '',
          criteria: {},
        };
        if (dd.techMode === 'Line-wise') {
          vd.techEval.lines = vd.techEval.lines || {};
          itemsQ.forEach(({ i }) => {
            if (vd.techEval.lines![String(i)]) {
              vd.techEval.lines![String(i)].submitted = true;
              vd.techEval.lines![String(i)].submittedOn = ts;
            }
          });
        } else {
          vd.techEval.submitted = true;
          vd.techEval.submittedOn = ts;
        }
      });
      dd.workflow!.submitted.tech = { at: ts, by: s.role };
      v.audit.push({
        t: ts,
        u: s.role,
        e: `Technical evaluation submitted (${dd.techMode}) for ${quoted.length} quoted vendor(s); accepted lines released to negotiation and CS.`,
      });
      s.tab = 'trm';
    });
    toast('Technical evaluation submitted — accepted lines released to Negotiation', 'ok');
  }, [activeVer, store.role, toast, updateStore]);

  // Stage 6: Submit NFA for Approval
  const handleSubmitForApproval = useCallback(async () => {
    const list = submitBlockers(activeVer, store.role, store.doa);
    if (list.length) {
      toast(
        `Cannot submit yet — ${list.length} item(s) to fix:\n• ${list
          .slice(0, 6)
          .map((x) => x.t)
          .join('\n• ')}${list.length > 6 ? '\n… see the list above the button' : ''}`,
        'err'
      );
      return false;
    }
    const d = activeVer.data;
    const c = calcResult;
    const ok = await uiHtmlDialog(
      'Submit for approval',
      <div>
        <p>
          <b>
            {activeNfa.no} · {activeVer.ver}
          </b>
          <br />
          Value:{' '}
          <b>
            {d.header.cur} {fmt(c.total, 0, d.header.cur)}
          </b>
          <br />
          Route: {route(c).map((a) => `${a.lv} ${a.role}`).join(' → ')}
        </p>
        <p className="mt-2">After submission the NFA becomes read-only.</p>
      </div>,
      'Submit for approval'
    );
    if (!ok) return false;

    const firstRoute = route(c)[0];
    updateStore((s) => {
      const v = getActiveVersion(getActiveNfa(s));
      normalizeNfaData(v);
      const dd = v.data;
      const cc = calc(dd, s.doa);
      const r = route(cc);
      dd.workflow!.submitted.nfa = { at: nowIso(), by: s.role };
      v.status = 'Pending';
      v.submittedOn = nowIso();
      v.value = cc.total;
      v.valueInr = cc.totalInr;
      v.currency = dd.header.cur;
      v.band = clone(cc.band);
      v.approvals = r;
      v.audit.push({
        t: nowIso(),
        u: s.role,
        e: `Submitted for approval – value ${dd.header.cur} ${fmt(cc.total, 0, dd.header.cur)}${
          cc.inr !== 1 && cc.totalInr != null ? ` (≈ INR ${fmt(cc.totalInr, 0, 'INR')})` : ''
        }; route: ${r.map((a) => a.role).join(' → ')}`,
      });
      s.tab = 'apr';
    });
    toast(
      `Submitted for approval — pending at ${firstRoute.lv} · ${firstRoute.role}`,
      'ok'
    );
    return true;
  }, [activeNfa.no, activeVer, calcResult, store.doa, store.role, toast, uiHtmlDialog, updateStore]);

  // Stage 7: Approval actions with Segregation of Duties + SHA-256 sealing
  const handleActOnApproval = useCallback(
    async (
      kind: 'Approve' | 'Return for Revision' | 'Reject',
      name: string,
      comment: string
    ) => {
      const v = activeVer;
      const a = curLevel(v);
      if (!a) return;
      if (!name) {
        toast('Enter your name & designation.', 'err');
        return;
      }
      if (kind !== 'Approve' && !comment) {
        toast(`Comments are mandatory for ${kind}.`, 'err');
        return;
      }
      const keyNorm = (x: unknown) =>
        String(x || '')
          .split(/[,(–—-]/)[0]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      const me = keyNorm(name);
      if (me.length < 3) {
        toast('Enter your full name (at least 3 letters) and designation.', 'err');
        return;
      }
      const buyers = [v.data.header.buyer, v.data.project?.buyer]
        .map(keyNorm)
        .filter(Boolean);
      if (buyers.includes(me)) {
        toast('Segregation of duties: the Buyer who prepared this NFA cannot approve it.', 'err');
        return;
      }
      const prior = v.approvals
        .filter((x) => x !== a && x.action && x.action !== 'Pending')
        .map((x) => keyNorm(x.name));
      if (prior.includes(me)) {
        toast(
          'Segregation of duties: the same person cannot approve more than one level of this NFA.',
          'err'
        );
        return;
      }

      // Compute updated record & seal asynchronously outside setState
      const nextStore = clone(store);
      const nfaMut = getActiveNfa(nextStore);
      const vMut = getActiveVersion(nfaMut);
      const aMut = curLevel(vMut);
      if (!aMut) return;

      aMut.name = name;
      aMut.action = kind;
      aMut.date = nowIso();
      aMut.comment = comment;
      vMut.audit.push({
        t: nowIso(),
        u: nextStore.role,
        e: `${aMut.lv} ${aMut.role}: ${kind}${comment ? ` – ${comment}` : ''}`,
      });

      let toastMsg = '';
      let toastKind: 'ok' | 'info' = 'info';

      if (kind === 'Reject') {
        vMut.status = 'Rejected';
        vMut.lockedOn = nowIso();
        await sealVersion(nfaMut, vMut);
        vMut.audit.push({ t: nowIso(), u: nextStore.role, e: 'Version REJECTED and LOCKED' });
        toastMsg = `${kind} recorded — version locked`;
      } else if (kind === 'Return for Revision') {
        vMut.status = 'Returned';
        vMut.lockedOn = nowIso();
        await sealVersion(nfaMut, vMut);
        vMut.audit.push({
          t: nowIso(),
          u: nextStore.role,
          e: 'Version RETURNED – frozen; revision required',
        });
        toastMsg = `${kind} recorded — version locked`;
      } else if (!curLevel(vMut)) {
        vMut.status = 'Approved';
        vMut.lockedOn = nowIso();
        await sealVersion(nfaMut, vMut);
        vMut.audit.push({
          t: nowIso(),
          u: nextStore.role,
          e: `FINAL APPROVAL – version LOCKED. SHA-256: ${(vMut.hash || '').slice(0, 16)}…`,
        });
        toastMsg = 'Final approval recorded — version locked & sealed';
        toastKind = 'ok';
      } else {
        toastMsg = `Approved at ${aMut.lv} — routed to next level`;
        toastKind = 'ok';
      }

      setStore(nextStore);
      toast(toastMsg, toastKind);
    },
    [activeVer, store, toast]
  );

  const handleReviseVersion = useCallback(async () => {
    const v = activeVer;
    const promptTitle =
      v.status === 'Approved'
        ? 'Reason for revising an APPROVED NFA (vendor/price/term change):'
        : 'Revision reason / response to approver comments:';
    const reason = await uiPrompt(promptTitle);
    if (!reason) return;

    updateStore((s) => {
      const nfa = getActiveNfa(s);
      const curV = getActiveVersion(nfa);
      const [maj, min] = curV.ver.slice(1).split('.').map(Number);
      const nv = curV.status === 'Approved' ? `V${maj + 1}.0` : `V${maj}.${min + 1}`;
      const priorStatus = curV.status;
      if (curV.status === 'Approved') {
        curV.status = 'Superseded';
        curV.audit.push({
          t: nowIso(),
          u: s.role,
          e: `Superseded by ${nv} (remains locked; PO blocked until re-approval)`,
        });
      }
      const nextData: NfaData = clone(curV.data);
      if (nextData.workflow?.submitted) {
        delete nextData.workflow.submitted.nfa;
      }
      nfa.versions.push({
        ver: nv,
        status: 'Draft',
        createdOn: nowIso(),
        createdBy: s.role,
        reason,
        data: nextData,
        prev: curV.ver,
        returnedFrom: {
          ver: curV.ver,
          status: priorStatus === 'Approved' ? 'Approved' : priorStatus,
          notes: (curV.approvals || [])
            .filter((x) => x.action && x.action !== 'Pending')
            .map((x) => ({
              lv: x.lv,
              role: x.role,
              name: x.name,
              action: x.action,
              comment: x.comment,
              date: x.date,
            })),
        },
        approvals: [],
        audit: [
          {
            t: nowIso(),
            u: s.role,
            e: `${nv} created from ${curV.ver}: ${reason}`,
          },
        ],
      });
      const latestV = getActiveVersion(nfa);
      normalizeNfaData(latestV);
      s.tab = projectReady(latestV) ? 'hdr' : 'proj';
    });
    toast('New draft version created for revision', 'ok');
  }, [activeVer, toast, uiPrompt, updateStore]);

  const handleVerifyChain = useCallback(async () => {
    const res = await verifyVersionChain(activeNfa);
    setVerifyState({ nfaId: activeNfa.id, res });
    const anyAltered = Object.values(res).some((x) => x === false);
    toast(
      anyAltered
        ? 'Integrity check detected altered data in at least one locked version!'
        : 'All locked versions verified intact via SHA-256 chain',
      anyAltered ? 'err' : 'ok'
    );
  }, [activeNfa, toast]);

  // Excel download
  const handleDownloadExcel = useCallback(
    (mode: 'pre' | 'post') => {
      try {
        const res = buildQtExcelBytes(activeNfa, activeVer, mode, store.doa);
        if ('error' in res) {
          toast(res.error, 'info');
          return;
        }
        const { bytes, filename } = res;
        downloadBlob(
          filename,
          bytes as unknown as BlobPart,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        updateStore((s) => {
          const v = getActiveVersion(getActiveNfa(s));
          v.audit.push({ t: nowIso(), u: s.role, e: `Downloaded Excel: ${filename}` });
        });
        toast(`Excel downloaded: ${filename}`, 'ok');
      } catch (err) {
        toast(`Excel export failed: ${err instanceof Error ? err.message : String(err)}`, 'err');
      }
    },
    [activeNfa, activeVer, store.doa, toast, updateStore]
  );

  // DoA Config
  const handleEditDoa = useCallback(
    (idx: number, key: keyof DoaBand, val: string | number | boolean) => {
      updateStore((s) => {
        if (!(s.role === 'Head – SCM' || s.role === 'CFO')) return;
        const b = s.doa[idx] as unknown as Record<string, unknown>;
        if (b[key] === val) return;
        s.doaLog = s.doaLog || [];
        s.doaLog.push({
          t: nowIso(),
          u: s.role,
          e: `Band ${idx + 1} ${key}: ${String(b[key])} → ${String(val)}`,
        });
        b[key] = val;
      });
    },
    [updateStore]
  );

  // Backup Export / Import / Reset
  const handleExportBackup = useCallback(() => {
    const ts = nowIso();
    const next = clone(store);
    next.lastBackup = ts;
    setStore(next);
    const name = `eNFA_Backup_${ts.slice(0, 10)}.json`;
    downloadBlob(name, JSON.stringify(next, null, 2), 'application/json');
    toast(`Backup downloaded: ${name}`, 'ok');
  }, [store, toast]);

  const handleImportBackup = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const incoming = JSON.parse(text) as EnfaStore;
        if (!incoming || !incoming.nfas || typeof incoming.nfas !== 'object') {
          toast('Invalid backup file format.', 'err');
          return;
        }
        let added = 0;
        let skipped = 0;
        updateStore((s) => {
          Object.entries(incoming.nfas).forEach(([id, rec]) => {
            if (s.nfas[id]) {
              skipped++;
            } else {
              s.nfas[id] = rec as NfaRecord;
              added++;
            }
          });
          s.seq = Math.max(s.seq || 26909, incoming.seq || 26909);
        });
        toast(
          `Backup restored: ${added} NFA(s) added${skipped ? `, ${skipped} existing kept untouched` : ''}.`,
          'ok'
        );
      } catch {
        toast('Could not parse the selected backup JSON file.', 'err');
      }
    },
    [toast, updateStore]
  );

  const handleClearAll = useCallback(async () => {
    const ok = await uiConfirm(
      'Reset workspace to default demo data? Take a JSON backup first — all other local NFAs will be removed.',
      { danger: true, okLabel: 'Reset workspace' }
    );
    if (!ok) return;
    const fresh = createInitialStore();
    setStore(fresh);
    try {
      localStorage.setItem('enfa_v1', JSON.stringify(fresh));
    } catch {
      // ignore
    }
    toast('Workspace reset to default demo data', 'info');
  }, [toast, uiConfirm]);

  const handleDownloadPrintableHtml = useCallback(() => {
    const html = buildPrintableNfaHtml(activeNfa, activeVer, calcResult);
    const fn = `NFA_${activeNfa.no}_${activeVer.ver}.html`.replace(/[^\w.-]+/g, '_');
    downloadBlob(fn, html, 'text/html;charset=utf-8');
    toast(`Printable HTML downloaded: ${fn}`, 'ok');
    setPrintOpen(false);
  }, [activeNfa, activeVer, calcResult, toast]);

  const handlePrintNow = useCallback(() => {
    setPrintOpen(false);
    window.setTimeout(() => window.print(), 120);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        store={{ ...store, tab: effectiveTab }}
        theme={theme}
        onSelectNfa={(id) =>
          updateStore((s) => {
            s.cur = id;
          })
        }
        onChangeRole={(role: RoleName) => handleChangeRole(role)}
        onChangeTheme={setTheme}
        onNewNfa={handleNewNfa}
      />

      {store.role !== 'Vendor' ? (
        <>
          <RecordBar
            store={{ ...store, tab: effectiveTab }}
            nfa={activeNfa}
            ver={activeVer}
            c={calcResult}
            onGoTab={handleGoTab}
          />

          <Stepper ver={activeVer} currentTab={effectiveTab} onGoTab={handleGoTab} />
        </>
      ) : null}

      <main className="enfa-main w-full">
        <div className="enfa-card">
          {store.role === 'Vendor' ? (
            <VendorView
              nfa={activeNfa}
              ver={activeVer}
              role={store.role}
              vendorIdx={store.activeVendorIdx ?? 0}
              offerPhase={vendorOfferPhase}
              onSelectVendor={(idx) =>
                updateStore((s) => {
                  s.activeVendorIdx = idx;
                })
              }
              onChangeOfferPhase={setVendorOfferPhase}
              onChangeField={handleFieldChange}
              onChangeQuoteScope={handleChangeQuoteScope}
              onToggleRegret={handleToggleRegret}
              onApplyDiscount={handleApplyDiscount}
              onAddVendor={handleAddVendor}
              onCopyQuotedToNegotiated={handleCopyQuoted}
              onAddAttachment={handleAddVendorAttachment}
              onRemoveAttachment={handleRemoveVendorAttachment}
              onSubmitVendorOffer={handleSubmitVendorOffer}
              onSwitchBackToBuyer={() => handleChangeRole('Buyer')}
            />
          ) : effectiveTab === 'dash' ? (
            <OverviewView
              nfa={activeNfa}
              ver={activeVer}
              c={calcResult}
              onGoTab={handleGoTab}
            />
          ) : effectiveTab === 'port' ? (
            <PortfolioView
              store={store}
              onOpenNfa={(id) =>
                updateStore((s) => {
                  s.cur = id;
                  s.tab = 'dash';
                })
              }
            />
          ) : effectiveTab === 'data' ? (
            <BackupView
              store={store}
              storageKB={storageKB}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onClearAll={handleClearAll}
            />
          ) : effectiveTab === 'cfg' ? (
            <DoaConfigView store={store} onEditDoa={handleEditDoa} />
          ) : effectiveTab === 'proj' ? (
            <ProjectView
              nfa={activeNfa}
              ver={activeVer}
              role={store.role}
              onChangeField={handleFieldChange}
              onSubmitStage={handleSubmitStage}
            />
          ) : effectiveTab === 'pr' ? (
            <PrDetailsView
              ver={activeVer}
              role={store.role}
              onAddManualPR={handleAddManualPR}
              onSetPRField={handleSetPRField}
              onDeletePRLine={handleDeletePRLine}
              onSelectPRLine={handleSelectPRLine}
              onSelectAllValidPR={handleSelectAllValidPR}
              onSetPRSelectedQty={handleSetPRSelectedQty}
              onApplySelectedPRs={handleApplySelectedPRs}
              onDownloadPRTemplate={handleDownloadPRTemplate}
              onExportPRLines={handleExportPRLines}
              onLoadDemoPRs={handleLoadDemoPRs}
              onImportCSV={handleImportCSV}
              onUpdateFilters={(filters) =>
                updateStore((s) => {
                  const v = getActiveVersion(getActiveNfa(s));
                  normalizeNfaData(v);
                  v.data.erp.filters = filters;
                })
              }
              onSubmitStage={handleSubmitStage}
            />
          ) : effectiveTab === 'hdr' ? (
            <RfqHeaderView
              ver={activeVer}
              c={calcResult}
              role={store.role}
              onChangeField={handleFieldChange}
              onSubmitStage={handleSubmitStage}
            />
          ) : effectiveTab === 'quo' ? (
            <QuotesView
              ver={activeVer}
              role={store.role}
              onChangeField={handleFieldChange}
              onChangeQuoteScope={handleChangeQuoteScope}
              onToggleRegret={handleToggleRegret}
              onAddVendor={handleAddVendor}
              onDeleteVendor={handleDeleteVendor}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onSubmitStage={handleSubmitStage}
            />
          ) : effectiveTab === 'qtc' ? (
            <QuotedTermsView
              ver={activeVer}
              role={store.role}
              doa={store.doa}
              onChangeField={handleFieldChange}
              onDownloadExcel={handleDownloadExcel}
              onSubmitStage={handleSubmitStage}
            />
          ) : effectiveTab === 'tech' ? (
            <TechEvalView
              ver={activeVer}
              role={store.role}
              onChangeField={handleFieldChange}
              onSubmitTechEval={handleSubmitTechEval}
            />
          ) : effectiveTab === 'trm' ? (
            <NegotiationView
              ver={activeVer}
              c={calcResult}
              role={store.role}
              doa={store.doa}
              onChangeField={handleFieldChange}
              onCopyQuoted={handleCopyQuoted}
              onApplyDiscount={handleApplyDiscount}
              onDownloadExcel={handleDownloadExcel}
              onSubmitStage={handleSubmitStage}
              onSwitchToVendorPortal={(vendorIdx) => handleChangeRole('Vendor', vendorIdx)}
            />
          ) : effectiveTab === 'cs' ? (
            <ComparativeStatementView
              ver={activeVer}
              c={calcResult}
              role={store.role}
              doa={store.doa}
              onChangeField={handleFieldChange}
              onDownloadExcel={handleDownloadExcel}
              onSubmitStage={handleSubmitStage}
            />
          ) : effectiveTab === 'nfa' ? (
            <NfaDocumentView
              nfa={activeNfa}
              ver={activeVer}
              c={calcResult}
              role={store.role}
              doa={store.doa}
              onChangeField={handleFieldChange}
              onGoTab={handleGoTab}
              onSubmitForApproval={handleSubmitForApproval}
              onOpenPrint={() => setPrintOpen(true)}
            />
          ) : effectiveTab === 'apr' ? (
            <ApprovalView
              ver={activeVer}
              c={calcResult}
              role={store.role}
              onGoTab={handleGoTab}
              onAct={handleActOnApproval}
              onRevise={handleReviseVersion}
            />
          ) : (
            <VersionsAuditView
              nfa={activeNfa}
              doa={store.doa}
              verifyState={verifyState}
              onVerifyChain={handleVerifyChain}
            />
          )}
        </div>
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <DialogModal dialog={dialog} onClose={() => setDialog(null)} />
      <PrintPreviewModal
        open={printOpen}
        title={`${activeNfa.no} · ${activeVer.ver}`}
        onPrintNow={handlePrintNow}
        onDownloadHtml={handleDownloadPrintableHtml}
        onClose={() => setPrintOpen(false)}
      />
    </div>
  );
}
