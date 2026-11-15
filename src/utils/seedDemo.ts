import type {
  EnfaStore,
  NfaData,
  NfaRecord,
  PrLine,
  RoleName,
  Vendor,
  VendorTerms,
} from '../types/enfa.ts';
import { DEF_DOA, QT_KEYS, TECH_CRITERIA, TERMS } from './enfaConstants.ts';
import { calc, nowIso, num } from './enfaEngine.ts';

export const DEMO_ERP_PR_LINES: PrLine[] = [
  {
    prLineId: 'DEMO-PRL-0001',
    prId: 'DEMO-PRH-0001',
    companyCode: 'AIG-NG',
    prNumber: 'PR-DEMO-2026-451',
    prLineNumber: '00010',
    prDate: '2026-11-10',
    approvalStatus: 'Approved',
    lineStatus: 'Open',
    requesterName: 'Plant Maintenance HOD',
    departmentCode: 'MECH',
    departmentName: 'Mechanical',
    plantCode: 'NG-LAG',
    plantName: 'Lagos Plant',
    budgetCode: 'OPEX-MECH-26',
    itemCode: 'SP-BRG-22220',
    itemDescription: 'Spherical Roller Bearing 22220',
    itemLongDescription:
      'Bearing for mill drive assembly; verify dimensions and clearance against attached OEM datasheet.',
    uomCode: 'NOS',
    requestedQty: 25,
    previouslySourcedQty: 5,
    blockedQty: 0,
    openQty: 20,
    needByDate: '2027-02-15',
    category: 'MRO Spares',
    sourceRowVersion: 'DEMO-V1',
    lastModifiedAt: '2026-11-10T10:00:00Z',
    specCompleteness: 'ReviewRequired',
    documents: [
      {
        documentId: 'DEMO-DOC-001',
        documentName: 'Bearing OEM Datasheet.pdf',
        documentType: 'Datasheet',
        documentRevision: 'Rev 04',
        documentDate: '2026-08-12',
        fileSizeBytes: 324000,
        checksumSha256: 'DEMO-CHECKSUM-001',
        isCurrent: true,
      },
    ],
  },
  {
    prLineId: 'DEMO-PRL-0002',
    prId: 'DEMO-PRH-0002',
    companyCode: 'AIG-NG',
    prNumber: 'PR-DEMO-2026-458',
    prLineNumber: '00020',
    prDate: '2026-11-11',
    approvalStatus: 'Approved',
    lineStatus: 'Open',
    requesterName: 'Process HOD',
    departmentCode: 'PROCESS',
    departmentName: 'Process',
    plantCode: 'NG-ABJ',
    plantName: 'Abuja Plant',
    budgetCode: 'OPEX-RAW-26',
    itemCode: 'RM-SIMN-65',
    itemDescription: 'Silico Manganese 65%',
    itemLongDescription:
      'Bulk alloy requirement; exact chemistry and sizing acceptance shall be as per attached specification revision.',
    uomCode: 'MT',
    requestedQty: 180,
    previouslySourcedQty: 30,
    blockedQty: 0,
    openQty: 150,
    needByDate: '2027-03-01',
    category: 'Raw Material',
    sourceRowVersion: 'DEMO-V2',
    lastModifiedAt: '2026-11-11T08:30:00Z',
    specCompleteness: 'Complete',
    documents: [
      {
        documentId: 'DEMO-DOC-002',
        documentName: 'SiMn Purchase Specification.pdf',
        documentType: 'Specification',
        documentRevision: 'Rev 03',
        documentDate: '2026-09-20',
        fileSizeBytes: 512000,
        checksumSha256: 'DEMO-CHECKSUM-002',
        isCurrent: true,
      },
      {
        documentId: 'DEMO-DOC-003',
        documentName: 'Sizing and Sampling Standard.pdf',
        documentType: 'Standard',
        documentRevision: 'Rev 02',
        documentDate: '2026-07-05',
        fileSizeBytes: 221000,
        checksumSha256: 'DEMO-CHECKSUM-003',
        isCurrent: true,
      },
    ],
  },
  {
    prLineId: 'DEMO-PRL-0003',
    prId: 'DEMO-PRH-0002',
    companyCode: 'AIG-NG',
    prNumber: 'PR-DEMO-2026-458',
    prLineNumber: '00030',
    prDate: '2026-11-11',
    approvalStatus: 'Approved',
    lineStatus: 'Open',
    requesterName: 'Process HOD',
    departmentCode: 'PROCESS',
    departmentName: 'Process',
    plantCode: 'NG-ABJ',
    plantName: 'Abuja Plant',
    budgetCode: 'OPEX-RAW-26',
    itemCode: 'RM-FESI-75',
    itemDescription: 'Ferro Silicon 75%',
    itemLongDescription:
      'Bulk alloy requirement. Supplier offer must meet chemistry and size range defined in specification.',
    uomCode: 'MT',
    requestedQty: 60,
    previouslySourcedQty: 0,
    blockedQty: 0,
    openQty: 60,
    needByDate: '2027-03-01',
    category: 'Raw Material',
    sourceRowVersion: 'DEMO-V2',
    lastModifiedAt: '2026-11-11T08:30:00Z',
    specCompleteness: 'Complete',
    documents: [
      {
        documentId: 'DEMO-DOC-004',
        documentName: 'FeSi 75 Purchase Specification.pdf',
        documentType: 'Specification',
        documentRevision: 'Rev 01',
        documentDate: '2026-10-01',
        fileSizeBytes: 412000,
        checksumSha256: 'DEMO-CHECKSUM-004',
        isCurrent: true,
      },
    ],
  },
];

