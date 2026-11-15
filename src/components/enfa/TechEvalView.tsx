import React from 'react';
import type { NfaVersion, RoleName } from '../../types/enfa.ts';
import { TECH_CRITERIA } from '../../utils/enfaConstants.ts';
import { lineTechComplete, num, te, techComplete } from '../../utils/enfaEngine.ts';
import { FieldControl, LockBanner } from './FieldControl.tsx';

export const TechEvalView: React.FC<{
  ver: NfaVersion;
  role: RoleName;
  onChangeField: (path: string, val: string | number) => void;
  onSubmitTechEval: () => void;
}> = ({ ver, role, onChangeField, onSubmitTechEval }) => {
  const d = ver.data;
  const canTech = ver.status === 'Draft' && role === 'User HOD (Technical)';
  const quoted = d.vendors
    .map((v, j) => ({
      v,
      j,
      items: d.items
        .map((it, i) => ({ it, i }))
        .filter((x) => num(x.it.r?.[j]?.q) != null),
    }))
    .filter((x) => String(x.v.name || '').trim() && x.items.length > 0);

  const mode = d.techMode || '';
  const allComplete =
    quoted.length > 0 &&
    quoted.every(({ v, items }) =>
      mode === 'Line-wise'
        ? items.every(({ i }) => lineTechComplete(v.techEval?.lines?.[String(i)]))
        : mode === 'Vendor-wise'
        ? techComplete(v)
        : false
    );

  const renderCriteriaRows = (
    base: string,
    criteria: Record<string, { result?: string; note?: string }> | undefined
  ) =>
    TECH_CRITERIA.map(([k, label]) => {
      const res = criteria?.[k]?.result || '';
      return (
        <tr key={k}>
          <td>{label}</td>
          <td>
            <FieldControl
              path={`${base}.criteria.${k}.result`}
              value={res}
              type="s:criterion"
              ver={ver}
              role={role}
              onChange={onChangeField}
            />
          </td>
          <td>
            {res === 'Fail' ? (
              <FieldControl
                path={`${base}.criteria.${k}.note`}
                value={criteria?.[k]?.note || ''}
                type="a"
                placeholder="Explain the failure"
                ver={ver}
                role={role}
                onChange={onChangeField}
              />
            ) : (
              <span className="note">—</span>
            )}
          </td>
        </tr>
      );
    });

  return (
    <>
      <LockBanner ver={ver} />
      <h2>3. Technical Evaluation</h2>
      {!canTech && ver.status === 'Draft' ? (
        <div className="lock">
          Read-only. Select “User HOD (Technical)” in Acting as to configure and complete evaluations.
        </div>
      ) : null}

      <div className="rec">
        <b>Step 1 — Select evaluation method before starting</b>
        <p className="note">
          Vendor-wise applies one decision to all quoted items. Line-wise captures a separate
          technical decision for every vendor-item line, supporting partial acceptance. This
          selection is locked after submission.
        </p>
        <div style={{ maxWidth: 260 }}>
          <FieldControl
            path="techMode"
            value={mode}
            type="s:techMode"
            ver={ver}
            role={role}
            onChange={onChangeField}
          />
        </div>
      </div>

      {!mode ? (
        <p className="note">Select an evaluation method to begin.</p>
      ) : mode === 'Vendor-wise' ? (
        <>
          <p className="note">
            Complete all seven criteria for each quoted vendor. A vendor can be accepted only when
            all criteria are assessed, at least one is Pass and none is Fail.
          </p>
          {quoted.map(({ v, j }) => {
            const ev = te(v);
            const status = ev.status || 'Pending';
            const complete = techComplete(v);
            return (
              <section key={j} className="tech-card">
                <h3 style={{ margin: 0 }}>{v.name}</h3>
                <div className="tech-meta">
                  <div>
                    <label>Evaluator name / designation</label>
                    <FieldControl
                      path={`vendors.${j}.techEval.evaluator`}
                      value={ev.evaluator}
                      placeholder="Enter evaluator name"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </div>
                  <div>
                    <label>Evaluation date</label>
                    <FieldControl
                      path={`vendors.${j}.techEval.date`}
                      value={ev.date}
                      type="d"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </div>
                  <div>
                    <label>Overall decision</label>
                    <FieldControl
                      path={`vendors.${j}.techEval.status`}
                      value={status}
                      type="s:eval"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="tech-checks">
                    <thead>
                      <tr>
                        <th>Technical check</th>
                        <th>Result</th>
                        <th>Failure note</th>
                      </tr>
                    </thead>
                    <tbody>{renderCriteriaRows(`vendors.${j}.techEval`, ev.criteria)}</tbody>
                  </table>
                </div>
                {status === 'Rejected' ? (
                  <div className="mt-2">
                    <label className="block text-xs font-bold mb-1">Reason for rejection</label>
                    <FieldControl
                      path={`vendors.${j}.techEval.decisionNote`}
                      value={ev.decisionNote || ''}
                      type="a"
                      placeholder="Reason for rejecting this vendor"
                      ver={ver}
                      role={role}
                      onChange={onChangeField}
                    />
                  </div>
                ) : null}
                <div className={`tech-status ${complete ? 'ok' : 'bad'}`}>
                  {complete
                    ? status === 'Accepted'
                      ? 'Complete — vendor accepted'
                      : 'Complete — vendor rejected'
                    : 'Pending — complete all checks'}
                </div>
              </section>
            );
          })}
        </>
      ) : (
        <>
          <p className="note">
            Assess every quoted item separately for each vendor. Accepted lines alone unlock
            negotiated pricing and enter the Comparative Statement; rejected lines are excluded.
          </p>
          {quoted.map(({ v, j, items }) => (
            <section key={j} className="tech-card">
              <h3 style={{ margin: 0 }}>{v.name}</h3>
              {items.map(({ it, i }) => {
                const base = `vendors.${j}.techEval.lines.${i}`;
                const le = v.techEval?.lines?.[String(i)];
                const done = lineTechComplete(le);
                return (
                  <section key={i} className="tech-card">
                    <h3 style={{ margin: 0 }}>
                      Item {i + 1} · {it.code || ''} {it.desc || ''}
                    </h3>
                    <div className="tech-meta">
                      <div>
                        <label>Evaluator name / designation</label>
                        <FieldControl
                          path={`${base}.evaluator`}
                          value={le?.evaluator || ''}
                          placeholder="Enter evaluator name"
                          ver={ver}
                          role={role}
                          onChange={onChangeField}
                        />
                      </div>
                      <div>
                        <label>Evaluation date</label>
                        <FieldControl
                          path={`${base}.date`}
                          value={le?.date || ''}
                          type="d"
                          ver={ver}
                          role={role}
                          onChange={onChangeField}
                        />
                      </div>
                      <div>
                        <label>Decision</label>
                        <FieldControl
                          path={`${base}.status`}
                          value={le?.status || ''}
                          type="s:eval"
                          ver={ver}
                          role={role}
                          onChange={onChangeField}
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="tech-checks">
                        <thead>
                          <tr>
                            <th>Technical check</th>
                            <th>Result</th>
                            <th>Failure note</th>
                          </tr>
                        </thead>
                        <tbody>{renderCriteriaRows(base, le?.criteria)}</tbody>
                      </table>
                    </div>
                    {le?.status === 'Rejected' ? (
                      <div className="mt-2">
                        <label className="block text-xs font-bold mb-1">Reason for rejection</label>
                        <FieldControl
                          path={`${base}.decisionNote`}
                          value={le?.decisionNote || ''}
                          type="a"
                          placeholder="Reason for rejecting this item"
                          ver={ver}
                          role={role}
                          onChange={onChangeField}
                        />
                      </div>
                    ) : null}
                    <div className={`tech-status ${done ? 'ok' : 'bad'}`}>
                      {done
                        ? le?.status === 'Accepted'
                          ? 'Complete — line accepted'
                          : 'Complete — line rejected'
                        : 'Pending — complete all checks'}
                    </div>
                  </section>
                );
              })}
            </section>
          ))}
        </>
      )}

      <div className="rec">
        <b>Step 2 — Submit technical evaluation</b>
        <p className="note">
          Submit is enabled after every quoted vendor or vendor-item line has a complete decision and
          all required evidence notes.
        </p>
        {quoted.length ? (
          <button
            type="button"
            className="btn g"
            disabled={!(canTech && allComplete)}
            onClick={onSubmitTechEval}
          >
            Submit Technical Evaluation →
          </button>
        ) : (
          <span className="note">No quoted vendors found.</span>
        )}
      </div>
    </>
  );
};
