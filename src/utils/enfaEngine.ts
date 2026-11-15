import type {
  ApprovalStep,
  AwardRow,
  CalcResult,
  DoaBand,
  EnfaStore,
  LineTechEval,
  LppInfo,
  LppValidation,
  NegotiationPoint,
  NfaData,
  NfaRecord,
  NfaVersion,
  PrLine,
  QtEvalResult,
  QtModel,
  RoleName,
  StageId,
  SubmitBlocker,
  TabId,
  Vendor,
  VendorTerms,
} from '../types/enfa.ts';
import {
  DEF_DOA,
  FX_KEYS,
  HDR_FIELDS,
  LPP_J_MIN,
  LPP_WARN_PCT,
  PR_COLS,
  PR_DATE,
  PR_NUM,
  QT_KEYS,
  QT_REQ,
  QT_W,
  STAGE_META,
  STAGE_ROLE,
  TECH_CRITERIA,
  TERMS,
  WF_ORDER,
} from './enfaConstants.ts';

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const nowIso = (): string => new Date().toISOString();

export const fmtD = (s?: string | null): string =>
  s
    ? new Date(s).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

export const fmt = (n: unknown, d = 0, cur = 'INR'): string => {
  if (n === '' || n == null || Number.isNaN(Number(n))) return '—';
  const loc = cur === 'INR' ? 'en-IN' : 'en-US';
  return Number(n).toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const pct = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? '—' : `${(n * 100).toFixed(1)}%`;

export const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export const shortK = (n: number | null | undefined, cur = 'INR'): string => {
  const val = Number(n) || 0;
  const a = Math.abs(val);
  if (cur === 'INR') {
    if (a >= 1e7) return `${(val / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `${(val / 1e5).toFixed(2)} L`;
    if (a >= 1e3) return `${(val / 1e3).toFixed(1)} K`;
    return fmt(val, 0, cur);
  }
  if (a >= 1e9) return `${(val / 1e9).toFixed(2)} B`;
  if (a >= 1e6) return `${(val / 1e6).toFixed(2)} M`;
  if (a >= 1e3) return `${(val / 1e3).toFixed(1)} K`;
  return fmt(val, 0, cur);
};

export function lblFor(path: string): string {
  const k = String(path).split('.').pop() || '';
  if (path.startsWith('header.')) {
    const h = HDR_FIELDS.find((f) => f[0] === k);
    if (h) return h[1];
  }
  if (path.includes('.terms.') || path.includes('.qterms.')) {
    const t = TERMS.find((f) => f[0] === k);
    if (t) return `${path.includes('.qterms.') ? 'Quoted ' : 'Negotiated '}${t[1]}`;
  }
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export function getActiveNfa(s: EnfaStore): NfaRecord {
  const ids = Object.keys(s.nfas);
  return s.nfas[s.cur] || s.nfas[ids[0]];
}

export function getActiveVersion(nfa: NfaRecord): NfaVersion {
  return nfa.versions[nfa.versions.length - 1];
}

export function normalizeNfaData(v: NfaVersion): NfaData {
  const d = v.data;
  d.nfa = d.nfa || {
    award: 'Item-wise L1',
    rationale: '',
    nonL1: '',
    lppJust: '',
    special: '',
    remarks: '',
    decl: 'No',
    ov: {},
    ovr: {},
  };
  d.nfa.ov = d.nfa.ov || {};
  d.nfa.ovr = d.nfa.ovr || {};
  d.nfa.lppJ = d.nfa.lppJ || {};
  d.workflow = d.workflow || { submitted: {} };
  d.workflow.submitted = d.workflow.submitted || {};
  d.erp = d.erp || {
    mode: 'not-connected',
    prLines: [],
    selected: {},
    filters: {},
    selectionApplied: false,
    lastSync: null,
    reservationId: null,
  };
  d.erp.prLines = d.erp.prLines || [];
  d.erp.selected = d.erp.selected || {};
  d.erp.filters = d.erp.filters || {};
  return d;
}

export function projectReady(v: NfaVersion): boolean {
  if (v.status !== 'Draft') return true;
  const p = v.data.project;
  if (!p) return false;
  return [p.name, p.requester, p.dept, p.scope, p.buyer, p.tech].every((x) =>
    String(x || '').trim()
  );
}

export function syncProject(d: NfaData): void {
  const p = d.project;
  const h = d.header as unknown as Record<string, unknown>;
  d.projSync = d.projSync || {};
  const pairs: [keyof typeof p, string][] = [
    ['dept', 'dept'],
    ['category', 'cat'],
    ['budget', 'budget'],
    ['estimate', 'estimate'],
    ['route', 'route'],
    ['needBy', 'needBy'],
    ['buyer', 'buyer'],
    ['tech', 'tech'],
  ];
  pairs.forEach(([pk, hk]) => {
    const pv = p[pk];
    if (d.erp?.selectionApplied && (pk === 'dept' || pk === 'needBy')) return;
    if (pv === '' || pv == null) return;
    if (d.projSync![pk] !== pv) {
      h[hk] = pv;
      d.projSync![pk] = pv;
    }
  });
  if (!d.header.desc && p.scope) d.header.desc = p.scope;
}

export function wfDone(d: NfaData, k: StageId): boolean {
  return !!d.workflow?.submitted?.[k];
}

export function wfCanOpen(v: NfaVersion, k: TabId): boolean {
  if (['port', 'data'].includes(k)) return true;
  if (v.status !== 'Draft') return true;
  if (['dash', 'proj', 'ver', 'cfg'].includes(k)) return true;
  if (k === 'apr') return (v.status as string) !== 'Draft' && !!v.data.workflow?.submitted?.nfa;
  const idx = WF_ORDER.indexOf(k as StageId);
  if (idx < 0) return true;
  return WF_ORDER.slice(0, idx).every((stage) => wfDone(v.data, stage));
}

export function invalidateWorkflow(d: NfaData, from: StageId): void {
  const idx = WF_ORDER.indexOf(from);
  if (idx < 0) return;
  d.workflow = d.workflow || { submitted: {} };
  d.workflow.submitted = d.workflow.submitted || {};
  WF_ORDER.slice(idx).forEach((k) => {
    delete d.workflow!.submitted[k];
  });
}

export function invalidateForPath(d: NfaData, path: string): void {
  if (!path) return;
  const parts = path.split('.');
  const root = parts[0];
  if (root === 'project') {
    invalidateWorkflow(d, 'proj');
    return;
  }
  if (root === 'header') {
    invalidateWorkflow(d, 'hdr');
    return;
  }
  if (root === 'vendors') {
    if (parts[2] === 'techEval') {
      invalidateWorkflow(d, 'tech');
      return;
    }
    if (parts[2] === 'qterms') {
      invalidateWorkflow(d, 'qtc');
      return;
    }
    if (parts[2] === 'fdate') {
      invalidateWorkflow(d, wfDone(d, 'tech') ? 'trm' : 'quo');
      return;
    }
    if (parts[2] === 'terms' && FX_KEYS.includes(parts[3])) {
      invalidateWorkflow(d, 'quo');
      return;
    }
    if (parts[2] === 'terms') {
      const vv = d.vendors[Number(parts[1])];
      if (vv) vv.termsNeg = true;
      invalidateWorkflow(d, 'trm');
      return;
    }
    if (parts[2] === 'quoteScope') {
      invalidateWorkflow(d, 'quo');
      return;
    }
    invalidateWorkflow(d, 'quo');
    return;
  }
  if (root === 'items') {
    if (parts[2] === 'lpp') {
      invalidateWorkflow(d, 'cs');
      return;
    }
    if (parts[2] === 'r' && (parts[4] === 'q' || parts[4] === 'regret' || parts[4] === 'regretReason')) {
      invalidateWorkflow(d, 'quo');
      return;
    }
    if (parts[2] === 'r' && parts[4] === 'n') {
      invalidateWorkflow(d, 'trm');
      return;
    }
    invalidateWorkflow(d, 'quo');
    return;
  }
  if (root === 'nfa') {
    if (parts[1] === 'ov' || parts[1] === 'ovr' || parts[1] === 'lppJ') {
      invalidateWorkflow(d, 'cs');
      return;
    }
    invalidateWorkflow(d, 'nfa');
    return;
  }
  if (root === 'techMode') invalidateWorkflow(d, 'tech');
}

export function canEditPath(v: NfaVersion, role: RoleName, p: string): boolean {
  if (v.status !== 'Draft') return false;
  const d = v.data;
  if (p === 'techMode') {
    return (
      role === 'User HOD (Technical)' &&
      !d.vendors.some(
        (vd) =>
          vd.techEval?.submitted ||
          vd.techEval?.evaluator ||
          Object.keys(vd.techEval?.lines || {}).length > 0
      )
    );
  }
  if (String(p).includes('.techEval.')) return role === 'User HOD (Technical)';
  if (role === 'Vendor') {
    if (/^vendors\.\d+\.(name|code|ref|qdate|fdate|quoteScope)$/.test(p)) return true;
    if (/^vendors\.\d+\.(qterms|terms)\./.test(p)) return true;
    if (/^items\.\d+\.r\.\d+\.(q|n|regret|regretReason)$/.test(p)) return true;
    return false;
  }
  return role === 'Buyer';
}

export const LEGACY_TE = {
  legacy: true,
  evaluator: 'Legacy record (pre-dates technical evaluation module)',
  date: '',
  status: 'Accepted' as const,
  decisionNote: 'Accepted under earlier process – no criteria recorded',
  criteria: {},
};

export const te = (v: Vendor) => v.techEval || LEGACY_TE;

export function techComplete(v: Vendor): boolean {
  const e = te(v);
  if (e.legacy && e.status === 'Accepted') return true;
  const vals = TECH_CRITERIA.map(([k]) => e.criteria?.[k]?.result || '');
  const fails = TECH_CRITERIA.filter(
    ([k]) => e.criteria?.[k]?.result === 'Fail' && !String(e.criteria?.[k]?.note || '').trim()
  ).length;
  const hasFail = vals.includes('Fail');
  return !!(
    String(e.evaluator || '').trim() &&
    e.date &&
    ['Accepted', 'Rejected'].includes(e.status) &&
    vals.every((x) => ['Pass', 'Fail', 'N/A'].includes(x)) &&
    !fails &&
    (e.status !== 'Accepted' || (!hasFail && vals.includes('Pass'))) &&
    (e.status !== 'Rejected' || String(e.decisionNote || '').trim())
  );
}

export function lineTechComplete(e?: LineTechEval): boolean {
  if (!e) return false;
  const vals = TECH_CRITERIA.map(([k]) => e.criteria?.[k]?.result || '');
  const fails = TECH_CRITERIA.filter(
    ([k]) => e.criteria?.[k]?.result === 'Fail' && !String(e.criteria?.[k]?.note || '').trim()
  ).length;
  const hasFail = vals.includes('Fail');
  return !!(
    String(e.evaluator || '').trim() &&
    e.date &&
    ['Accepted', 'Rejected'].includes(e.status) &&
    vals.every((x) => ['Pass', 'Fail', 'N/A'].includes(x)) &&
    !fails &&
    (e.status !== 'Accepted' || (!hasFail && vals.includes('Pass'))) &&
    (e.status !== 'Rejected' || String(e.decisionNote || '').trim())
  );
}

export function isOk(v?: Vendor): boolean {
  return !!(
    v &&
    v.name &&
    techComplete(v) &&
    te(v).status === 'Accepted' &&
    (te(v).legacy || te(v).submitted === true)
  );
}

export function isOkForLine(d: NfaData, v: Vendor | undefined, i: number): boolean {
  if (!v) return false;
  if (d.techMode !== 'Line-wise') return isOk(v);
  const e = v.techEval?.lines?.[String(i)];
  return !!(e && e.submitted === true && lineTechComplete(e) && e.status === 'Accepted');
}

export function techBlockReason(v?: Vendor): string {
  if (!v?.name) return 'Enter the vendor name first.';
  const e = te(v);
  if (e.status === 'Rejected') return 'Vendor rejected — commercial pricing is locked.';
  if (e.status !== 'Accepted') return 'Technical outcome must be Accepted.';
  if (!String(e.evaluator || '').trim() || !e.date)
    return 'Enter the evaluator name and evaluation date.';
  const missing = TECH_CRITERIA.filter(
    ([k]) => !['Pass', 'Fail', 'N/A'].includes(e.criteria?.[k]?.result || '')
  );
  if (missing.length)
    return 'Complete all 7 technical criteria: ' + missing.map((x) => x[1]).join(', ') + '.';
  if (TECH_CRITERIA.some(([k]) => e.criteria?.[k]?.result === 'Fail'))
    return 'An evaluation with a Fail criterion cannot be Accepted.';
  return 'Technical evaluation is not complete.';
}

export function lppValidate(
  st: string,
  no: boolean,
  raw: number | null,
  lp: LppInfo,
  up: boolean,
  j: string,
  pctv: number | null
): LppValidation {
  const e: string[] = [];
  const w: string[] = [];
  const stMiss = !st;
  const rateMiss = !no && !!st && raw == null;
  const rateBad = !no && !!st && raw != null && !(raw > 0);
  const poMiss = !no && !!st && !String(lp.po || '').trim();
  const venMiss = !no && !!st && !String(lp.vendor || '').trim();
  if (stMiss) e.push('LPP status not selected');
  if (rateMiss) e.push('LPP basic rate missing');
  if (rateBad) e.push('LPP rate must be > 0');
  if (poMiss) e.push('LPP PO no./date missing');
  if (venMiss) e.push('LPP vendor missing');
  const jMiss = up && !j;
  const jShort = up && !!j && j.length < LPP_J_MIN;
  if (jMiss) e.push('Justification required (above LPP)');
  if (jShort) e.push(`Justification too short (min ${LPP_J_MIN} chars)`);
  if (pctv != null && Math.abs(pctv) > LPP_WARN_PCT)
    w.push(`Variance > ${LPP_WARN_PCT * 100}% – verify LPP UOM / basic-rate basis`);
  const dataMiss = stMiss || rateMiss || rateBad || poMiss || venMiss;
  return {
    lppStMiss: stMiss,
    lppRateMiss: rateMiss || rateBad,
    lppPoMiss: poMiss,
    lppVenMiss: venMiss,
    lppMissing: dataMiss,
    lppJMissing: jMiss || jShort,
    lppJShort: jShort,
    lppIssues: e,
    lppWarn: w,
    lppOk: !e.length,
  };
}

export function calc(d: NfaData, doa: DoaBand[] = DEF_DOA): CalcResult {
  const nfa = d.nfa || { ov: {}, ovr: {} };
  const overrides = nfa.ov || {};
  const base = d.header.cur || 'INR';
  const cur = d.vendors.map((v) => v.terms?.cur || base);
  const fx = d.vendors.map((v, j) =>
    cur[j] === base ? 1 : (num(v.terms?.fxRate) || 0) > 0 ? num(v.terms?.fxRate) : null
  );
  const lf = d.vendors.map(
    (v) => ['fr', 'pf', 'ins', 'oth'].reduce((s, k) => s + (Number(v.terms?.[k]) || 0), 0) / 100
  );

  const rows = d.items.map((it, itemIdx) => {
    const qty = Number(it.qty) || 0;
    const landed = d.vendors.map((v, j) => {
      const cell = it.r[j];
      const q = num(cell?.q);
      const n = num(cell?.n);
      const eligible = isOkForLine(d, v, itemIdx) && !cell?.regret && q != null;
      return n == null || fx[j] == null || !eligible || !v.name
        ? null
        : qty * n * (1 + lf[j]) * (fx[j] as number);
    });
    const valid = landed
      .map((x, j) => [x, j] as [number | null, number])
      .filter((a): a is [number, number] => a[0] != null)
      .sort((a, b) => a[0] - b[0]);
    const l1 = valid[0];
    const l2 = valid[1];
    return {
      it,
      qty,
      landed,
      ranked: valid.map((a, k) => ({ landed: a[0], j: a[1], rank: k + 1 })),
      l1v: l1 ? l1[0] : null,
      l1j: l1 ? l1[1] : null,
      l2v: l2 ? l2[0] : null,
      l2j: l2 ? l2[1] : null,
      tie: !!(l1 && l2 && Math.abs(l1[0] - l2[0]) < 0.005),
      gap: l1 && l2 ? (l2[0] - l1[0]) / l1[0] : null,
    };
  });

  const vs = d.vendors.map((v, j) => {
    let cnt = 0;
    let q = 0;
    let n = 0;
    let l = 0;
    let qb = 0;
    let nb = 0;
    rows.forEach((r, itemIdx) => {
      const it = r.it;
      const rate = fx[j];
      const bq = num(it.r[j]?.q);
      const bn = num(it.r[j]?.n);
      const okLine = isOkForLine(d, d.vendors[j], itemIdx) && !it.r[j]?.regret;
      if (okLine && rate != null && bq != null) q += r.qty * bq * rate;
      if (okLine && rate != null && bn != null) n += r.qty * bn * rate;
      if (okLine && rate != null && bq != null && bn != null) {
        qb += r.qty * bq * rate;
        nb += r.qty * bn * rate;
      }
      if (r.landed[j] != null) {
        cnt++;
        l += r.landed[j] as number;
      }
    });
    const acceptedLines = d.items.filter(
      (it, i) => !it.r?.[j]?.regret && num(it.r?.[j]?.q) != null && isOkForLine(d, v, i)
    ).length;
    return {
      name: v.name,
      cnt,
      q,
      n,
      qb,
      nb,
      l,
      currency: cur[j],
      fx: fx[j],
      complete: cnt > 0 && cnt === d.items.length && acceptedLines === d.items.length,
      technicalStatus: d.techMode === 'Line-wise' ? 'Line-wise' : te(v).status || 'Pending',
      rank: null as number | null,
    };
  });

  const comp = vs
    .map((x, j) => [x, j] as const)
    .filter((a) => a[0].complete)
    .sort((a, b) => a[0].l - b[0].l);
  vs.forEach((x, j) => {
    x.rank = x.complete ? comp.findIndex((c) => c[1] === j) + 1 : null;
  });
  const pkgJ = comp.length ? comp[0][1] : null;

  const aw: AwardRow[] = rows.map((r, i) => {
    const ov = overrides[String(i)];
    const allowed = r.ranked
      .map((x) => x.j)
      .filter((j) => j != null && isOkForLine(d, d.vendors[j], i) && d.vendors[j].name);
    const hasOv = ov !== undefined && ov !== '';
    const j = hasOv ? (allowed.includes(Number(ov)) ? Number(ov) : null) : r.l1j;
    const landed = j == null ? null : r.landed[j];
    const it = r.it;
    const rate = j == null ? null : fx[j];
    const q =
      j == null || rate == null || num(it.r[j]?.q) == null
        ? null
        : r.qty * Number(it.r[j].q) * rate;
    const n =
      j == null || rate == null || num(it.r[j]?.n) == null
        ? null
        : r.qty * Number(it.r[j].n) * rate;
    const lp = it.lpp || {};
    const lppSt = String(lp.status || '').trim();
    const lppNo = lppSt === 'First purchase – no LPP';
    const lppRaw = num(lp.rate);
    const lppRate = lppNo ? null : lppRaw != null && lppRaw > 0 ? lppRaw : null;
    const unit = n != null && r.qty > 0 ? n / r.qty : null;
    const lppVar = unit != null && lppRate != null && lppRate > 0 ? unit - lppRate : null;
    const lppPct = lppVar != null && lppRate != null ? lppVar / lppRate : null;
    const lppUp = lppPct != null && lppPct > 0.00005;
    const lppJ = String((nfa.lppJ || {})[String(i)] || '').trim();
    return {
      j,
      landed,
      q,
      n,
      unit,
      lppNo,
      lppRate,
      lppVar,
      lppPct,
      lppUp,
      lppImpact: lppVar != null ? lppVar * r.qty : null,
      lppJ,
      ...lppValidate(lppSt, lppNo, lppRaw, lp, lppUp, lppJ, lppPct),
      sav: q != null && n != null ? q - n : null,
      isOv: ov !== undefined && ov !== '',
      tieOpen: !!(r.tie && !hasOv),
      nonL1: j != null && j !== r.l1j,
      varL1: landed != null && r.l1v != null ? landed - r.l1v : null,
    };
  });

  const total = aw.reduce((s, a) => s + (a.landed || 0), 0);
  const sav = aw.reduce((s, a) => s + (a.sav || 0), 0);
  const qt = aw.reduce((s, a) => s + (a.q || 0), 0);
  const lc = aw
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a.lppVar != null);
  const lppBasket = lc.reduce((s, x) => s + (x.a.lppRate || 0) * rows[x.i].qty, 0);
  const lppNow = lc.reduce((s, x) => s + (x.a.n || 0), 0);
  const lppSum = {
    items: lc.length,
    up: lc.filter((x) => x.a.lppUp).length,
    down: lc.filter((x) => (x.a.lppPct || 0) < -0.00005).length,
    none: aw.filter((a) => a.lppNo).length,
    missing: aw.filter((a) => a.lppMissing).length,
    jMissing: aw.filter((a) => a.lppJMissing).length,
    basket: lppBasket,
    now: lppNow,
    impact: lppNow - lppBasket,
    pct: lppBasket ? (lppNow - lppBasket) / lppBasket : null,
  };
  const split = d.vendors.map((v, j) => {
    const val = aw.reduce((s, a) => s + (a.j === j && a.landed ? a.landed : 0), 0);
    return { j, name: v.name, val, share: total ? val / total : 0 };
  });
  const inr =
    base === 'INR'
      ? 1
      : (num(d.header.inrRate) || 0) > 0
      ? num(d.header.inrRate)
      : null;
  const totalInr = inr == null ? null : total * inr;
  const band =
    (totalInr == null ? null : doa.find((b) => totalInr >= b.from && totalInr < b.to)) ||
    doa[doa.length - 1];
  const priced = d.vendors.filter((v, j) => {
    const accepted = d.items.filter(
      (it, i) => isOkForLine(d, v, i) && !it.r[j]?.regret && num(it.r[j]?.q) != null
    );
    return accepted.length > 0 && accepted.every((it) => num(it.r[j]?.n) != null);
  }).length;
  const negMissing = d.vendors.map(
    (v, j) =>
      d.items.filter(
        (it, i) =>
          isOkForLine(d, v, i) && !it.r[j]?.regret && num(it.r[j]?.q) != null && num(it.r[j]?.n) == null
      ).length
  );

  return {
    lppSum,
    inr,
    totalInr,
    priced,
    negMissing,
    lf,
    fx,
    cur,
    base,
    rows,
    vs,
    pkgJ,
    aw,
    total,
    sav,
    qt,
    savPct: qt ? sav / qt : null,
    split,
    band,
    tokCount: d.vendors.filter(
      (v, j) => v.name && d.items.some((_it, i) => isOkForLine(d, v, i) && d.vendors[j] === v)
    ).length,
    quoted: d.vendors.filter(
      (v, j) => v.name && d.items.some((it) => num(it.r[j]?.q) != null)
    ).length,
  };
}

export const valOf = (v: NfaVersion, c: CalcResult): number =>
  v.status === 'Draft' ? c.total : v.value ?? c.total;

export const bandOf = (v: NfaVersion, c: CalcResult): DoaBand =>
  v.status === 'Draft' ? c.band : v.band || c.band;

export function route(c: CalcResult): ApprovalStep[] {
  const steps: { lv: string; role: RoleName; req: boolean }[] = [
    { lv: 'L1', role: 'User HOD (Technical)', req: true },
    { lv: 'L2', role: 'HOD – SCM', req: true },
    { lv: 'L3', role: 'Finance', req: c.band.fin },
    { lv: 'L4', role: c.band.final, req: true },
  ];
  return steps
    .filter((x) => x.req)
    .map((x) => ({
      lv: x.lv,
      role: x.role,
      req: x.req,
      name: '',
      action: 'Pending',
      date: '',
      comment: '',
    }));
}

export const curLevel = (v: NfaVersion): ApprovalStep | undefined =>
  v.approvals.find((a) => a.action === 'Pending');

export function lppIssueText(c: CalcResult, kind: 'data' | 'just'): string {
  const r = c.aw
    .map((a, i) => ({ a, i }))
    .filter((x) => (kind === 'data' ? x.a.lppMissing : x.a.lppJMissing));
  return r
    .map(
      (x) =>
        `Item ${x.i + 1}: ${x.a.lppIssues
          .filter((t) => (kind === 'data' ? !/Justification/.test(t) : /Justification/.test(t)))
          .join(', ')}`
    )
    .join(' | ');
}

export function checks(d: NfaData, c: CalcResult): [string, boolean, string][] {
  const h = d.header;
  const hRec = h as unknown as Record<string, unknown>;
  const nfa = d.nfa || { decl: 'No', rationale: '', nonL1: '', ovr: {} };
  const out: [string, boolean, string][] = [];

  const miss = HDR_FIELDS.filter((f) => f[3] && (hRec[f[0]] === '' || hRec[f[0]] == null));
  out.push([
    'Mandatory header fields filled',
    !miss.length,
    miss.length ? 'Missing: ' + miss.map((f) => f[1]).join(', ') : '',
  ]);

  const exempt = ['Single Source', 'Proprietary (OEM)', 'Emergency', 'Rate Contract / Repeat'].includes(
    h.route
  );

  const techPending = d.vendors.reduce(
    (n, v, j) =>
      n +
      (v.name
        ? d.items.filter(
            (it, i) =>
              num(it.r[j]?.q) != null &&
              (d.techMode === 'Line-wise'
                ? !(lineTechComplete(v.techEval?.lines?.[String(i)]) && v.techEval?.lines?.[String(i)]?.submitted === true)
                : !techComplete(v) || (!te(v).legacy && te(v).submitted !== true))
          ).length
        : 0),
    0
  );
  out.push([
    'Technical evaluation completed for every quoted vendor',
    techPending === 0,
    `${techPending} quoted vendor(s) need a complete evaluation; Fail requires a note and rejection rationale`,
  ]);

  const acceptedNoPass =
    d.techMode === 'Line-wise'
      ? 0
      : d.vendors.filter(
          (v) =>
            v.name &&
            te(v).status === 'Accepted' &&
            !te(v).legacy &&
            !TECH_CRITERIA.some(([k]) => te(v).criteria?.[k]?.result === 'Pass')
        ).length;
  out.push([
    'Accepted evaluation has at least one Pass criterion',
    acceptedNoPass === 0,
    `${acceptedNoPass} accepted evaluation(s) have no Pass`,
  ]);

  out.push([
    'Min. 3 technically accepted vendors with final (negotiated) prices (unless exempt route)',
    exempt || c.priced >= 3,
    `Only ${c.priced} accepted vendor(s) with final prices`,
  ]);

  const needJ =
    ['Single Source', 'Proprietary (OEM)', 'Emergency'].includes(h.route) ||
    d.nfa.award === 'Non-L1 (Justified)' ||
    c.aw.some((a) => a.nonL1);
  out.push([
    'Justification entered for single-source / proprietary / emergency / non-L1 award',
    !needJ || !!String(d.nfa.nonL1 || '').trim(),
    'Enter justification in NFA',
  ]);

  const badFx = d.vendors.filter((v) => {
    const t = v.terms;
    const cur = t.cur || h.cur;
    return (
      v.name &&
      cur !== h.cur &&
      (!((num(t.fxRate) || 0) > 0) || !t.fxDate || !String(t.fxSource || '').trim())
    );
  }).length;
  out.push([
    'Quote currency & FX rate, date and source captured at quotation stage',
    badFx === 0,
    `${badFx} vendor(s) missing FX details – complete on Quotes stage`,
  ]);

  const badInr =
    h.cur !== 'INR' &&
    (!((num(h.inrRate) || 0) > 0) || !h.inrRateDate || !String(h.inrRateSrc || '').trim());
  out.push([
    'INR rate, date and source recorded for DoA routing (non-INR NFA)',
    !badInr,
    'Enter INR rate, date and source in RFQ Header',
  ]);

  const badNeg = d.items.reduce(
    (s, it, i) =>
      s +
      it.r.filter(
        (x, j) =>
          isOkForLine(d, d.vendors[j], i) &&
          num(x.q) != null &&
          num(x.n) != null &&
          Number(x.n) > Number(x.q)
      ).length,
    0
  );
  out.push(['Negotiated rate ≤ quoted rate on all lines', !badNeg, `${badNeg} line(s) violate`]);

  const negMiss = c.negMissing.reduce((x, y) => x + y, 0);
  out.push([
    'Final (negotiated) price entered for every quoted line of accepted vendors',
    !negMiss,
    `${negMiss} line(s) pending – enter on the Terms tab or use “Copy quoted → negotiated”`,
  ]);

  const bad: string[] = [];
  d.items.forEach((it, i) => {
    if (!(Number(it.qty) > 0)) bad.push(`Item ${i + 1} qty`);
    it.r.forEach((x, j) => {
      (['q', 'n'] as const).forEach((k) => {
        if (num(x[k]) != null && !(Number(x[k]) > 0))
          bad.push(`Item ${i + 1} V${j + 1} ${k === 'q' ? 'quoted' : 'negotiated'}`);
      });
      if (isOkForLine(d, d.vendors[j], i) && num(x.n) != null && num(x.q) == null)
        bad.push(`Item ${i + 1} V${j + 1} negotiated without quote`);
    });
  });
  d.vendors.forEach((v, j) => {
    if (!v.name) return;
    ['adv', 'fr', 'pf', 'ins', 'oth', 'gst', 'pbg'].forEach((k) => {
      const t = num(v.terms[k]);
      if (t != null && (t < 0 || t > 100)) bad.push(`V${j + 1} ${k} %`);
    });
  });
  out.push([
    'Numeric inputs valid (qty & prices > 0, % within 0–100, negotiated only where quoted)',
    !bad.length,
    bad.slice(0, 6).join('; ') + (bad.length > 6 ? ' …' : ''),
  ]);

  const noAw = c.aw.filter((a) => a.landed == null).length;
  out.push([
    'Every item has an awarded vendor with valid landed price',
    d.items.length > 0 && !noAw,
    `${noAw} item(s) without award`,
  ]);

  const nfaReasons = d.nfa?.ovr || {};
  const nr = c.aw.filter(
    (a, i) => (a.nonL1 || c.rows[i].tie) && !(nfaReasons[String(i)] || '').trim()
  ).length;
  out.push([
    'Justification entered for every Non-L1 award / tied-price selection',
    !nr,
    `${nr} reason(s) missing`,
  ]);

  const tieOpen = c.aw.filter((a) => a.tieOpen).length;
  out.push([
    'Equal L1 landed prices resolved by explicit vendor selection with reason',
    !tieOpen,
    `${tieOpen} item(s) tied – select a vendor in the Buyer Award Selection field`,
  ]);

  const ba = num(h.budgetAvail);
  out.push([
    'Award value within available budget',
    ba != null && c.total <= ba,
    ba == null ? 'Budget not entered' : `Exceeds by ${fmt(c.total - ba, 0, h.cur)}`,
  ]);

  const aws = c.split.filter((s) => s.val > 0);
  const needBy2 = Date.now() + c.band.days * 864e5;
  const expired = aws
    .filter((s) => {
      const v = d.vendors[s.j];
      const b0 = v.fdate || v.qdate;
      const vd = Number(v.terms.valid) || 0;
      if (!b0 || !vd) return true;
      return new Date(b0).getTime() + vd * 864e5 < needBy2;
    })
    .map((s) => d.vendors[s.j].name);
  out.push([
    `Offer valid through the approval cycle (final/quote date + validity ≥ today + ${c.band.days} d)`,
    !aws.length || !expired.length,
    `Date/validity missing or expires before approval: ${expired.join(', ')} – obtain extension`,
  ]);

  const maxD = Math.max(0, ...aws.map((s) => Number(d.vendors[s.j].terms.delDays) || 0));
  const nb = h.needBy ? new Date(h.needBy) : null;
  out.push([
    'Offered delivery meets need-by date',
    !!(nb && Date.now() + (maxD + c.band.days) * 864e5 <= nb.getTime()),
    nb ? 'Delivery (plus approval cycle) later than need-by' : 'Need-by date not entered',
  ]);

  const unreg = aws.filter((s) => d.vendors[s.j].terms.reg !== 'Yes').length;
  out.push(['Awarded vendors registered in ERP', !unreg, 'Registration pending']);

  out.push([
    'Quotation attached / referenced for every vendor',
    d.vendors.filter((v) => v.name && !v.ref).length === 0,
    'Quote ref missing',
  ]);

  out.push([
    'LPP data complete for every item (status, basic rate > 0, PO ref, vendor – or first purchase)',
    !c.lppSum.missing,
    lppIssueText(c, 'data'),
  ]);

  out.push([
    `Justification (min ${LPP_J_MIN} chars) for every item priced above LPP`,
    !c.lppSum.jMissing,
    lppIssueText(c, 'just'),
  ]);

  out.push([
    'Buyer selection rationale entered',
    !!String(nfa.rationale || '').trim(),
    'Enter the commercial / operational basis for the award recommendation',
  ]);

  out.push(['Buyer declaration confirmed', d.nfa.decl === 'Yes', 'Declaration pending']);

  return out;
}

const CHECK_TAB: [RegExp, TabId, string][] = [
  [/header fields|INR rate, date/i, 'hdr', 'RFQ Header'],
  [/Technical evaluation|Accepted evaluation/i, 'tech', 'Technical Evaluation'],
  [/Quote currency|Quotation attached/i, 'quo', 'Quotes'],
  [
    /Negotiated rate|Final \(negotiated\)|Numeric inputs|Min\. 3|Offer valid|Offered delivery|registered in ERP/i,
    'trm',
    'Negotiation & Terms',
  ],
  [/awarded vendor|Non-L1 award|Equal L1|LPP/i, 'cs', 'Comparative Statement'],
  [/budget/i, 'hdr', 'RFQ Header (budget)'],
  [/single-source|rationale|declaration/i, 'nfa', 'NFA (this page)'],
];

export function checkTab(name: string): { tab: TabId; label: string } {
  const m = CHECK_TAB.find((x) => x[0].test(name));
  return m ? { tab: m[1], label: m[2] } : { tab: 'nfa', label: 'NFA' };
}

export function submitBlockers(
  v: NfaVersion,
  role: RoleName,
  doa: DoaBand[]
): SubmitBlocker[] {
  const d = v.data;
  const c = calc(d, doa);
  const out: SubmitBlocker[] = [];
  if (v.status !== 'Draft') {
    return [
      {
        t: `This version is ${v.status} – it has already been submitted or closed.`,
        tab: 'apr',
        label: 'Approval',
      },
    ];
  }
  if (role !== 'Buyer') {
    out.push({
      t: `You are acting as “${role}”. Only the Buyer can submit — change “Acting as” (top bar) to Buyer.`,
      tab: null,
    });
  }
  const openSt = WF_ORDER.filter((k) => k !== 'nfa' && !wfDone(d, k));
  openSt.forEach((k) =>
    out.push({
      t: `Stage not submitted: ${STAGE_META[k]?.[0] || k} — open it and click its Submit button.`,
      tab: k,
      label: STAGE_META[k]?.[0] || k,
    })
  );
  checks(d, c)
    .filter((x) => !x[1])
    .forEach((x) => {
      const m = checkTab(x[0]);
      out.push({ t: x[0] + (x[2] ? ' — ' + x[2] : ''), tab: m.tab, label: m.label });
    });
  return out;
}

export function nextAction(v: NfaVersion): {
  who?: RoleName | '';
  txt: string;
  tab: TabId;
  done?: boolean;
} {
  if (v.status === 'Pending') {
    const a = curLevel(v);
    return {
      who: a?.role,
      txt: `Approval pending at ${a?.lv} · ${a?.role}`,
      tab: 'apr',
    };
  }
  if (v.status === 'Approved') {
    return {
      who: 'Buyer',
      txt: `Approved & locked. Released for PO creation against ${v.ver}.`,
      tab: 'ver',
      done: true,
    };
  }
  if (v.status === 'Returned') {
    return {
      who: 'Buyer',
      txt: 'Returned for revision. Buyer to create a revised version from the Approval screen.',
      tab: 'apr',
    };
  }
  if (v.status === 'Rejected') {
    return {
      who: '',
      txt: 'Rejected & closed. A fresh NFA is required.',
      tab: 'ver',
      done: true,
    };
  }
  if (v.status === 'Superseded') {
    return { who: '', txt: 'Superseded by a later version.', tab: 'ver', done: true };
  }
  const k = WF_ORDER.find((x) => !wfDone(v.data, x));
  if (!k) {
    return {
      who: 'Buyer',
      txt: 'All stages complete — review the NFA and click Submit for Approval at the bottom.',
      tab: 'nfa',
    };
  }
  return {
    who: STAGE_ROLE[k],
    txt: `Next step: ${STAGE_META[k][0]} — owner ${STAGE_ROLE[k]}`,
    tab: k,
  };
}

/* ===================== QUOTED TERMS ENGINE ===================== */
export const qtMonths = (v: unknown): number | null => {
  const s = String(v || '');
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:months?|mths?|mon\b|m\b)/i);
  if (m) return Number(m[1]);
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i);
  if (m) return Number(m[1]) * 12;
  m = s.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  return m ? Number(m[1]) : null;
};

export const qtLdCap = (v: unknown): number | null => {
  const s = String(v || '');
  let m = s.match(/max(?:imum)?\.?\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/i);
  if (m) return Number(m[1]);
  m = s.match(/(\d+(?:\.\d+)?)\s*%\s*(?:max|cap)/i);
  if (m) return Number(m[1]);
  return null;
};

interface QtRuleDef {
  dir?: 1 | -1;
  num?: 1;
  info?: 1;
  f?: (v: unknown, t: VendorTerms) => number | null;
  why: string;
}

export const QT_RULE: Record<string, QtRuleDef> = {
  basis: {
    dir: 1,
    f: (v) => {
      const s = String(v || '');
      if (!s.trim()) return null;
      if (/\b(FOR|DAP|DDP|DELIVERED|CIF|CFR|CIP|CPT|DOOR|SITE)\b/i.test(s)) return 2;
      if (/EX[\s-]?WORKS|\bEXW\b|\bFCA\b|\bFOB\b/i.test(s)) return 1;
      return null;
    },
    why: 'Destination basis (FOR / DAP / CIF) preferred – vendor carries freight and transit risk',
  },
  adv: { dir: -1, num: 1, why: 'Lower advance = lower cash outflow and lower risk' },
  advSec: {
    dir: 1,
    f: (v, t) => {
      if (!(Number(t.adv) > 0)) return null;
      const s = String(v || '').toUpperCase();
      if (/ABG|\bBG\b|BANK|\bLC\b/.test(s)) return 2;
      if (/\bSC\b|CHEQUE|CHECK|PDC/.test(s)) return 1;
      return 0;
    },
    why: 'Every advance should be secured by an Advance Bank Guarantee',
  },
  delDays: { dir: -1, num: 1, why: 'Shorter delivery period' },
  freight: {
    dir: 1,
    f: (v) => ({ Included: 2, 'Extra – fixed': 1, 'Extra at actuals': 0 }[String(v)] ?? null),
    why: 'Freight included / fixed avoids open-ended cost',
  },
  fr: { dir: -1, num: 1, why: 'Lower loading on the basic price' },
  pf: { dir: -1, num: 1, why: 'Lower loading on the basic price' },
  ins: { dir: -1, num: 1, why: 'Lower loading on the basic price' },
  oth: { dir: -1, num: 1, why: 'Lower loading on the basic price' },
  LF: {
    dir: -1,
    num: 1,
    why: 'Total loading on basic price (freight + P&F + insurance + other)',
  },
  gst: {
    info: 1,
    why: 'Statutory – a difference usually means a different HSN / tax classification; verify',
  },
  warr: {
    dir: 1,
    f: (v) => qtMonths(v),
    why: 'Longer warranty; ‘from commissioning’ is better than ‘from supply’',
  },
  pbg: { dir: 1, num: 1, why: 'Higher performance bank guarantee = better protection' },
  ld: { dir: 1, f: (v) => qtLdCap(v), why: 'Higher LD cap gives stronger protection against delay' },
  insp: {
    dir: 1,
    f: (v) =>
      ({
        'Buyer witness at vendor works': 3,
        TPI: 3,
        'In-house': 1,
        'Not required': 0,
      }[String(v)] ?? null),
    why: 'Independent / witnessed inspection preferred for critical items',
  },
  valid: { dir: 1, num: 1, why: 'Longer validity covers negotiation and the approval cycle' },
  firm: {
    dir: 1,
    f: (v) => (/firm/i.test(String(v || '')) ? 1 : /variab|escal|pvc/i.test(String(v || '')) ? 0 : null),
    why: 'Firm prices preferred over variable / escalation',
  },
  reg: {
    dir: 1,
    f: (v) => (v === 'Yes' ? 1 : v === 'No' ? 0 : null),
    why: 'Vendor should be registered in ERP before PO',
  },
  dev: {
    dir: 1,
    f: (v) => (String(v || '').trim() ? 0 : 1),
    why: 'Deviations from RFQ must be resolved before award',
  },
  pay: { info: 1, why: 'Payment terms differ – compare advance %, security and credit period' },
  delLoc: { info: 1, why: 'Delivery location differs – confirm the landed basis is comparable' },
  delTxt: {
    info: 1,
    why: 'Delivery wording differs – check the trigger (from PO / advance / drawing approval)',
  },
};

export const qtHas = (v: unknown): boolean => v != null && String(v).trim() !== '';

export function qtLf(t: Partial<VendorTerms>): number | null {
  const ks = ['fr', 'pf', 'ins', 'oth'];
  if (!ks.some((k) => qtHas(t[k]))) return null;
  return ks.reduce((s, k) => s + (Number(t[k]) || 0), 0);
}

export function qtScore(k: string, t: VendorTerms): number | null {
  const r = QT_RULE[k];
  if (!r || r.info) return null;
  const v = k === 'LF' ? t.__lf : t[k];
  if (r.f) return r.f(v, t);
  if (r.num) {
    const n = num(v);
    return n == null || Number.isNaN(n) ? null : n;
  }
  return null;
}

export function qtDisp(k: string, t: Partial<VendorTerms>): string {
  if (k === 'dev' && !qtHas(t.dev)) return 'None';
  if (k === 'LF') return t.__lf == null ? '' : `${t.__lf.toFixed(2)}%`;
  const v = t[k];
  if (!qtHas(v)) return '';
  const ty = (TERMS.find((x) => x[0] === k) || [])[2];
  return ty === 'p' ? `${v}%` : String(v);
}

export const qtQV = (d: NfaData) =>
  d.vendors
    .map((v, j) => ({ v, j }))
    .filter((x) => String(x.v.name || '').trim() && d.items.some((it) => num(it.r?.[x.j]?.q) != null));

export function qtFlags(t: VendorTerms, band: number): string[] {
  const f: string[] = [];
  if (Number(t.adv) > 0 && QT_RULE.advSec.f!(t.advSec, t) === 0)
    f.push(`Advance ${t.adv}% without bank guarantee`);
  if (qtHas(t.dev)) f.push('Deviations from RFQ declared');
  if (qtHas(t.valid) && Number(t.valid) < (band || 5) + 20)
    f.push(`Offer validity ${t.valid} days – extend to cover negotiation + approval`);
  if (/variab|escal|pvc/i.test(String(t.firm || ''))) f.push('Variable / escalation price');
  if (t.reg === 'No') f.push('Not registered in ERP');
  return f;
}

export function qtFlagOf(k: string, t: VendorTerms, band: number): boolean {
  return (
    (k === 'advSec' && Number(t.adv) > 0 && QT_RULE.advSec.f!(t.advSec, t) === 0) ||
    (k === 'dev' && qtHas(t.dev)) ||
    (k === 'valid' && qtHas(t.valid) && Number(t.valid) < band + 20) ||
    (k === 'firm' && /variab|escal|pvc/i.test(String(t.firm || ''))) ||
    (k === 'reg' && t.reg === 'No')
  );
}

export function qtEval(k: string, ts: { j: number; t: VendorTerms }[]): QtEvalResult {
  const r = QT_RULE[k] || {};
  const sc = ts
    .map((x) => ({ j: x.j, s: qtScore(k, x.t) }))
    .filter((x): x is { j: number; s: number } => x.s != null);
  if (r.info) {
    const vals = [...new Set(ts.map((x) => String(x.t[k] ?? '').trim()).filter(Boolean))];
    return {
      best: [],
      worst: [],
      equal: vals.length <= 1,
      diff: vals.length > 1,
      note: vals.length > 1 ? r.why : '',
    };
  }
  if (sc.length < 2) return { best: [], worst: [], equal: true, note: '' };
  const adj = sc.map((x) => ({ ...x, a: x.s * (r.dir || 1) }));
  const mx = Math.max(...adj.map((x) => x.a));
  const mn = Math.min(...adj.map((x) => x.a));
  if (mx === mn) return { best: [], worst: [], equal: true, note: 'Same for all vendors' };
  return {
    best: adj.filter((x) => x.a === mx).map((x) => x.j),
    worst: adj.filter((x) => x.a === mn).map((x) => x.j),
    equal: false,
    note: r.why || '',
  };
}

export function qtCore(d: NfaData, src: 'q' | 'n', doa: DoaBand[] = DEF_DOA): QtModel {
  const c = calc(d, doa);
  const base = d.header.cur || 'INR';
  const band = c.band?.days || 5;
  let qv = qtQV(d);
  if (src === 'n') qv = qv.filter(({ j }) => d.items.some((it) => num(it.r?.[j]?.n) != null));

  const vend = qv.map(({ v, j }) => {
    const qt = Object.assign({}, v.qterms || {}) as VendorTerms;
    const nt = Object.assign({}, v.terms || {}) as VendorTerms;
    qt.__lf = qtLf(qt);
    nt.__lf = qtLf(nt);
    const t = src === 'n' ? nt : qt;
    return {
      j,
      name: v.name,
      cur: v.terms?.cur || base,
      fx: c.fx[j],
      qt,
      nt,
      t,
      ref: v.ref || '',
      qdate: v.qdate || '',
      landed: 0,
      basic: 0,
      items: 0,
      complete: false,
      comparable: 0,
      priceIdx: 0,
      flags: qtFlags(t, band),
      score: 0,
      rank: 0,
      priceRank: null as number | null,
      bestCount: 0,
    };
  });

  const items = d.items.map((it, i) => {
    const qty = Number(it.qty) || 0;
    const cells = vend.map((V) => {
      const r = num(it.r?.[V.j]?.[src]);
      const basic = r == null || V.fx == null ? null : qty * r * V.fx;
      const landed = basic == null ? null : basic * (1 + (V.t.__lf || 0) / 100);
      return { r, basic, landed };
    });
    const ls = cells
      .map((x, k) => ({ k, v: x.landed }))
      .filter((x): x is { k: number; v: number } => x.v != null)
      .sort((a, b) => a.v - b.v);
    return {
      i,
      code: it.code,
      desc: it.desc,
      uom: it.uom,
      qty,
      cells,
      l1: ls[0] ? ls[0].v : null,
      l1k: ls[0] ? ls[0].k : null,
    };
  });

  vend.forEach((V, k) => {
    let tot = 0;
    let cnt = 0;
    let comp = 0;
    let bs = 0;
    items.forEach((it) => {
      const x = it.cells[k];
      if (x.landed != null && it.l1 != null && x.basic != null) {
        tot += x.landed;
        bs += x.basic;
        cnt++;
        comp += it.l1;
      }
    });
    V.landed = tot;
    V.basic = bs;
    V.items = cnt;
    V.complete = cnt === items.length && items.length > 0;
    V.comparable = comp;
    V.priceIdx = tot > 0 ? comp / tot : 0;
  });

  const valFor = (V: (typeof vend)[number], key: string): number | null =>
    key === 'price'
      ? V.priceIdx
      : key === 'del'
      ? num(V.t.delDays)
      : key === 'adv'
      ? num(V.t.adv)
      : key === 'warr'
      ? qtMonths(V.t.warr)
      : key === 'valid'
      ? num(V.t.valid)
      : key === 'ld'
      ? qtLdCap(V.t.ld)
      : num(V.t.pbg);

  const scores = QT_W.map(([key, lab, w]) => {
    const vals = vend.map((V) => {
      const x = valFor(V, key);
      return x == null || Number.isNaN(x) ? null : x;
    });
    const ok = vals.filter((x): x is number => x != null);
    let pts: number[];
    if (key === 'price') {
      pts = vals.map((x) => w * (x || 0));
    } else if (key === 'del') {
      const mn = Math.min(...ok);
      pts = vals.map((x) => (x != null && x > 0 && mn > 0 && Number.isFinite(mn) ? (w * mn) / x : 0));
    } else if (key === 'adv') {
      const mn = Math.min(...ok);
      pts = vals.map((x) =>
        x == null || !Number.isFinite(mn) || mn >= 100 ? 0 : (w * (100 - x)) / (100 - mn)
      );
    } else {
      const mx = Math.max(0, ...ok);
      pts = vals.map((x) => (mx > 0 && x != null ? (w * x) / mx : 0));
    }
    return { key, lab, w, vals, pts };
  });

  vend.forEach((V, k) => {
    V.score = scores.reduce((s, x) => s + x.pts[k], 0);
  });
  const order = [...vend].sort((a, b) => b.score - a.score);
  vend.forEach((V) => {
    V.rank = order.indexOf(V) + 1;
  });
  const po = [...vend].filter((V) => V.complete).sort((a, b) => a.landed - b.landed);
  vend.forEach((V) => {
    V.priceRank = V.complete ? po.indexOf(V) + 1 : null;
  });
  const rows = TERMS.map(([k, lab, ty]) => ({
    k,
    lab,
    ty,
    ev: qtEval(
      k,
      vend.map((V) => ({ j: V.j, t: V.t }))
    ),
  }));
  vend.forEach((V) => {
    V.bestCount = rows.filter((r) => !r.ev.equal && r.ev.best.includes(V.j)).length;
  });

  return {
    src,
    c,
    base,
    band,
    vend,
    items,
    rows,
    scores,
    best: order[0] || null,
    anyTerms: vend.some((V) => QT_KEYS().some((k) => qtHas(V.t[k]))),
  };
}

export function qtChange(
  k: string,
  qt: Partial<VendorTerms>,
  nt: Partial<VendorTerms>
): 'same' | 'better' | 'worse' | 'changed' | 'added' {
  if (k === 'LF') {
    const a = qt.__lf;
    const b = nt.__lf;
    if (a == null && b == null) return 'same';
    if (a === b) return 'same';
    const r = QT_RULE.LF;
    if (a == null || b == null) return 'changed';
    return (b - a) * (r.dir || 1) > 0 ? 'better' : 'worse';
  }
  const a = String(qt[k] ?? '').trim();
  const b = String(nt[k] ?? '').trim();
  if (
    a === b ||
    (qtHas(a) && qtHas(b) && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b)) && Number(a) === Number(b))
  ) {
    return 'same';
  }
  if (!qtHas(a)) return 'added';
  const r = QT_RULE[k];
  if (!r || r.info) return 'changed';
  const sa = qtScore(k, qt as VendorTerms);
  const sb = qtScore(k, nt as VendorTerms);
  if (sa == null || sb == null || sa === sb) return 'changed';
  return (sb - sa) * (r.dir || 1) > 0 ? 'better' : 'worse';
}

export function qtPoints(M: QtModel): NegotiationPoint[] {
  const P: NegotiationPoint[] = [];
  const nm = (j: number) => M.vend.find((V) => V.j === j)?.name || '';
  M.vend.forEach((V, k) => {
    const above = M.items
      .filter((it) => it.cells[k].landed != null && it.l1 != null && it.l1k !== k)
      .map((it) => ({ it, g: (it.cells[k].landed as number) / (it.l1 as number) - 1 }))
      .sort((a, b) => b.g - a.g);
    const lowest =
      [...M.vend].filter((x) => x.complete).sort((a, b) => a.landed - b.landed)[0] === V;
    const gapTxt = above
      .slice(0, 3)
      .map((x) => `${x.it.code || `Item ${x.it.i + 1}`} +${(x.g * 100).toFixed(1)}%`)
      .join(', ');
    if (V.priceIdx > 0 && V.priceIdx < 0.9999) {
      P.push({
        v: V.name,
        topic: 'Price',
        cur: lowest
          ? `Lowest total landed value, but not lowest on ${above.length} item(s)`
          : `Total landed value ${((1 / V.priceIdx - 1) * 100).toFixed(1)}% above the best price per item`,
        best: `Best price per item (item-wise L1): ${gapTxt}`,
        ask: lowest
          ? `Hold total; ask to match L1 on ${gapTxt.replace(/ \+[\d.]+%/g, '')}`
          : `Reduce to L1 level, starting with ${gapTxt.replace(/ \+[\d.]+%/g, '')}`,
        pri: lowest ? 'Medium' : 1 / V.priceIdx - 1 > 0.05 ? 'High' : 'Medium',
      });
    } else if (V.priceIdx > 0) {
      P.push({
        v: V.name,
        topic: 'Price',
        cur: 'L1 on every item quoted',
        best: '—',
        ask: 'Hold price; seek a further discount for quantity / early payment',
        pri: 'Low',
      });
    }
    if (!V.complete) {
      P.push({
        v: V.name,
        topic: 'Scope',
        cur: `Quoted ${V.items} of ${M.items.length} items`,
        best: 'All items',
        ask: 'Ask to quote the missing items or confirm regret',
        pri: 'Medium',
      });
    }
    M.rows.forEach((r) => {
      if (r.ev.equal || !r.ev.best.length || r.ev.best.includes(V.j) || QT_RULE[r.k]?.info) return;
      if (['fr', 'pf', 'ins', 'oth', 'reg', 'dev', 'advSec', 'firm'].includes(r.k)) return;
      const bj = r.ev.best[0];
      const bv = M.vend.find((x) => x.j === bj)!;
      const cur = qtDisp(r.k, V.t) || 'not stated';
      const bst = qtDisp(r.k, bv.t);
      const pri: 'High' | 'Medium' | 'Low' = ['adv', 'delDays', 'freight', 'basis', 'LF'].includes(
        r.k
      )
        ? 'High'
        : ['warr', 'valid', 'ld', 'pbg'].includes(r.k)
        ? 'Medium'
        : 'Low';
      P.push({
        v: V.name,
        topic: r.lab,
        cur,
        best: `${bst} (${nm(bj)})`,
        ask: `Match the best offer in this RFQ: ${bst}`,
        pri,
      });
    });
    V.flags.forEach((f) =>
      P.push({
        v: V.name,
        topic: 'Risk',
        cur: f,
        best: '—',
        ask: /Advance/.test(f)
          ? 'Advance only against ABG of equal value'
          : /Deviation/.test(f)
          ? 'Withdraw deviations or get technical acceptance in writing'
          : /validity/.test(f)
          ? 'Extend validity in writing'
          : /Variable/.test(f)
          ? 'Convert to firm price'
          : 'Complete vendor registration before PO',
        pri: 'High',
      })
    );
    QT_REQ.forEach((k) => {
      if (!qtHas(V.t[k])) {
        P.push({
          v: V.name,
          topic: (TERMS.find((t) => t[0] === k) || [])[1] || k,
          cur: 'Not stated in quotation',
          best: '—',
          ask: 'Obtain written confirmation',
          pri: 'Medium',
        });
      }
    });
  });
  const pr: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  return P.sort((a, b) => (a.v === b.v ? pr[a.pri] - pr[b.pri] : 0));
}

export function qnStats(d: NfaData, doa: DoaBand[] = DEF_DOA) {
  const Q = qtCore(d, 'q', doa);
  const Nn = qtCore(d, 'n', doa);
  return Q.vend.map((V, k) => {
    const nk = Nn.vend.findIndex((x) => x.j === V.j);
    const NV = Nn.vend[nk];
    const ql = NV
      ? Q.items.reduce(
          (s, it) =>
            s +
            (it.cells[k].landed != null && Nn.items[it.i].cells[nk].landed != null
              ? (it.cells[k].landed as number)
              : 0),
          0
        )
      : V.landed;
    const ch = TERMS.map(([kk]) => qtChange(kk, V.qt, V.nt));
    return {
      V,
      NV,
      ql,
      nl: NV ? NV.landed : null,
      sav: NV ? ql - NV.landed : null,
      pct: NV && ql ? (ql - NV.landed) / ql : null,
      imp: ch.filter((x) => x === 'better').length,
      wor: ch.filter((x) => x === 'worse').length,
      chg: ch.filter((x) => x !== 'same').length,
    };
  });
}

/* ===================== CRYPTO & VERSION CHAIN ===================== */
function sha256Fallback(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const padLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(padLen);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const dv = new DataView(data.buffer);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000));
  dv.setUint32(padLen - 4, bitLen >>> 0);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padLen; off += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}

export async function shaObj(o: unknown): Promise<string> {
  const msg = JSON.stringify(o);
  const subtle = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto.subtle : undefined;
  if (subtle && typeof subtle.digest === 'function') {
    const b = await subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(msg);
}

export const sealBody = (v: NfaVersion) => ({
  ver: v.ver,
  createdOn: v.createdOn,
  createdBy: v.createdBy,
  reason: v.reason,
  prev: v.prev || null,
  prevHash: v.prevHash || '',
  submittedOn: v.submittedOn || null,
  value: v.value ?? null,
  valueInr: v.valueInr ?? null,
  currency: v.currency || null,
  band: v.band || null,
  lockedOn: v.lockedOn,
  approvals: v.approvals,
  data: v.data,
});

export async function sealVersion(n: NfaRecord, v: NfaVersion): Promise<void> {
  const i = n.versions.indexOf(v);
  v.hashV = 2;
  v.prevHash = i > 0 ? n.versions[i - 1].hash || '' : '';
  v.hash = await shaObj(sealBody(v));
}

export async function verifyVersionChain(n: NfaRecord): Promise<Record<string, boolean | null>> {
  const r: Record<string, boolean | null> = {};
  for (let i = 0; i < n.versions.length; i++) {
    const v = n.versions[i];
    if (!v.hash) {
      r[v.ver] = null;
      continue;
    }
    const h2 = v.hashV === 2 ? await shaObj(sealBody(v)) : await shaObj(v.data);
    const chain = v.hashV !== 2 || v.prevHash === (i > 0 ? n.versions[i - 1].hash || '' : '');
    r[v.ver] = h2 === v.hash && chain;
  }
  return r;
}

export function diffObjects(a: unknown, b: unknown, p = ''): [string, unknown, unknown][] {
  let out: [string, unknown, unknown][] = [];
  const aRec = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
  const bRec = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
  const ks = new Set([...Object.keys(aRec), ...Object.keys(bRec)]);
  ks.forEach((k) => {
    const x = aRec[k];
    const y = bRec[k];
    const pp = p ? `${p}.${k}` : k;
    if (typeof x === 'object' && x && typeof y === 'object' && y) {
      out = out.concat(diffObjects(x, y, pp));
    } else if (JSON.stringify(x) !== JSON.stringify(y)) {
      out.push([pp, x, y]);
    }
  });
  return out;
}

/* ===================== PR PARSING & VALIDATION ===================== */
export const prLineKey = (l: PrLine): string => String(l.prLineId || '');

function prNormDate0(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const M: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})$/);
  if (m) {
    const mo = M[m[2].toLowerCase()];
    if (mo) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return `INVALID:${s}`;
}

export function prNormDate(v: unknown): string {
  const r = prNormDate0(v);
  if (!r || r.startsWith('INVALID')) return r;
  const [y, m, dd] = r.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  return dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === dd &&
    y > 1990 &&
    y < 2100
    ? r
    : `INVALID:${String(v).trim()}`;
}

export function prNum(v: unknown): number | string {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : `INVALID:${v}`;
}

export function prRecalc(l: PrLine): PrLine {
  const rq = Number(l.requestedQty) || 0;
  const ps = Number(l.previouslySourcedQty) || 0;
  l.openQty = Math.max(0, +(rq - ps).toFixed(4));
  l.lineStatus = l.openQty > 0 ? 'Open' : 'Fully sourced';
  l.documents = l.specDocRef
    ? [{ documentName: l.specDocRef, documentType: 'Reference (manual)', documentRevision: '', isCurrent: true }]
    : [];
  l.uomCode = String(l.uomCode || '').trim().toUpperCase();
  return l;
}

export function prLineIssues(l: PrLine, all: PrLine[]): string[] {
  const e: string[] = [];
  PR_COLS.filter((c) => c[2]).forEach(([k, h]) => {
    if (String(l[k] ?? '').trim() === '') e.push(`${h.replace(/_/g, ' ')} missing`);
  });
  if (l.approvalStatus && l.approvalStatus !== 'Approved')
    e.push(`PR not approved (${l.approvalStatus})`);
  PR_NUM.forEach((k) => {
    if (String(l[k]).startsWith('INVALID:'))
      e.push(k === 'requestedQty' ? 'PR qty not a number' : 'Already sourced qty not a number');
  });
  if (!String(l.requestedQty).startsWith('INVALID') && l.requestedQty !== '' && !(Number(l.requestedQty) > 0))
    e.push('PR qty must be > 0');
  if (Number(l.previouslySourcedQty) < 0) e.push('Already sourced cannot be negative');
  if (Number(l.requestedQty) > 0 && Number(l.previouslySourcedQty) >= Number(l.requestedQty))
    e.push('No open quantity (fully sourced)');
  PR_DATE.forEach((k) => {
    if (String(l[k]).startsWith('INVALID:'))
      e.push(`${k === 'prDate' ? 'PR date' : 'Need-by date'} invalid – use YYYY-MM-DD or DD-MM-YYYY`);
  });
  if (
    l.prDate &&
    l.needByDate &&
    !String(l.prDate).startsWith('INV') &&
    !String(l.needByDate).startsWith('INV') &&
    l.needByDate < l.prDate
  ) {
    e.push('Need-by before PR date');
  }
  if (all && l.prNumber && l.prLineNumber) {
    const dup = all.filter(
      (x) =>
        x !== l &&
        String(x.prNumber).trim().toUpperCase() === String(l.prNumber).trim().toUpperCase() &&
        String(x.prLineNumber).trim() === String(l.prLineNumber).trim()
    ).length;
    if (dup) e.push('Duplicate PR number + line');
  }
  return e;
}

export const prNewId = () =>
  `MAN-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function csvParse(text: string): string[][] {
  const clean = String(text).replace(/^\uFEFF/, '');
  const first = clean.split(/\r?\n/)[0] || '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(f);
      f = '';
    } else if (ch === '\n') {
      row.push(f);
      rows.push(row);
      row = [];
      f = '';
    } else if (ch !== '\r') f += ch;
  }
  if (f !== '' || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

export const csvCell = (v: unknown): string => {
  const s = String(v ?? '');
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function prTemplateCSV(withSample: boolean): string {
  const h = PR_COLS.map((c) => c[1] + (c[2] ? '*' : ''));
  const rows = [h.join(',')];
  if (withSample) {
    rows.push(PR_COLS.map((c) => csvCell(c[3])).join(','));
    const row2Overrides: Record<string, string> = {
      prLineNumber: '20',
      itemCode: 'SP-BRG-6312',
      itemDescription: 'Deep Groove Ball Bearing 6312 2RS',
      itemLongDescription: '',
      requestedQty: '40',
      previouslySourcedQty: '0',
      specDocRef: '',
      category: 'MRO Spares',
    };
    rows.push(PR_COLS.map((c) => csvCell(row2Overrides[c[0]] ?? c[3])).join(','));
  }
  return rows.join('\r\n') + '\r\n';
}

export function downloadBlob(name: string, data: BlobPart, type: string): void {
  const b = new Blob([data], { type });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

export function portfolioMetrics(s: EnfaStore) {
  return Object.values(s.nfas).map((n) => {
    const v = getActiveVersion(n);
    let val = v.value;
    if (val == null || v.status === 'Draft') {
      try {
        val = calc(v.data, s.doa).total;
      } catch {
        val = 0;
      }
    }
    const pend =
      v.status === 'Pending' ? v.approvals.find((a) => a.action === 'Pending') || null : null;
    const age =
      v.status === 'Pending' && v.submittedOn
        ? (Date.now() - new Date(v.submittedOn).getTime()) / 864e5
        : null;
    return {
      id: n.id,
      no: n.no,
      ver: v.ver,
      status: v.status,
      title: v.data.project?.name || v.data.header?.desc || '',
      cur: v.data.header?.cur || 'INR',
      val: val || 0,
      pend,
      age,
      band: v.band?.days,
    };
  });
}

export const backupDue = (s: EnfaStore): boolean =>
  !s.lastBackup || Date.now() - new Date(s.lastBackup).getTime() > 7 * 864e5;