export function blankTerms(): VendorTerms {
  const t: Record<string, string | number> = {
    cur: '',
    fxRate: '',
    fxDate: '',
    fxSource: '',
  };
  TERMS.forEach(([k, , ty]) => {
    if (ty === 'calc') return;
    t[k] = ty === 'p' || ty === 'n' ? '' : k === 'reg' ? 'Yes' : '';
  });
  return t as unknown as VendorTerms;
}

export function sampleData(): NfaData {
  const mkV = (name: string, t: Partial<VendorTerms>): Vendor => ({
    name,
    code: '',
    ref: '',
    qdate: '',
    fdate: '',
    terms: Object.assign(blankTerms(), { cur: 'INR', fxRate: 1 }, t),
    techEval: { evaluator: '', date: '', status: 'Pending', decisionNote: '', criteria: {} },
  });

  return {
    techMode: '',
    project: {
      projectNo: '',
      name: '',
      requester: '',
      dept: '',
      scope: '',
      category: 'Rolls',
      budget: 'OPEX',
      estimate: '',
      route: 'Limited RFQ',
      needBy: '',
      rfqTarget: '',
      awardTarget: '',
      buyer: '',
      tech: '',
      team: '',
    },
    header: {
      company: 'AFRZEN',
      plant: '',
      prNo: '',
      prDate: '',
      needBy: '',
      dept: '',
      cat: 'Rolls',
      budget: 'OPEX',
      budgetCode: '',
      budgetAvail: 1200000,
      route: 'Limited RFQ',
      rfqNo: '',
      rfqDate: '',
      rfqDue: '',
      cur: 'INR',
      contacted: 3,
      desc: 'Mill rolls – 3 line items',
      just: '',
      mb: 'Buy',
      place: '',
      buyer: '',
      tech: '',
      committee: '',
      lpPO: '',
      lppVal: '',
      consum: '',
      lifeLast: '',
      lifeExp: '',
      estimate: '',
    },
    vendors: [
      mkV('M/s M K Alloys', {
        basis: 'Ex-works Mandi Gobindgarh',
        pay: '25% adv against ABG, bal against PI after readiness before dispatch',
        adv: 25,
        advSec: 'ABG',
        delTxt: '3 Months from Advance & Drawing Approval',
        delDays: 90,
        freight: 'Extra at actuals',
        fr: 4.5,
        pf: 0,
        ins: 2,
        oth: 0,
        gst: 18,
        warr: '12 months from supply',
        ld: '0.5%/week, max 5%',
        insp: 'In-house',
        valid: 7,
        firm: 'Firm',
      }),
      mkV('M/s Shiva Metal Rolls', {
        basis: 'FOR JNPT Port',
        pay: '10% adv against undated SC, bal against PI after readiness before dispatch',
        adv: 10,
        advSec: 'Undated SC',
        delTxt: '2 Months from Advance & Drawing Approval',
        delDays: 60,
        freight: 'Included',
        fr: 0,
        pf: 0,
        ins: 0,
        oth: 0,
        gst: 18,
        warr: '18 months from supply',
        ld: '0.5%/week, max 5%',
        insp: 'In-house',
        valid: 30,
        firm: 'Firm',
      }),
      mkV('M/s Behari Lal Ispat', {
        basis: 'FOR JNPT Port',
        pay: '25% adv against PI, bal against PI after readiness before dispatch',
        adv: 25,
        advSec: 'None',
        delTxt: '4 Months from Advance & Drawing Approval',
        delDays: 120,
        freight: 'Included',
        fr: 0,
        pf: 0,
        ins: 0,
        oth: 0,
        gst: 18,
        warr: '12 months from commissioning',
        ld: '0.5%/week, max 5%',
        insp: 'In-house',
        valid: 15,
        firm: 'Firm',
      }),
    ],
    erp: {
      mode: 'not-connected',
      prLines: [],
      selected: {},
      filters: { companyCode: '', plantCode: '', prNumber: '', itemCode: '' },
      selectionApplied: false,
      lastSync: null,
      reservationId: null,
    },
    items: [
      {
        code: 'SPMERLL5291407',
        desc: 'ROLLS DIA 580X1500X2700, DRG OSPL-J.S.R.M.I/1482, ADAMITE hardness 45-50',
        uom: 'NOS',
        qty: 1,
        r: [
          { q: 426650, n: 426650 },
          { q: 478000, n: 470000 },
          { q: 472000, n: 462000 },
        ],
      },
      {
        code: 'SPMERLL5291471',
        desc: 'ROLLS, BOTTOM ROLL, SIZE 610X1000X2245MM, SGI, HRD 58-63, DRG J.S.R.M.I/1516-1',
        uom: 'NOS',
        qty: 1,
        r: [
          { q: 455000, n: 447000 },
          { q: 322490, n: 306365.5 },
          { q: 395000, n: 386000 },
        ],
      },
      {
        code: 'SPMERLL5291408',
        desc: 'ROLLS DIA 600X1100X2300, DRG OSPL-J.S.R.M.I/1482-1, ADAMITE hardness 45-50',
        uom: 'NOS',
        qty: 1,
        r: [
          { q: 415000, n: 405000 },
          { q: 520000, n: 506000 },
          { q: 350175, n: 332666.25 },
        ],
      },
    ],
    nfa: {
      award: 'Item-wise L1',
      rationale: '',
      nonL1: '',
      lppJust: '',
      special: '',
      remarks: '',
      decl: 'No',
      ov: {},
      ovr: {},
      lppJ: {},
    },
    workflow: { submitted: {} },
  };
}

