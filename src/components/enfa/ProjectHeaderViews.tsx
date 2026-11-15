import React from 'react';
import type { CalcResult, NfaRecord, NfaVersion, RoleName, StageId } from '../../types/enfa.ts';
import { HDR_FIELDS } from '../../utils/enfaConstants.ts';
import { FieldControl, LockBanner, StageSubmitBar } from './FieldControl.tsx';

export const ProjectView: React.FC<{
  nfa: NfaRecord;
  ver: NfaVersion;
  role: RoleName;
  onChangeField: (path: string, val: string | number) => void;
  onSubmitStage: (stage: StageId) => void;
}> = ({ nfa, ver, role, onChangeField, onSubmitStage }) => {
  const p = ver.data.project;

  return (
    <>
      <LockBanner ver={ver} />
      <h2>0. Create Sourcing Project</h2>
      <p className="note">
        Create the sourcing project and identify its team before preparing the RFQ. The project ID
        remains linked to this NFA.
      </p>
      <div className="rec">
        <b>Project ID:</b> {p?.projectNo || `SP/${nfa.no}`} &nbsp; <b>Stage:</b> Project setup ·{' '}
        {ver.status}
      </div>

      <div className="grid2">
        <table>
          <tbody>
            <tr>
              <td className="l">Project name *</td>
              <td>
                <FieldControl
                  path="project.name"
                  value={p.name}
                  placeholder="e.g. Plant maintenance spares sourcing"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Requester / sponsor *</td>
              <td>
                <FieldControl
                  path="project.requester"
                  value={p.requester}
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Requesting department *</td>
              <td>
                <FieldControl
                  path="project.dept"
                  value={p.dept}
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Category</td>
              <td>
                <FieldControl
                  path="project.category"
                  value={p.category}
                  type="s:cat"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Budget type</td>
              <td>
                <FieldControl
                  path="project.budget"
                  value={p.budget}
                  type="s:budget"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Estimated value</td>
              <td>
                <FieldControl
                  path="project.estimate"
                  value={p.estimate}
                  type="n"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Sourcing route</td>
              <td>
                <FieldControl
                  path="project.route"
                  value={p.route}
                  type="s:route"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <table>
          <tbody>
            <tr>
              <td className="l">Required-by date</td>
              <td>
                <FieldControl
                  path="project.needBy"
                  value={p.needBy}
                  type="d"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Target RFQ release</td>
              <td>
                <FieldControl
                  path="project.rfqTarget"
                  value={p.rfqTarget}
                  type="d"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Target award date</td>
              <td>
                <FieldControl
                  path="project.awardTarget"
                  value={p.awardTarget}
                  type="d"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Sourcing lead / buyer *</td>
              <td>
                <FieldControl
                  path="project.buyer"
                  value={p.buyer}
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Technical lead *</td>
              <td>
                <FieldControl
                  path="project.tech"
                  value={p.tech}
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
            <tr>
              <td className="l">Team members &amp; roles</td>
              <td>
                <FieldControl
                  path="project.team"
                  value={p.team}
                  type="a"
                  placeholder="Name — role; e.g. user department, SCM, Finance, Quality / Legal"
                  ver={ver}
                  role={role}
                  onChange={onChangeField}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Business need and scope *</h3>
      <FieldControl
        path="project.scope"
        value={p.scope}
        type="a"
        placeholder="Describe the need, scope, key specifications and intended outcome."
        ver={ver}
        role={role}
        onChange={onChangeField}
      />
      <p className="note">
        Required before continuing: project name, requester, department, scope, sourcing lead and
        technical lead. Team assignments are descriptive text in this workflow; role permissions are
        controlled via “Acting as”.
      </p>
      <StageSubmitBar
        stage="proj"
        label="Sourcing Project"
        ownerRole="Buyer"
        ver={ver}
        currentRole={role}
        onSubmit={onSubmitStage}
      />
    </>
  );
};

export const RfqHeaderView: React.FC<{
  ver: NfaVersion;
  c: CalcResult;
  role: RoleName;
  onChangeField: (path: string, val: string | number) => void;
  onSubmitStage: (stage: StageId) => void;
}> = ({ ver, c, role, onChangeField, onSubmitStage }) => {
  const half = Math.ceil(HDR_FIELDS.length / 2);
  const hRec = ver.data.header as unknown as Record<string, unknown>;

  const renderTable = (fields: typeof HDR_FIELDS) => (
    <table>
      <tbody>
        {fields.map(([k, label, type, mandatory]) => (
          <tr key={k}>
            <td className="l">
              {label}
              {mandatory ? ' *' : ''}
            </td>
            <td>
              <FieldControl
                path={`header.${k}`}
                value={hRec[k]}
                type={type}
                ver={ver}
                role={role}
                onChange={onChangeField}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <LockBanner ver={ver} />
      <h2>1. RFQ / Purchase Proposal Header</h2>
      <div className="grid2">
        {renderTable(HDR_FIELDS.slice(0, half))}
        {renderTable(HDR_FIELDS.slice(half))}
      </div>
      <p className="note">
        * Mandatory before submission. Vendors quoted: <b>{c.quoted}</b> · Technically accepted:{' '}
        <b>{c.tokCount}</b> (auto). The INR rate fields are mandatory for non-INR NFAs because
        approval bands (DoA) are defined in INR.
      </p>
      <StageSubmitBar
        stage="hdr"
        label="RFQ Header"
        ownerRole="Buyer"
        ver={ver}
        currentRole={role}
        onSubmit={onSubmitStage}
      />
    </>
  );
};
