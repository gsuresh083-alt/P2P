import type { CalcResult, NfaRecord, NfaVersion } from '../types/enfa.ts';
import { TERMS } from './enfaConstants.ts';
import { bandOf, checks, fmt, fmtD, num, pct, route } from './enfaEngine.ts';

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));

export function buildPrintableNfaHtml(nfa: NfaRecord, ver: NfaVersion, c: CalcResult): string {
  const d = ver.data;
  const h = d.header;
  const cu = h.cur || 'INR';
  const ck = checks(d, c);
  const ready = ck.every((x) => x[1]);
  const awV = c.split
    .filter((s) => s.val > 0)
    .map((s) => esc(s.name))
    .join(', ');
  const approvalRows = ver.approvals.length
    ? ver.approvals
    : route(c).map((x) => ({ ...x, action: '', name: '', date: '', comment: '' }));

  const wasT = (j: number, k: string) => {
    const v = d.vendors[j];
    if (!v?.qterms) return '';
    const a = String(v.qterms[k] ?? '').trim();
    const b = String(v.terms[k] ?? '').trim();
    if (!a || a === b) return '';
    const isPct = TERMS.find((t) => t[0] === k)?.[2] === 'p';
    return `<br><small class="was">quoted: ${esc(a)}${isPct ? '%' : ''}</small>`;
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(nfa.no)}_${esc(ver.ver)} — Note for Approval</title>
<style>
@page { size: A4 landscape; margin: 8mm 9mm; }
body { font-family: "Segoe UI", Inter, system-ui, sans-serif; font-size: 9.5px; color: #111827; margin: 0; padding: 14px; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.nfa-hero { display: flex; justify-content: space-between; gap: 16px; padding: 12px 16px; border-radius: 6px; background: #1E293B; border-bottom: 3px solid #C99A2E; color: #fff; margin-bottom: 10px; }
.nfa-brandline { font-size: 9px; letter-spacing: 1px; color: #94A3B8; font-weight: 700; }
.nfa-hero-title { font-size: 18px; font-weight: 700; letter-spacing: 1.2px; }
.nfa-hero-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; min-width: 240px; }
.nfa-meta-chip { padding: 5px 8px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); border-radius: 4px; }
.nfa-meta-chip span { display: block; font-size: 7.5px; text-transform: uppercase; color: #94A3B8; }
.nfa-meta-chip b { font-size: 11px; color: #fff; }
h3 { font-size: 10.5px; text-transform: uppercase; border-bottom: 1.5px solid #111827; padding: 3px 0; margin: 12px 0 6px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px; }
th, td { border: 1px solid #D1D5DB; padding: 4px 5px; vertical-align: top; text-align: left; }
th { background: #F3F4F6; font-weight: 700; font-size: 8.5px; text-transform: uppercase; }
td.l { background: #F9FAFB; font-weight: 600; color: #374151; }
td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.g { background: #ECFDF3; color: #067647; font-weight: 700; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0; }
.kpi { border: 1px solid #D1D5DB; border-top: 3px solid #0F766E; padding: 6px 8px; border-radius: 4px; }
.kpi span { display: block; font-size: 8px; color: #6B7280; text-transform: uppercase; font-weight: 700; }
.kpi b { font-size: 13px; }
.rec { background: #ECF7F5; border: 1px solid #A7D8D0; border-left: 4px solid #0F766E; padding: 8px 10px; border-radius: 4px; margin: 8px 0; }
.ok { color: #067647; font-weight: 700; }
.bad { color: #B42318; font-weight: 700; }
.was { color: #6B7280; font-style: italic; }
.checks { font-size: 8px; border: 1px solid #D1D5DB; padding: 5px 7px; margin: 6px 0; }
.footer { display: flex; justify-content: space-between; border-top: 1px solid #D1D5DB; padding-top: 6px; margin-top: 12px; color: #6B7280; font-size: 8px; }
</style>
</head>
<body>
<div class="nfa-hero">
  <div>
    <div class="nfa-brandline">AFRZEN · SUPPLY CHAIN MANAGEMENT</div>
    <div class="nfa-hero-title">NOTE FOR APPROVAL</div>
    <div>Purchase proposal · Commercial evaluation and award recommendation · <b>${esc(ver.status.toUpperCase())}</b></div>
  </div>
  <div class="nfa-hero-meta">
    <div class="nfa-meta-chip"><span>NFA Reference</span><b>${esc(nfa.no)}</b></div>
    <div class="nfa-meta-chip"><span>Version</span><b>${esc(ver.ver)}</b></div>
    <div class="nfa-meta-chip"><span>Company</span><b>${esc(h.company || '—')}</b></div>
    <div class="nfa-meta-chip"><span>Prepared Date</span><b>${esc((ver.createdOn || '').slice(0, 10) || '—')}</b></div>
  </div>
</div>

<table>
  <tr><td class="l">Company / Plant</td><td>${esc(h.company)} / ${esc(h.plant || '—')}</td><td class="l">PR No / Date</td><td>${esc(h.prNo || '—')} / ${esc(h.prDate || '—')}</td></tr>
  <tr><td class="l">Budget / Code</td><td>${esc(h.budget)} / ${esc(h.budgetCode || '—')}</td><td class="l">Required By</td><td>${esc(h.needBy || '—')}</td></tr>
  <tr><td class="l">Category / Route</td><td>${esc(h.cat)} / <b>${esc(h.route)}</b></td><td class="l">RFQ No / Date</td><td>${esc(h.rfqNo || '—')} / ${esc(h.rfqDate || '—')}</td></tr>
</table>

<div class="kpis">
  <div class="kpi"><span>Order value (landed, excl. tax)</span><b>${esc(cu)} ${esc(fmt(c.total, 0, cu))}</b></div>
  <div class="kpi"><span>Negotiation saving</span><b>${esc(fmt(c.sav, 0, cu))} · ${esc(pct(c.savPct))}</b></div>
  <div class="kpi"><span>Vendors contacted / quoted / tech OK</span><b>${esc(h.contacted || '—')} / ${c.quoted} / ${c.tokCount}</b></div>
  <div class="kpi"><span>vs LPP (basic) / vs Estimate</span><b>${c.lppSum.pct == null ? 'No LPP' : `${c.lppSum.pct > 0 ? '▲ +' : '▼ '}${(c.lppSum.pct * 100).toFixed(1)}%`} / ${num(h.estimate) != null ? esc(fmt(c.total - Number(h.estimate), 0, cu)) : '—'}</b></div>
</div>

<div class="rec"><b>RECOMMENDATION:</b> Award on <b>item-wise Buyer-selected ranked vendor basis</b> to ${awV || '—'} for a total landed value of <b>${esc(cu)} ${esc(fmt(c.total, 0, cu))}</b> (excl. tax), with negotiated saving of ${esc(cu)} ${esc(fmt(c.sav, 0, cu))} (${esc(pct(c.savPct))}). Final approving authority: <b>${esc(bandOf(ver, c).final)}</b>.</div>

<h3>1. Buyer award selection &amp; approval rationale</h3>
<table>
  <tr><td class="l">Award Basis</td><td>Item-wise L1 by default; Buyer may select another eligible ranked vendor with justification</td><td class="l">Package L1 (CS)</td><td>${c.pkgJ == null ? 'No complete package' : esc(d.vendors[c.pkgJ]?.name)}</td></tr>
  <tr><td class="l">Requirement &amp; Justification</td><td colspan="3">${esc(h.desc)}${h.just ? ` — ${esc(h.just)}` : ''}</td></tr>
  <tr><td class="l">Selection Rationale</td><td colspan="3">${esc(d.nfa.rationale || '—')}</td></tr>
  ${String(d.nfa.nonL1 || '').trim() ? `<tr><td class="l">Non-L1 / Single Source Justification</td><td colspan="3">${esc(d.nfa.nonL1)}</td></tr>` : ''}
  ${String(d.nfa.lppJust || '').trim() ? `<tr><td class="l">Overall LPP Remarks</td><td colspan="3">${esc(d.nfa.lppJust)}</td></tr>` : ''}
  ${String(d.nfa.special || '').trim() ? `<tr><td class="l">Special Conditions</td><td colspan="3">${esc(d.nfa.special)}</td></tr>` : ''}
  ${String(d.nfa.remarks || '').trim() ? `<tr><td class="l">Buyer Remarks</td><td colspan="3">${esc(d.nfa.remarks)}</td></tr>` : ''}
</table>

<h3>2. Item-wise Buyer vendor selection</h3>
<table>
  <tr><th>#</th><th>Item Code</th><th>Description</th><th>Qty</th><th>CS L1</th><th>Awarded Vendor</th><th>Justification</th><th class="n">Awarded Landed (${esc(cu)})</th><th class="n">Saving</th></tr>
  ${c.rows.map((r, i) => {
    const a = c.aw[i];
    return `<tr><td>${i + 1}</td><td>${esc(r.it.code)}</td><td>${esc(r.it.desc)}</td><td class="n">${esc(fmt(r.qty, 2, cu))}</td><td>${r.l1j == null ? '—' : esc(d.vendors[r.l1j]?.name)}</td><td class="g">${a.j == null ? '—' : esc(d.vendors[a.j]?.name)}</td><td>${esc(d.nfa.ovr?.[String(i)] || '—')}</td><td class="n">${esc(fmt(a.landed, 0, cu))}</td><td class="n ok">${esc(fmt(a.sav, 0, cu))}</td></tr>`;
  }).join('')}
  <tr><td colspan="7" class="l">TOTAL</td><td class="n g">${esc(fmt(c.total, 0, cu))}</td><td class="n ok">${esc(fmt(c.sav, 0, cu))}</td></tr>
</table>

<h3>3. Vendor-wise PO split &amp; commercial terms</h3>
<table>
  <tr><th>Vendor</th><th>Cur / FX</th><th>Award Value</th><th>Share</th><th>Price Basis</th><th>Payment</th><th>Delivery</th><th>Warranty</th><th>PBG / LD</th></tr>
  ${c.split.filter((s) => s.val > 0).map((s) => {
    const t = d.vendors[s.j].terms;
    return `<tr><td class="l">${esc(s.name)}</td><td>${esc(t.cur || cu)}${(t.cur || cu) !== cu ? ` @ ${esc(fmt(t.fxRate, 4, cu))}` : ''}</td><td class="n">${esc(fmt(s.val, 0, cu))}</td><td class="n">${esc(pct(s.share))}</td><td>${esc(t.basis)}${wasT(s.j, 'basis')}</td><td>${esc(t.pay)}${wasT(s.j, 'pay')}</td><td>${esc(t.delTxt)}${wasT(s.j, 'delTxt')}</td><td>${esc(t.warr)}${wasT(s.j, 'warr')}</td><td>${esc(t.pbg || '—')}% / ${esc(t.ld || '—')}</td></tr>`;
  }).join('')}
</table>

<div class="checks"><b>Pre-submission validation: ${ck.filter((x) => x[1]).length} of ${ck.length} checks passed${ready ? ' — ready' : ''}.</b> ${ck.map((x) => `${x[1] ? '✓' : '✕'} ${esc(x[0])}`).join(' · ')}</div>

<h3>4. Approval &amp; sign-off</h3>
<table>
  <tr><th>Level</th><th>Role</th><th>Name &amp; Designation</th><th>Decision</th><th>Date / Time</th><th>Comments</th></tr>
  <tr><td>L0</td><td class="l">Prepared By (Buyer)</td><td>${esc(h.buyer || '')}</td><td>${ver.submittedOn ? 'Submitted' : ''}</td><td>${esc(fmtD(ver.submittedOn))}</td><td></td></tr>
  ${approvalRows.map((a) => `<tr><td>${esc(a.lv)}</td><td class="l">${esc(a.role)}</td><td>${esc(a.name || '')}</td><td>${esc(a.action || '')}</td><td>${esc(fmtD(a.date))}</td><td>${esc(a.comment || '')}</td></tr>`).join('')}
</table>

<div class="footer"><span>AFRZEN · CONFIDENTIAL PROCUREMENT DOCUMENT</span><span>${esc(nfa.no)} · ${esc(ver.ver)} · ${esc(ver.status)}</span><span>Generated from e-NFA</span></div>
<script>window.onload = function(){ if (location.search.indexOf('autoprint=1') >= 0) window.print(); };</script>
</body>
</html>`;
}