export function createDemoNfaRecord(): NfaRecord {
  const demoId = 'nfa_demo_preloaded_2026';
  const d = sampleData();
  const dd0 = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const date = dd0(0);
  const ts = nowIso();
  d.techMode = 'Vendor-wise';
  d.project = {
    projectNo: 'SP/2026/DEMO',
    name: 'Mill Rolls Procurement – Demonstration',
    requester: 'Plant Maintenance HOD',
    dept: 'Rolling Mill',
    scope: 'Procurement of three mill roll items for rolling mill operations. Demonstration data only.',
    category: 'Rolls',
    budget: 'OPEX',
    estimate: 1300000,
    route: 'Limited RFQ',
    needBy: dd0(200),
    rfqTarget: date,
    awardTarget: dd0(30),
    buyer: 'SCM Buyer – Demo',
    tech: 'Mechanical HOD – Demo',
    team: 'User Department – Requirement; SCM – Sourcing; Technical – Evaluation; Finance – Review',
  };
  Object.assign(d.header, {
    company: 'AFRZEN',
    plant: 'Rolling Mill – Demo Plant',
    prNo: 'PR-DEMO-2026-001',
    prDate: dd0(-5),
    needBy: dd0(200),
    dept: 'Rolling Mill',
    cat: 'Rolls',
    budget: 'OPEX',
    budgetCode: 'OPEX-RM-2026',
    budgetAvail: 1500000,
    route: 'Limited RFQ',
    rfqNo: 'RFQ-DEMO-2026-001',
    rfqDate: date,
    rfqDue: dd0(7),
    cur: 'INR',
    contacted: 3,
    desc: 'Procurement of three mill roll items for rolling mill operations.',
    just: 'Replacement of worn mill rolls to maintain production reliability and product quality.',
    mb: 'Buy',
    place: 'Rolling Mill – Demo Plant',
    buyer: 'SCM Buyer – Demo',
    tech: 'Mechanical HOD – Demo',
    committee: 'SCM, Mechanical, Finance',
    lpPO: 'See item-wise LPP in CS',
    consum: 1100000,
    lifeLast: '12 months',
    lifeExp: '12–18 months',
    estimate: 1300000,
  });

  d.vendors.forEach((v, j) => {
    v.ref = `QUOT-DEMO-${j + 1}`;
    v.qdate = date;
    v.terms.valid = Math.max(Number(v.terms.valid) || 0, 30);
    v.terms.cur = 'INR';
    v.terms.fxRate = 1;
    Object.assign(v.terms, {
      delLoc: 'AFRZEN Demo Plant',
      fxDate: date,
      fxSource: 'Not applicable – INR quotation',
      reg: 'Yes',
      firm: 'Firm',
    });
    v.techEval = {
      evaluator: 'Mechanical HOD – Demo',
      date,
      status: 'Accepted',
      submitted: true,
      submittedOn: ts,
      decisionNote: 'Technically acceptable for demonstration.',
      criteria: {},
    };
    TECH_CRITERIA.forEach(([k]) => {
      v.techEval.criteria[k] = { result: 'Pass', note: 'Complies with RFQ requirement' };
    });
  });

  d.items.forEach((it) => {
    it.r.forEach((r) => {
      if (num(r.q) != null && num(r.n) == null) r.n = r.q;
    });
  });

  const qd: Partial<VendorTerms>[] = [
    { adv: 30, advSec: 'ABG', delTxt: '4 Months from Advance & Drawing Approval', delDays: 120, valid: 15, warr: '12 months from supply' },
    { freight: 'Extra at actuals', fr: 3, delTxt: '2 Months from Advance & Drawing Approval', warr: '12 months from supply', valid: 21 },
    { adv: 30, advSec: 'None', delTxt: '5 Months from Advance & Drawing Approval', delDays: 150, valid: 7, dev: 'Hardness tolerance ±3 HRC instead of ±2' },
  ];
  d.vendors.forEach((v, j) => {
    v.qterms = {};
    QT_KEYS().forEach((k) => {
      v.qterms![k] = v.terms[k];
    });
    Object.assign(v.qterms, qd[j] || {});
    v.termsNeg = true;
  });

  d.nfa.rationale =
    'Award recommendation is based on the item-wise landed cost comparison of technically accepted vendors. Any L2 selection is separately identified with an item-level reason.';
  d.nfa.nonL1 =
    'Demonstration justification: L2 selected for one line to illustrate the NFA L1/L2 selection and audit-reason field. Validate actual commercial and operational grounds before using a live NFA.';
  d.nfa.lppJust =
    'Current recommendation compared with the previous purchase and approved estimate; validate benchmark comparability before live submission.';
  d.nfa.special =
    'Supply schedule, inspection and warranty shall be as recorded in the vendor commercial terms.';
  d.nfa.remarks =
    'Pre-filled illustrative data for reviewing the NFA screen and L1/L2 selection controls.';
  d.nfa.decl = 'Yes';

  const lppDemo = [
    { status: 'Available', rate: 410000, po: 'PO-DEMO-2025-014 / 15-10-2025', vendor: 'M/s M K Alloys' },
    { status: 'Available', rate: 320000, po: 'PO-DEMO-2025-021 / 02-12-2025', vendor: 'M/s Shiva Metal Rolls' },
    { status: 'Available', rate: 345000, po: 'PO-DEMO-2025-014 / 15-10-2025', vendor: 'M/s M K Alloys' },
  ];
  d.items.forEach((it, i) => {
    it.lpp = Object.assign({}, lppDemo[i] || { status: 'First purchase – no LPP' });
  });
  d.nfa.lppJ = {
    '0': 'Adamite roll prices up on Ni/Mo alloy index since last PO (Oct-25); L2 selected for earlier delivery. Increase within market trend.',
  };

  d.workflow = { submitted: {} };
  (['proj', 'pr', 'hdr', 'quo', 'qtc', 'tech', 'trm', 'cs'] as const).forEach((k) => {
    d.workflow!.submitted[k] = {
      at: ts,
      by: k === 'tech' ? 'User HOD (Technical)' : 'Buyer',
    };
  });

  const c = calc(d, DEF_DOA);
  if (c.rows[0]?.l2j != null) {
    d.nfa.ov['0'] = String(c.rows[0].l2j);
    d.nfa.ovr['0'] =
      'Illustrative L2 selection: use this field to record a documented delivery, quality, capacity or total-cost reason in a live case.';
  }

  return {
    no: 'NFA/2026/DEMO',
    id: demoId,
    versions: [
      {
        ver: 'V1.0',
        status: 'Draft',
        createdOn: ts,
        createdBy: 'Buyer',
        reason: 'Preloaded demonstration record',
        data: d,
        approvals: [],
        audit: [
          {
            t: ts,
            u: 'System Demo',
            e: 'Preloaded sample sourcing project, RFQ, quotations, technical evaluation, negotiation and CS for NFA review.',
          },
        ],
      },
    ],
  };
}

