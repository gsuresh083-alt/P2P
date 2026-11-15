import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CalcResult, NfaVersion, Vendor } from '../../types/enfa.ts';
import { fmt, fmtD, pct, route, shortK } from '../../utils/enfaEngine.ts';

const CH_PAL = [
  'var(--t-acc)',
  '#6366F1',
  '#D97706',
  '#0EA5E9',
  '#DB2777',
  '#65A30D',
  '#7C3AED',
  '#0891B2',
];

const RECHARTS_PAL = [
  '#0F766E',
  '#6366F1',
  '#D97706',
  '#0EA5E9',
  '#DB2777',
  '#65A30D',
  '#7C3AED',
  '#0891B2',
];

export const RingChart: React.FC<{
  progress: number;
  size?: number;
  label?: string;
}> = ({ progress, size = 64, label }) => {
  const p = Math.max(0, Math.min(1, progress || 0));
  const r = size / 2 - 6;
  const C = 2 * Math.PI * r;
  return (
    <svg
      className="ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(p * 100)}%`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--t-line)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--t-acc)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${C * p} ${C}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-arc"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size / 4.6}
        fontWeight={800}
        fill="var(--t-tx)"
      >
        {label ?? `${Math.round(p * 100)}%`}
      </text>
    </svg>
  );
};

export interface DonutPart {
  v: number;
  l: string;
  c: string;
  t?: string;
}

export const DonutChart: React.FC<{
  parts: DonutPart[];
  center: string;
  sub?: string;
  size?: number;
  cur?: string;
}> = ({ parts, center, sub, size = 150, cur = 'INR' }) => {
  const tot = parts.reduce((s, p) => s + Math.max(0, p.v), 0) || 1;
  const r = size / 2 - 14;
  const C = 2 * Math.PI * r;
  let off = 0;

  return (
    <svg className="donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--t-line)" strokeWidth="18" />
      {parts
        .filter((p) => p.v > 0)
        .map((p, idx) => {
          const L = (C * p.v) / tot;
          const dashOffset = -off;
          off += L;
          return (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.c}
              strokeWidth="18"
              strokeDasharray={`${Math.max(0, L - 1.5)} ${C}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${p.l}: ${fmt(p.v, 0, cur)}`}</title>
            </circle>
          );
        })}
      <text x="50%" y="47%" textAnchor="middle" fontSize="17" fontWeight="800" fill="var(--t-tx)">
        {center}
      </text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="10.5" fill="var(--t-tx3)">
        {sub || ''}
      </text>
    </svg>
  );
};

export const ChartLegend: React.FC<{
  parts: DonutPart[];
  showVal?: boolean;
  cur?: string;
}> = ({ parts, showVal = true, cur = 'INR' }) => (
  <div className="legend">
    {parts.map((p, idx) => (
      <div key={idx}>
        <i style={{ background: p.c }} />
        <span>{p.l}</span>
        {showVal ? <b>{p.t ?? shortK(p.v, cur)}</b> : null}
      </div>
    ))}
  </div>
);

export interface HBarRow {
  l: string;
  v: number;
  hi?: boolean;
  mut?: boolean;
  badge?: string;
  t?: string;
  c?: string;
}

export const HorizontalBars: React.FC<{
  rows: HBarRow[];
  empty?: string;
  cur?: string;
}> = ({ rows, empty = 'No data yet', cur = 'INR' }) => {
  if (!rows.length) return <div className="ch-empty">{empty}</div>;
  const mx = Math.max(...rows.map((r) => Math.abs(r.v) || 0)) || 1;
  return (
    <div className="hbars">
      {rows.map((r, idx) => (
        <div key={idx} className={`hb ${r.hi ? 'hi' : ''} ${r.mut ? 'mut' : ''}`}>
          <div className="hb-l" title={r.l}>
            {r.badge ? <span className="hb-b">{r.badge}</span> : null}
            {r.l}
          </div>
          <div className="hb-t">
            <div
              className="hb-f"
              style={{
                width: `${Math.max(2, (Math.abs(r.v) / mx) * 100)}%`,
                ...(r.c ? { background: r.c } : {}),
              }}
            />
          </div>
          <div className="hb-v">{r.t ?? shortK(r.v, cur)}</div>
        </div>
      ))}
    </div>
  );
};

