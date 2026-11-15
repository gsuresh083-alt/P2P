import React, { useEffect, useMemo, useState } from 'react';
import { Percent, X } from 'lucide-react';
import type { NfaData } from '../../types/enfa.ts';
import { fmt, isOkForLine, num } from '../../utils/enfaEngine.ts';

export type DiscountBase = 'quoted' | 'current';
export type DiscountScope = 'all' | 'pending' | 'selected';

export interface DiscountApplyPayload {
  vendorIdx: number;
  percent: number;
  basis: DiscountBase;
  itemIndices: number[];
}

interface DiscountOptionModalProps {
  open: boolean;
  data: NfaData;
  vendorIdx: number;
  initialPercent: number;
  initialItemIdx?: number | null;
  onApply: (payload: DiscountApplyPayload) => void;
  onClose: () => void;
}

export const DiscountOptionModal: React.FC<DiscountOptionModalProps> = ({
  open,
  data,
  vendorIdx,
  initialPercent,
  initialItemIdx = null,
  onApply,
  onClose,
}) => {
  const v = data.vendors[vendorIdx];
  const cur = v?.terms?.cur || data.header.cur || 'INR';

  const eligibleItems = useMemo(() => {
    if (!v) return [];
    return data.items
      .map((it, i) => ({
        i,
        it,
        q: num(it.r?.[vendorIdx]?.q),
        n: num(it.r?.[vendorIdx]?.n),
      }))
      .filter(
        (x) =>
          !data.items[x.i]?.r?.[vendorIdx]?.regret &&
          x.q != null &&
          x.q > 0 &&
          isOkForLine(data, v, x.i)
      );
  }, [data, v, vendorIdx]);

  const [pctInput, setPctInput] = useState<string>(
    initialPercent > 0 ? String(initialPercent) : ''
  );
  const [basis, setBasis] = useState<DiscountBase>('quoted');
  const [scope, setScope] = useState<DiscountScope>(initialItemIdx != null ? 'selected' : 'all');
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open) return;
    setPctInput(initialPercent > 0 ? String(initialPercent) : '');
    setBasis('quoted');
    if (initialItemIdx != null) {
      setScope('selected');
      setPicked({ [initialItemIdx]: true });
    } else {
      const hasPending = eligibleItems.some((x) => x.n == null);
      setScope(hasPending ? 'all' : 'all');
      const initMap: Record<number, boolean> = {};
      eligibleItems.forEach((x) => {
        initMap[x.i] = true;
      });
      setPicked(initMap);
    }
  }, [open, initialPercent, initialItemIdx, eligibleItems]);

  const pctNum = Number(pctInput);
  const validPct = Number.isFinite(pctNum) && pctNum >= 0 && pctNum <= 99.99;

  const targetIndices = useMemo(() => {
    if (scope === 'all') return eligibleItems.map((x) => x.i);
    if (scope === 'pending') return eligibleItems.filter((x) => x.n == null).map((x) => x.i);
    return eligibleItems.filter((x) => picked[x.i]).map((x) => x.i);
  }, [eligibleItems, picked, scope]);

  if (!open || !v) return null;

  const computeNewRate = (q: number, n: number | null) => {
    if (!validPct) return null;
    const baseRate = basis === 'current' && n != null ? n : q;
    return Math.max(0.01, Math.round(baseRate * (1 - pctNum / 100) * 100) / 100);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Apply Discount Percentage Options"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-[var(--t-line)] bg-[var(--t-surf)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--t-line)] px-5 py-3.5 bg-[var(--t-th)]">
          <div className="flex items-center gap-2">
            <Percent size={16} className="text-[var(--t-acc)]" />
            <div>
              <h3 style={{ margin: 0, textTransform: 'none', letterSpacing: 0, fontSize: 15 }}>
                Apply Discount % — {v.name || `Vendor ${vendorIdx + 1}`}
              </h3>
              <div className="text-xs text-[var(--t-tx3)]">
                Choose how the discount percentage should be calculated and which items it applies
                to.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn w whitespace-nowrap shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} /> Close
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Discount % input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[var(--t-tx2)] mb-1">
                Discount Percentage (%)
              </label>
              <input
                type="number"
                step="any"
                min={0}
                max={99.99}
                value={pctInput}
                onChange={(e) => setPctInput(e.target.value)}
                placeholder="e.g. 5 or 7.5"
                autoFocus
              />
              {!validPct && pctInput !== '' ? (
                <div className="bad mt-1">Enter a percentage between 0 and 99.99.</div>
              ) : null}
            </div>

            <div>
              <label className="block font-bold text-[var(--t-tx2)] mb-1">
                1. Calculate Discount Off
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer text-[var(--t-tx)]">
                  <input
                    type="radio"
                    name="disc-basis"
                    checked={basis === 'quoted'}
                    onChange={() => setBasis('quoted')}
                  />
                  <span>
                    <b>Initial Quoted Rate</b> (Quoted × (1 − %))
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[var(--t-tx)]">
                  <input
                    type="radio"
                    name="disc-basis"
                    checked={basis === 'current'}
                    onChange={() => setBasis('current')}
                  />
                  <span>
                    <b>Current Negotiated Rate</b> (compounded round-2 discount)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Scope choice */}
          <div className="rounded-lg border border-[var(--t-line)] bg-[#F9FAFB] p-3">
            <div className="font-bold text-[var(--t-tx2)] mb-2">
              2. Apply Discount To Which Item(s)?
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-[var(--t-tx)]">
                <input
                  type="radio"
                  name="disc-scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                />
                <span>
                  <b>All accepted items</b> ({eligibleItems.length})
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[var(--t-tx)]">
                <input
                  type="radio"
                  name="disc-scope"
                  checked={scope === 'pending'}
                  onChange={() => setScope('pending')}
                />
                <span>
                  <b>Pending items only</b> ({eligibleItems.filter((x) => x.n == null).length})
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[var(--t-tx)]">
                <input
                  type="radio"
                  name="disc-scope"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                />
                <span>
                  <b>Select specific item(s)</b>
                </span>
              </label>
            </div>
          </div>

          {/* Live preview & per-item selector */}
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  {scope === 'selected' ? <th style={{ width: 34 }} /> : null}
                  <th>Item</th>
                  <th className="r">Initial Quoted ({cur})</th>
                  <th className="r">Current Neg ({cur})</th>
                  <th className="r">New Rate ({cur})</th>
                </tr>
              </thead>
              <tbody>
                {eligibleItems.map(({ i, it, q, n }) => {
                  const isIncluded = targetIndices.includes(i);
                  const newRate = q != null ? computeNewRate(q, n) : null;
                  return (
                    <tr key={i} className={isIncluded ? '' : 'opacity-55'}>
                      {scope === 'selected' ? (
                        <td>
                          <input
                            type="checkbox"
                            checked={Boolean(picked[i])}
                            onChange={(e) =>
                              setPicked((prev) => ({ ...prev, [i]: e.target.checked }))
                            }
                          />
                        </td>
                      ) : null}
                      <td>
                        <b>{it.code || `Item ${i + 1}`}</b>
                        <div className="text-[11px] text-[var(--t-tx3)] truncate max-w-[210px]">
                          {it.desc}
                        </div>
                      </td>
                      <td className="n">{fmt(q, 2, cur)}</td>
                      <td className="n">{n != null ? fmt(n, 2, cur) : 'Pending'}</td>
                      <td className="n">
                        {isIncluded && newRate != null ? (
                          <b className="ok">{fmt(newRate, 2, cur)}</b>
                        ) : (
                          <span className="note">{isIncluded ? '—' : 'Unchanged'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!eligibleItems.length ? (
                  <tr>
                    <td colSpan={scope === 'selected' ? 5 : 4} className="text-center py-4 note">
                      No technically accepted quoted items available for discount.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--t-line)] px-5 py-3 bg-[#F9FAFB]">
          <span className="text-xs text-[var(--t-tx3)]">
            {targetIndices.length} item(s) will be updated
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn w" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn g"
              disabled={!validPct || pctInput === '' || targetIndices.length === 0}
              onClick={() => {
                onApply({
                  vendorIdx,
                  percent: pctNum,
                  basis,
                  itemIndices: targetIndices,
                });
                onClose();
              }}
            >
              Apply {validPct && pctInput !== '' ? `${pctNum}%` : ''} Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
