import React from 'react';
import type { NfaVersion, RoleName, StageId } from '../../types/enfa.ts';
import { LOOKUPS } from '../../utils/enfaConstants.ts';
import { canEditPath, fmtD, lblFor, wfDone } from '../../utils/enfaEngine.ts';

interface FieldProps {
  path: string;
  value: unknown;
  type?: string;
  placeholder?: string;
  ver: NfaVersion;
  role: RoleName;
  onChange: (path: string, val: string | number) => void;
  className?: string;
}

export const FieldControl: React.FC<FieldProps> = ({
  path,
  value,
  type = 't',
  placeholder = '',
  ver,
  role,
  onChange,
  className = '',
}) => {
  const disabled = !canEditPath(ver, role, path);
  const strVal = value == null ? '' : String(value);
  const aria = lblFor(path);

  if (type.startsWith('s:')) {
    const opts = LOOKUPS[type.slice(2)] || [];
    return (
      <select
        data-p={path}
        aria-label={aria}
        disabled={disabled}
        value={strVal}
        className={className}
        onChange={(e) => onChange(path, e.target.value)}
      >
        <option value="" />
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (type === 'a') {
    return (
      <>
        <textarea
          data-p={path}
          aria-label={aria}
          disabled={disabled}
          value={strVal}
          placeholder={placeholder}
          className={className}
          onChange={(e) => onChange(path, e.target.value)}
        />
        <div className="print-only">{strVal || '—'}</div>
      </>
    );
  }

  const inputType = type === 'd' ? 'date' : type === 'n' || type === 'p' ? 'number' : 'text';
  return (
    <>
      <input
        type={inputType}
        step="any"
        data-p={path}
        aria-label={aria}
        disabled={disabled}
        value={strVal}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(path, inputType === 'number' ? (raw === '' ? '' : Number(raw)) : raw);
        }}
      />
      {inputType === 'text' && /^nfa\./.test(path) ? (
        <span className="print-only">{strVal || '—'}</span>
      ) : null}
    </>
  );
};

export const LockBanner: React.FC<{ ver: NfaVersion }> = ({ ver }) => {
  if (ver.status === 'Draft') {
    const ns = (ver.returnedFrom?.notes || []).filter((x) => x.comment);
    if (!ns.length) return null;
    return (
      <div className="ret-note">
        <div>
          <b>
            Revision of {ver.returnedFrom?.ver} ({ver.returnedFrom?.status}) — approver comments to
            address:
          </b>
          <ul>
            {ns.map((x, idx) => (
              <li key={idx}>
                <b>
                  {x.lv} {x.role}
                  {x.name ? ` (${x.name})` : ''}
                </b>{' '}
                — {x.action}: {x.comment}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  const ok = ver.status === 'Approved';
  return (
    <div className={`lock ${ok ? 'lockok' : ''}`}>
      {ver.status === 'Pending' ? (
        '⏳ Submitted – all data is read-only during approval.'
      ) : (
        <>
          🔒 {ver.ver} is {ver.status.toUpperCase()} and LOCKED on {fmtD(ver.lockedOn)}. SHA-256:{' '}
          <code>{(ver.hash || '').slice(0, 24)}…</code>
        </>
      )}
    </div>
  );
};

interface StageSubmitBarProps {
  stage: StageId;
  label: string;
  ownerRole: RoleName;
  ver: NfaVersion;
  currentRole: RoleName;
  onSubmit: (stage: StageId) => void;
}

export const StageSubmitBar: React.FC<StageSubmitBarProps> = ({
  stage,
  label,
  ownerRole,
  ver,
  currentRole,
  onSubmit,
}) => {
  const ok = ver.status === 'Draft' && currentRole === ownerRole;
  const done = wfDone(ver.data, stage);
  return (
    <div className="stage-submit">
      <div className="txt">
        <b>Submit {label}</b>
        <span>
          Records the decision and unlocks the next step. Later changes to this stage reopen it for
          re-submission.
          {currentRole !== ownerRole ? (
            <>
              {' '}
              Only <b>{ownerRole}</b> can submit.
            </>
          ) : null}
        </span>
      </div>
      <span className={`st ${done ? '' : 'no'}`}>
        {done ? `✓ Submitted ${fmtD(ver.data.workflow?.submitted?.[stage]?.at)}` : 'Not yet submitted'}
      </span>
      <button type="button" className="btn g" disabled={!ok} onClick={() => onSubmit(stage)}>
        {done ? 'Re-submit' : 'Submit'} {label} →
      </button>
    </div>
  );
};