export const DivergingBars: React.FC<{
  rows: { l: string; v: number; p: number | null }[];
  cur?: string;
}> = ({ rows, cur = 'INR' }) => {
  if (!rows.length) return <div className="ch-empty">No item has an LPP to compare yet</div>;
  const mx = Math.max(...rows.map((r) => Math.abs(r.v))) || 1;
  return (
    <div className="dbars">
      {rows.map((r, idx) => {
        const w = (Math.abs(r.v) / mx) * 50;
        return (
          <div key={idx} className="db">
            <div className="db-l" title={r.l}>
              {r.l}
            </div>
            <div className="db-t">
              <div className="db-mid" />
              <div
                className={`db-f ${r.v > 0 ? 'up' : 'dn'}`}
                style={{
                  ...(r.v > 0 ? { left: '50%' } : { right: '50%' }),
                  width: `${Math.max(1, w)}%`,
                }}
              />
            </div>
            <div className={`db-v ${r.v > 0 ? 'lpp-up' : 'lpp-dn'}`}>
              {r.v > 0 ? '▲ +' : '▼ '}
              {shortK(Math.abs(r.v), cur)}
              <small>
                {r.p != null ? ` · ${r.p > 0 ? '+' : ''}${(r.p * 100).toFixed(1)}%` : ''}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const VendorComparisonChart: React.FC<{ c: CalcResult }> = ({ c }) => {
  const rows = c.vs
    .map((x, j) => ({ l: x.name || `V${j + 1}`, v: x.l, complete: x.complete, rank: x.rank }))
    .filter((r) => r.l && r.v > 0)
    .sort((a, b) => a.v - b.v);
  const best = Math.min(...rows.filter((r) => r.complete).map((r) => r.v), Infinity);
  return (
    <HorizontalBars
      cur={c.base}
      empty="Enter negotiated prices to compare vendors"
      rows={rows.map((r) => ({
        l: r.l,
        v: r.v,
        hi: r.rank === 1,
        badge: r.rank ? `L${r.rank}` : 'part',
        mut: !r.complete,
        t:
          shortK(r.v, c.base) +
          (r.complete && r.v > best && Number.isFinite(best)
            ? ` · +${((r.v / best - 1) * 100).toFixed(1)}%`
            : ''),
      }))}
    />
  );
};

export const SplitDonutChart: React.FC<{ c: CalcResult }> = ({ c }) => {
  const parts = c.split
    .filter((s) => s.val > 0)
    .map((s, i) => ({ v: s.val, l: s.name, c: CH_PAL[i % CH_PAL.length] }));
  if (!parts.length) return <div className="ch-empty">No award yet</div>;
  return (
    <div className="donut-wrap">
      <DonutChart parts={parts} center={shortK(c.total, c.base)} sub="award value" cur={c.base} />
      <ChartLegend parts={parts} cur={c.base} />
    </div>
  );
};

export const LppImpactChart: React.FC<{ c: CalcResult }> = ({ c }) => {
  const rows = c.aw
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a.lppImpact != null)
    .map((x) => ({
      l: c.rows[x.i].it.code || `Item ${x.i + 1}`,
      v: x.a.lppImpact as number,
      p: x.a.lppPct,
    }));
  return <DivergingBars rows={rows} cur={c.base} />;
};

export const ApprovalTimeline: React.FC<{ ver: NfaVersion; c: CalcResult }> = ({ ver, c }) => {
  const cur = ver.approvals.find((a) => a.action === 'Pending');
  const steps = [
    {
      lv: 'L0',
      role: 'Buyer – prepared',
      name: ver.data.header.buyer || '',
      action: ver.submittedOn ? 'Submitted' : '',
      date: ver.submittedOn || '',
    },
    ...(ver.approvals.length ? ver.approvals : route(c).map((x) => ({ ...x, action: '' }))),
  ];

  return (
    <div className="tl">
      {steps.map((s, i) => {
        const st =
          s.action === 'Approve' || s.action === 'Submitted'
            ? 'done'
            : s.action === 'Return for Revision' || s.action === 'Reject'
            ? 'bad'
            : ver.status === 'Pending' && cur === s
            ? 'cur'
            : 'todo';
        return (
          <React.Fragment key={`${s.lv}-${i}`}>
            {i > 0 ? <div className="tl-c" /> : null}
            <div className={`tl-s ${st}`}>
              <div className="tl-n">
                {st === 'done' ? (
                  <Check size={15} />
                ) : st === 'bad' ? (
                  '✕'
                ) : st === 'cur' ? (
                  <Clock size={15} />
                ) : (
                  s.lv
                )}
              </div>
              <div className="tl-b">
                <b>
                  {s.lv} · {s.role}
                </b>
                <small>
                  {s.action && s.action !== 'Pending'
                    ? `${s.action}${s.name ? ` — ${s.name}` : ''}`
                    : st === 'cur'
                    ? 'Awaiting decision'
                    : 'Not yet reached'}
                </small>
                {s.date ? <small>{fmtD(s.date)}</small> : null}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const SavingSummaryText = (c: CalcResult) =>
  `${fmt(c.sav, 0, c.base)} · ${pct(c.savPct)}`;

interface VarianceChartDatum {
  label: string;
  desc: string;
  l1v: number | null;
  l1Vendor: string;
  [key: string]: string | number | null | undefined;
}

export const LandedVarianceBarChart: React.FC<{
  c: CalcResult;
  vendors: Vendor[];
}> = ({ c, vendors }) => {
  const [metric, setMetric] = useState<'variance' | 'landed'>('variance');
  const [threshold, setThreshold] = useState<number>(15);

  const { activeVendors, chartData, outliers } = useMemo(() => {
    const activeV = vendors
      .map((v, j) => ({
        j,
        name: v.name || `V${j + 1}`,
        color: RECHARTS_PAL[j % RECHARTS_PAL.length],
        hasAny: c.rows.some((r) => r.landed[j] != null),
      }))
      .filter((x) => x.hasAny);

    const detectedOutliers: {
      item: string;
      vendor: string;
      pct: number;
      diff: number;
    }[] = [];

    const data: VarianceChartDatum[] = c.rows.map((r, i) => {
      const itemLabel = r.it.code || `Item ${i + 1}`;
      const row: VarianceChartDatum = {
        label: itemLabel,
        desc: r.it.desc || '',
        l1v: r.l1v,
        l1Vendor: r.l1j != null ? vendors[r.l1j]?.name || `V${r.l1j + 1}` : '—',
      };

      activeV.forEach((av) => {
        const landedVal = r.landed[av.j];
        if (landedVal != null && r.l1v != null && r.l1v > 0) {
          const varPct = Number((((landedVal - r.l1v) / r.l1v) * 100).toFixed(2));
          const diff = landedVal - r.l1v;
          row[`v_${av.j}`] = varPct;
          row[`abs_${av.j}`] = Math.round(landedVal);
          row[`diff_${av.j}`] = diff;
          if (varPct >= threshold) {
            detectedOutliers.push({
              item: itemLabel,
              vendor: av.name,
              pct: varPct,
              diff,
            });
          }
        } else {
          row[`v_${av.j}`] = null;
          row[`abs_${av.j}`] = null;
          row[`diff_${av.j}`] = null;
        }
      });

      return row;
    });

    detectedOutliers.sort((a, b) => b.pct - a.pct);

    return { activeVendors: activeV, chartData: data, outliers: detectedOutliers };
  }, [c.rows, threshold, vendors]);

  if (!activeVendors.length || !chartData.length) {
    return (
      <div className="ch-empty">
        Enter negotiated prices for accepted vendors to visualize item-wise landed cost variance.
      </div>
    );
  }

  return (
    <div>
      {/* Controls & Outlier Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-[var(--t-line)] bg-[#F3F4F6]">
          <button
            type="button"
            onClick={() => setMetric('variance')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer border-0 ${
              metric === 'variance'
                ? 'bg-white text-[var(--t-tx)] shadow-sm'
                : 'bg-transparent text-[var(--t-tx2)] hover:text-[var(--t-tx)]'
            }`}
          >
            % Variance vs L1
          </button>
          <button
            type="button"
            onClick={() => setMetric('landed')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer border-0 ${
              metric === 'landed'
                ? 'bg-white text-[var(--t-tx)] shadow-sm'
                : 'bg-transparent text-[var(--t-tx2)] hover:text-[var(--t-tx)]'
            }`}
          >
            Landed Value ({c.base})
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--t-tx2)] font-semibold">
          <span className="whitespace-nowrap">Outlier threshold</span>
          <select
            aria-label="Outlier threshold percentage"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
          >
            <option value={5}>+5% above L1</option>
            <option value={10}>+10% above L1</option>
            <option value={15}>+15% above L1</option>
            <option value={25}>+25% above L1</option>
            <option value={50}>+50% above L1</option>
          </select>
        </label>
      </div>

      {/* Recharts Grouped BarChart */}
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 14, right: 20, left: 6, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11.5, fill: '#374151', fontWeight: 600 }}
              axisLine={{ stroke: '#D1D5DB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#4B5563' }}
              axisLine={false}
              tickLine={false}
              width={72}
              tickFormatter={(val: number) =>
                metric === 'variance' ? `+${Number(val).toFixed(0)}%` : shortK(Number(val), c.base)
              }
            />
            {metric === 'variance' ? (
              <ReferenceLine
                y={threshold}
                stroke="#B42318"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `+${threshold}% outlier threshold`,
                  position: 'insideTopRight',
                  fill: '#B42318',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            ) : null}
            <Tooltip
              cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const datum = payload[0]?.payload as VarianceChartDatum | undefined;
                return (
                  <div className="rounded-lg border border-[var(--t-line2)] bg-white px-3.5 py-2.5 shadow-lg text-xs max-w-xs">
                    <div className="font-bold text-[var(--t-tx)]">{label}</div>
                    {datum?.desc ? (
                      <div className="text-[11px] text-[var(--t-tx3)] mb-1.5 line-clamp-2">
                        {datum.desc}
                      </div>
                    ) : null}
                    {datum?.l1v != null ? (
                      <div className="text-[11px] text-[var(--t-tx2)] pb-1.5 mb-1.5 border-b border-[var(--t-line)] tabular-nums">
                        L1 Baseline: <b>{datum.l1Vendor}</b> ({c.base} {fmt(datum.l1v, 0, c.base)})
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      {activeVendors.map((av) => {
                        const varPct = datum?.[`v_${av.j}`] as number | null | undefined;
                        const absVal = datum?.[`abs_${av.j}`] as number | null | undefined;
                        const diffVal = datum?.[`diff_${av.j}`] as number | null | undefined;
                        if (absVal == null || varPct == null) return null;
                        const isOutlier = varPct >= threshold;
                        const isL1 = Math.abs(varPct) < 0.01;
                        return (
                          <div
                            key={av.j}
                            className="flex items-center justify-between gap-4 tabular-nums"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ background: av.color }}
                              />
                              <span className="truncate font-medium text-[var(--t-tx)]">
                                {av.name}
                              </span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                              <b>
                                {c.base} {fmt(absVal, 0, c.base)}
                              </b>{' '}
                              <span
                                className={
                                  isL1
                                    ? 'ok'
                                    : isOutlier
                                    ? 'bad'
                                    : 'text-[var(--t-tx3)]'
                                }
                              >
                                {isL1
                                  ? '(L1)'
                                  : `(+${varPct.toFixed(1)}% · +${shortK(diffVal || 0, c.base)})${
                                      isOutlier ? ' · Outlier' : ''
                                    }`}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
            {activeVendors.map((av) => {
              const key = metric === 'variance' ? `v_${av.j}` : `abs_${av.j}`;
              return (
                <Bar
                  key={av.j}
                  dataKey={key}
                  name={av.name}
                  fill={av.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                >
                  {chartData.map((entry, idx) => {
                    const pctVal = entry[`v_${av.j}`];
                    const isOutlier = typeof pctVal === 'number' && pctVal >= threshold;
                    return (
                      <Cell
                        key={`cell-${av.j}-${idx}`}
                        fill={av.color}
                        stroke={isOutlier ? '#B42318' : 'none'}
                        strokeWidth={isOutlier ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Outlier Callout Footer */}
      <div className="mt-2.5 pt-2.5 border-t border-[var(--t-line)] text-xs flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--t-tx2)]">
        {outliers.length > 0 ? (
          <>
            <span className="bad inline-flex items-center gap-1">
              <AlertTriangle size={13} /> Outliers detected (≥ +{threshold}% above L1):
            </span>
            {outliers.slice(0, 6).map((o, idx) => (
              <React.Fragment key={`${o.item}-${o.vendor}-${idx}`}>
                {idx > 0 ? <span aria-hidden="true">·</span> : null}
                <span className="tabular-nums">
                  <b>{o.item}</b> / {o.vendor} (+{o.pct.toFixed(1)}%, +{shortK(o.diff, c.base)})
                </span>
              </React.Fragment>
            ))}
            {outliers.length > 6 ? <span>· +{outliers.length - 6} more</span> : null}
          </>
        ) : (
          <span className="ok">
            All quoted vendor landed costs are within +{threshold}% of the L1 baseline across every
            item.
          </span>
        )}
      </div>
    </div>
  );
};
