import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import type { NfaVersion, PrLine, RoleName, StageId } from '../../types/enfa.ts';
import { PR_COLS, PR_STATUS } from '../../utils/enfaConstants.ts';
import { fmt, fmtD, prLineIssues, prLineKey } from '../../utils/enfaEngine.ts';
import { LockBanner, StageSubmitBar } from './FieldControl.tsx';

export const PrDetailsView: React.FC<{
  ver: NfaVersion;
  role: RoleName;
  onAddManualPR: (copyFrom: boolean) => void;
  onSetPRField: (id: string, key: string, val: string) => void;
  onDeletePRLine: (id: string) => void;
  onSelectPRLine: (id: string, checked: boolean) => void;
  onSelectAllValidPR: (on: boolean) => void;
  onSetPRSelectedQty: (id: string, val: string) => void;
  onApplySelectedPRs: () => void;
  onDownloadPRTemplate: (withSample: boolean) => void;
  onExportPRLines: () => void;
  onLoadDemoPRs: () => void;
  onImportCSV: (text: string, fileName: string) => void;
  onUpdateFilters: (filters: { prNumber: string; itemCode: string; plantCode: string }) => void;
  onSubmitStage: (stage: StageId) => void;
}> = ({
  ver,
  role,
  onAddManualPR,
  onSetPRField,
  onDeletePRLine,
  onSelectPRLine,
  onSelectAllValidPR,
  onSetPRSelectedQty,
  onApplySelectedPRs,
  onDownloadPRTemplate,
  onExportPRLines,
  onLoadDemoPRs,
  onImportCSV,
  onUpdateFilters,
  onSubmitStage,
}) => {
  const d = ver.data;
  const er = d.erp;
  const lines = er.prLines || [];
  const sel = er.selected || {};
  const e = ver.status === 'Draft' && role === 'Buyer';
  const f = er.filters || {};
  const fileRef = useRef<HTMLInputElement>(null);

  const [fPr, setFPr] = useState(f.prNumber || '');
  const [fItem, setFItem] = useState(f.itemCode || '');
  const [fPlant, setFPlant] = useState(f.plantCode || '');

  const filtered = lines.filter(
    (l) =>
      (!f.prNumber ||
        String(l.prNumber || '')
          .toLowerCase()
          .includes(f.prNumber.toLowerCase())) &&
      (!f.itemCode ||
        `${l.itemCode || ''} ${l.itemDescription || ''}`
          .toLowerCase()
          .includes(f.itemCode.toLowerCase())) &&
      (!f.plantCode ||
        String(l.plantCode || l.plantName || '')
          .toLowerCase()
          .includes(f.plantCode.toLowerCase()))
  );

  const picked = lines.filter((l) => sel[prLineKey(l)]?.selected);
  const bad = lines.filter((l) => prLineIssues(l, lines).length > 0);
  const log = er.importLog;

  const renderInput = (
    l: PrLine,
    k: string,
    ph: string,
    width?: string,
    type = 'text'
  ) => {
    const raw = String(l[k] ?? '');
    const inv = raw.startsWith('INVALID:');
    const val = inv ? raw.slice(8) : raw;
    const isReqMiss = e && raw.trim() === '' && Boolean(PR_COLS.find((c) => c[0] === k)?.[2]);
    if (!e) return <span>{val || '—'}</span>;
    return (
      <input
        className={`pri ${inv || isReqMiss ? 'lpp-err' : ''}`}
        type={type}
        value={val}
        placeholder={ph}
        style={width ? { width } : undefined}
        onChange={(ev) => onSetPRField(prLineKey(l), k, ev.target.value)}
      />
    );
  };

  return (
    <>
      <LockBanner ver={ver} />
      <h2>0A. PR Details — manual entry or CSV upload</h2>
      <p className="note">
        Enter the approved Purchase Requisition lines to be sourced, either line by line or by
        uploading a CSV prepared from the PR. ERP connection is not required. Each line keeps its PR
        number, line, plant and quantity, and stays linked to the RFQ, CS and NFA. * = mandatory.
      </p>

      <div className="pr-actions">
        <div>
          <b>1 · Enter manually</b>
          <br />
          <button
            type="button"
            className="btn mr-1.5"
            disabled={!e}
            onClick={() => onAddManualPR(false)}
          >
            <Plus size={14} /> New PR line
          </button>
          <button
            type="button"
            className="btn w"
            disabled={!e || !lines.length}
            onClick={() => onAddManualPR(true)}
          >
            ＋ Next line of same PR
          </button>
        </div>
        <div>
          <b>2 · Or upload a CSV</b>
          <br />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onImportCSV(String(reader.result || ''), file.name);
              reader.readAsText(file);
              ev.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn mr-1.5"
            disabled={!e}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} /> Upload PR CSV
          </button>
          <button
            type="button"
            className="btn w mr-1.5"
            onClick={() => onDownloadPRTemplate(false)}
          >
            <Download size={14} /> Blank template
          </button>
          <button type="button" className="btn w" onClick={() => onDownloadPRTemplate(true)}>
            <FileSpreadsheet size={14} /> Template with example
          </button>
        </div>
        <div>
          <b>Tools</b>
          <br />
          <button
            type="button"
            className="btn w mr-1.5"
            disabled={!lines.length}
            onClick={onExportPRLines}
          >
            <Download size={14} /> Export lines to CSV
          </button>
          <button type="button" className="btn w" disabled={!e} onClick={onLoadDemoPRs}>
            Load sample PRs
          </button>
        </div>
      </div>

      {log ? (
        <div className={`lpp-val ${log.ok ? 'ok' : 'bad'}`}>
          <b>{log.ok ? '✓ CSV imported' : '✕ CSV rejected – nothing imported'}:</b> {log.file || ''}{' '}
          · {log.rows} row(s) · {fmtD(log.at)}
          {log.errors?.length ? (
            <ul>
              {log.errors.slice(0, 25).map((x, idx) => (
                <li key={idx}>{x}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lines.length > 4 ? (
        <div className="pr-filter">
          <input
            value={fPr}
            placeholder="Filter PR number"
            onChange={(ev) => setFPr(ev.target.value)}
          />
          <input
            value={fItem}
            placeholder="Filter item code / description"
            onChange={(ev) => setFItem(ev.target.value)}
          />
          <input
            value={fPlant}
            placeholder="Filter plant"
            onChange={(ev) => setFPlant(ev.target.value)}
          />
          <button
            type="button"
            className="btn w"
            onClick={() =>
              onUpdateFilters({ prNumber: fPr.trim(), itemCode: fItem.trim(), plantCode: fPlant.trim() })
            }
          >
            Filter
          </button>
        </div>
      ) : null}

      <div className="lpp-wrap">
        <table className="pr-man">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                Use
                {e && lines.length ? (
                  <div>
                    <button
                      type="button"
                      className="text-[var(--t-acc2)] underline bg-transparent border-0 p-0 cursor-pointer font-semibold text-[11px]"
                      onClick={() =>
                        onSelectAllValidPR(
                          !(picked.length === lines.length - bad.length && picked.length > 0)
                        )
                      }
                    >
                      all
                    </button>
                  </div>
                ) : null}
              </th>
              <th>PR no.* · line* · date</th>
              <th>Approval* · plant · dept · requester</th>
              <th style={{ width: '26%' }}>Item code* · description* · specification</th>
              <th>UOM* · category</th>
              <th className="r">
                PR qty* · sourced · <b>open</b>
              </th>
              <th className="r">Qty for RFQ</th>
              <th>Need-by · budget · spec doc</th>
              <th style={{ width: 34 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((l) => {
                const id = prLineKey(l);
                const st = sel[id] || { selected: false, selectedQty: l.openQty };
                const iss = prLineIssues(l, lines);
                const ok = !iss.length;
                return (
                  <React.Fragment key={id}>
                    <tr className={ok ? '' : 'e'}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          style={{ width: 'auto' }}
                          checked={!!st.selected}
                          disabled={!(e && ok)}
                          title={ok ? 'Include in RFQ' : 'Correct the line first'}
                          onChange={(ev) => onSelectPRLine(id, ev.target.checked)}
                        />
                      </td>
                      <td>
                        {renderInput(l, 'prNumber', 'PR number')}
                        <div className="pr2">
                          {renderInput(l, 'prLineNumber', 'Line')}
                          {renderInput(l, 'prDate', 'PR date YYYY-MM-DD', undefined, e ? 'date' : 'text')}
                        </div>
                      </td>
                      <td>
                        {e ? (
                          <select
                            className="pri"
                            value={l.approvalStatus}
                            onChange={(ev) => onSetPRField(id, 'approvalStatus', ev.target.value)}
                          >
                            {PR_STATUS.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                        ) : (
                          l.approvalStatus
                        )}
                        <div className="pr2">
                          {renderInput(l, 'plantName', 'Plant')}
                          {renderInput(l, 'departmentName', 'Department')}
                        </div>
                        {renderInput(l, 'requesterName', 'Requester')}
                      </td>
                      <td>
                        {renderInput(l, 'itemCode', 'Item code')}
                        {renderInput(l, 'itemDescription', 'Item description')}
                        {e ? (
                          <textarea
                            className="pri"
                            rows={1}
                            value={l.itemLongDescription || ''}
                            placeholder="Specification / long text"
                            onChange={(ev) =>
                              onSetPRField(id, 'itemLongDescription', ev.target.value)
                            }
                          />
                        ) : (
                          <small>{l.itemLongDescription || ''}</small>
                        )}
                      </td>
                      <td>
                        {renderInput(l, 'uomCode', 'UOM', '70px')}
                        {renderInput(l, 'category', 'Category')}
                      </td>
                      <td className="r">
                        <div className="pr2">
                          {renderInput(l, 'requestedQty', 'PR qty')}
                          {renderInput(l, 'previouslySourcedQty', 'Sourced')}
                        </div>
                        <div className="pr-open">
                          Open: <b>{fmt(l.openQty, Number(l.openQty) % 1 ? 3 : 0)}</b> {l.uomCode || ''}
                        </div>
                      </td>
                      <td className="r" style={{ width: 96 }}>
                        {st.selected ? (
                          <input
                            className="pri"
                            type="number"
                            step="any"
                            min={0}
                            max={Number(l.openQty) || 0}
                            disabled={!e}
                            value={st.selectedQty ?? l.openQty ?? ''}
                            onChange={(ev) => onSetPRSelectedQty(id, ev.target.value)}
                          />
                        ) : (
                          <span className="lpp-na">—</span>
                        )}
                      </td>
                      <td>
                        {renderInput(l, 'needByDate', 'Need-by', undefined, e ? 'date' : 'text')}
                        {renderInput(l, 'budgetCode', 'Budget code')}
                        {renderInput(l, 'specDocRef', 'Spec doc ref.')}
                      </td>
                      <td className="text-center">
                        {ok ? (
                          <span className="ok" title="Valid">
                            ✓
                          </span>
                        ) : (
                          <span className="bad" title={iss.join('\n')}>
                            ✕
                          </span>
                        )}
                        {e ? (
                          <div className="mt-1">
                            <button
                              type="button"
                              className="x"
                              title="Delete line"
                              onClick={() => onDeletePRLine(id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {!ok && e ? (
                      <tr className="e">
                        <td />
                        <td colSpan={8} className="pr-err">
                          ✕ {iss.join(' · ')}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="note text-center py-5">
                  No PR lines yet — click <b>＋ New PR line</b> or <b>⤒ Upload PR CSV</b>, or{' '}
                  <b>Load sample PRs</b>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rec flex items-center gap-3 flex-wrap">
        <span>
          <b>Selection:</b> {picked.length} of {lines.length} line(s) ticked
          {bad.length ? (
            <>
              {' '}
              · <span className="bad">{bad.length} line(s) need correction</span>
            </>
          ) : null}
          . Quantity for RFQ can be partial (≤ open qty); different UOMs are never aggregated.
        </span>
        <button type="button" className="btn g" disabled={!e} onClick={onApplySelectedPRs}>
          Apply Selected PR Lines to RFQ →
        </button>
        {er.selectionApplied ? (
          <span className="ok">✓ {d.items.length} RFQ line(s) populated</span>
        ) : null}
      </div>

      {er.selectionApplied ? (
        <>
          <h3>Applied PR allocation</h3>
          <table>
            <thead>
              <tr>
                <th>RFQ item</th>
                <th>PR / line</th>
                <th>Plant</th>
                <th className="r">Qty for RFQ</th>
                <th>Spec / document ref.</th>
              </tr>
            </thead>
            <tbody>
              {d.items
                .filter((it) => it.erpSource)
                .map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.code}</td>
                    <td>
                      {it.erpSource!.prNumber} / {it.erpSource!.prLineNumber}
                    </td>
                    <td>{it.erpSource!.plantName || it.erpSource!.plantCode || ''}</td>
                    <td className="n">
                      {fmt(it.qty, 3)} {it.uom}
                    </td>
                    <td>
                      {(it.erpSource!.documents || []).map((x) => x.documentName).join('; ') || '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      ) : null}

      <StageSubmitBar
        stage="pr"
        label="PR Details"
        ownerRole="Buyer"
        ver={ver}
        currentRole={role}
        onSubmit={onSubmitStage}
      />
    </>
  );
};