export function createInitialStore(): EnfaStore {
  const demo = createDemoNfaRecord();
  return {
    nfas: { [demo.id]: demo },
    cur: demo.id,
    tab: 'dash',
    role: 'Buyer',
    doa: JSON.parse(JSON.stringify(DEF_DOA)),
    doaLog: [],
    seq: 26909,
    demoSeeded: true,
  };
}

export function createNewNfaRecord(seq: number, role: RoleName): NfaRecord {
  const yr = new Date().getFullYear();
  const no = `NFA/${yr}/${seq}`;
  const id = `n${Date.now()}`;
  const pno = `SP/${yr}/${String(seq).padStart(4, '0')}`;
  const d = sampleData();
  d.project.projectNo = pno;
  return {
    no,
    id,
    versions: [
      {
        ver: 'V1.0',
        status: 'Draft',
        createdOn: nowIso(),
        createdBy: role,
        reason: 'Initial creation',
        data: d,
        approvals: [],
        audit: [{ t: nowIso(), u: role, e: 'NFA created (V1.0)' }],
      },
    ],
  };
}

export function migrateStore(raw: EnfaStore | null | undefined): EnfaStore {
  if (!raw || typeof raw !== 'object' || !raw.nfas || !Object.keys(raw.nfas).length) {
    return createInitialStore();
  }
  const s = raw;
  s.doa = Array.isArray(s.doa) && s.doa.length ? s.doa : JSON.parse(JSON.stringify(DEF_DOA));
  s.role = s.role || 'Buyer';
  s.tab = s.tab || 'dash';
  s.seq = s.seq || 26909;

  Object.values(s.nfas).forEach((n) => {
    (n.versions || []).forEach((v) => {
      const d = v.data;
      if (!d) return;
      if (!d.techMode && d.vendors?.some((x) => x.techEval && (x.techEval.legacy || x.techEval.submitted || x.techEval.evaluator))) {
        d.techMode = 'Vendor-wise';
      }
      if (v.status === 'Draft' && Array.isArray(d.vendors)) {
        const w = d.workflow?.submitted || {};
        d.vendors.forEach((x) => {
          if (!x.qterms && w.quo) {
            x.qterms = {};
            Object.keys(x.terms || {}).forEach((k) => {
              if (!['cur', 'fxRate', 'fxDate', 'fxSource'].includes(k)) {
                x.qterms![k] = x.terms[k];
              }
            });
          }
          x.techEval = x.techEval || {
            evaluator: '',
            date: '',
            status: 'Pending',
            decisionNote: '',
            criteria: {},
          };
        });
        if (w.quo && w.tech && !w.qtc) {
          w.qtc = {
            at: w.tech.at || nowIso(),
            by: 'Migration (quoted terms = current terms)',
          };
        }
      }
      if (!v.hash && Array.isArray(d.vendors)) {
        d.vendors.forEach((x) => {
          x.terms = x.terms || blankTerms();
          x.terms.cur = x.terms.cur || d.header?.cur || 'INR';
          if (x.terms.cur === (d.header?.cur || 'INR') && x.terms.fxRate == null) {
            x.terms.fxRate = 1;
          }
        });
        if (!d.project) {
          d.project = {
            projectNo: `SP/LEGACY/${n.no}`,
            name: '',
            requester: '',
            dept: d.header?.dept || '',
            scope: d.header?.desc || '',
            category: d.header?.cat || 'Raw Material',
            budget: d.header?.budget || 'OPEX',
            estimate: d.header?.estimate || '',
            route: d.header?.route || 'Open RFQ',
            needBy: d.header?.needBy || '',
            rfqTarget: '',
            awardTarget: '',
            buyer: d.header?.buyer || '',
            tech: d.header?.tech || '',
            team: '',
          };
        } else if (!d.project.projectNo) {
          d.project.projectNo = `SP/LEGACY/${n.no}`;
        }
      }
    });
  });

  if (!s.cur || !s.nfas[s.cur]) {
    s.cur = Object.keys(s.nfas)[0];
  }
  return s;
}
