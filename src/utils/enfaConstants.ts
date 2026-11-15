import type { DoaBand, RoleName, StageId } from '../types/enfa.ts';

export const ROLES: RoleName[] = [
  'Buyer',
  'Vendor',
  'User HOD (Technical)',
  'HOD – SCM',
  'Finance',
  'Head – SCM',
  'COO / Plant Head',
  'CFO',
  'MD / CEO',
];

export const DOA_FINAL_ROLES: RoleName[] = [
  'Head – SCM',
  'COO / Plant Head',
  'CFO',
  'MD / CEO',
];

export const DEF_DOA: DoaBand[] = [
  { from: 0, to: 500000, final: 'Head – SCM', fin: false, days: 3 },
  { from: 500000, to: 2500000, final: 'COO / Plant Head', fin: false, days: 5 },
  { from: 2500000, to: 10000000, final: 'CFO', fin: true, days: 7 },
  { from: 10000000, to: 1e15, final: 'MD / CEO', fin: true, days: 10 },
];

export const LOOKUPS: Record<string, string[]> = {
  lppst: ['Available', 'First purchase – no LPP'],
  cat: [
    'Raw Material',
    'Spares',
    'Consumables',
    'Refractory',
    'Capital Goods',
    'Services',
    'Rolls',
    'Electrical',
    'Instrumentation',
  ],
  budget: ['OPEX', 'CAPEX'],
  route: [
    'Open RFQ',
    'Limited RFQ',
    'Single Source',
    'Proprietary (OEM)',
    'Emergency',
    'Rate Contract / Repeat',
  ],
  yn: ['Yes', 'No'],
  techMode: ['Vendor-wise', 'Line-wise'],
  eval: ['Pending', 'Accepted', 'Rejected'],
  criterion: ['Pass', 'Fail', 'N/A'],
  award: ['Item-wise L1'],
  freight: ['Included', 'Extra at actuals', 'Extra – fixed'],
  insp: ['Not required', 'In-house', 'TPI', 'Buyer witness at vendor works'],
  mb: ['Buy', 'Make'],
  cur: ['INR', 'NGN', 'USD', 'EUR', 'CNY'],
};

export type FieldDef = [key: string, label: string, type: string, mandatory: 0 | 1];

export const HDR_FIELDS: FieldDef[] = [
  ['company', 'Company', 't', 1],
  ['plant', 'Plant', 't', 1],
  ['prNo', 'Source PR Reference(s)', 't', 1],
  ['prDate', 'Source PR Date (earliest)', 'd', 1],
  ['needBy', 'Required By (Need-by)', 'd', 1],
  ['dept', 'User Department', 't', 1],
  ['cat', 'Purchase Category', 's:cat', 1],
  ['budget', 'Budget Type', 's:budget', 1],
  ['budgetCode', 'Budget Code / WBS', 't', 1],
  ['budgetAvail', 'Budget Available', 'n', 1],
  ['route', 'Sourcing Route', 's:route', 1],
  ['rfqNo', 'RFQ Number', 't', 1],
  ['rfqDate', 'RFQ Date', 'd', 1],
  ['rfqDue', 'RFQ Due Date', 'd', 0],
  ['cur', 'NFA Base Currency', 's:cur', 1],
  ['contacted', 'Vendors Contacted', 'n', 1],
  ['desc', 'Description of Requirement', 'a', 1],
  ['just', 'Justification of Requirement', 'a', 1],
  ['mb', 'Make / Buy', 's:mb', 1],
  ['place', 'Place of Use', 't', 0],
  ['buyer', 'Buyer Name', 't', 1],
  ['tech', 'Technical Evaluator', 't', 1],
  ['committee', 'Negotiation Committee', 't', 0],
  ['lpPO', 'Previous PO reference (summary – item-wise LPP captured in CS)', 't', 0],
  ['consum', 'Last Year Consumption Value', 'n', 0],
  ['lifeLast', 'Life of Last Material', 't', 0],
  ['lifeExp', 'Expected Life (Current)', 't', 0],
  ['estimate', 'Estimate / Benchmark Value', 'n', 0],
  ['inrRate', 'INR per 1 unit of base currency (for DoA)', 'n', 0],
  ['inrRateDate', 'INR rate date', 'd', 0],
  ['inrRateSrc', 'INR rate source', 't', 0],
];

export const FX_KEYS = ['cur', 'fxRate', 'fxDate', 'fxSource'];

export type TermDef = [key: string, label: string, type: 't' | 'a' | 'n' | 'p' | 's:freight' | 's:insp' | 's:yn' | 'calc'];

export const TERMS: TermDef[] = [
  ['basis', 'Price Basis / Incoterms', 't'],
  ['delLoc', 'Delivery Location', 't'],
  ['pay', 'Payment Terms', 'a'],
  ['adv', 'Advance %', 'p'],
  ['advSec', 'Advance Security (ABG / SC / None)', 't'],
  ['delTxt', 'Delivery Period (text)', 't'],
  ['delDays', 'Delivery Period (days)', 'n'],
  ['freight', 'Freight', 's:freight'],
  ['fr', 'Freight Loading %', 'p'],
  ['pf', 'Packing & Forwarding Loading %', 'p'],
  ['ins', 'Insurance Loading %', 'p'],
  ['oth', 'Other Loading %', 'p'],
  ['LF', 'Total Landing Factor %', 'calc'],
  ['gst', 'GST / VAT %', 'p'],
  ['warr', 'Warranty / Guarantee', 't'],
  ['pbg', 'PBG %', 'p'],
  ['ld', 'LD Clause', 't'],
  ['insp', 'Inspection / TPI', 's:insp'],
  ['valid', 'Offer Validity (days)', 'n'],
  ['firm', 'Price Firm / Variable', 't'],
  ['reg', 'Vendor Registered in ERP', 's:yn'],
  ['dev', 'Deviations from RFQ', 'a'],
];

export const TECH_CRITERIA: [string, string][] = [
  ['spec', 'Compliance with RFQ technical specifications'],
  ['material', 'Materials, grades and applicable standards'],
  ['drawings', 'Drawings, datasheets and technical documents'],
  ['quality', 'Quality plan, testing and inspection requirements'],
  ['scope', 'Scope completeness, interfaces and exclusions'],
  ['delivery', 'Delivery, installation and commissioning requirements'],
  ['warranty', 'Warranty, service and after-sales support'],
];

export const WF_ORDER: StageId[] = ['proj', 'pr', 'hdr', 'quo', 'qtc', 'tech', 'trm', 'cs', 'nfa'];

export const WF_NEXT: Record<StageId, StageId | 'apr'> = {
  proj: 'pr',
  pr: 'hdr',
  hdr: 'quo',
  quo: 'qtc',
  qtc: 'tech',
  tech: 'trm',
  trm: 'cs',
  cs: 'nfa',
  nfa: 'apr',
};

export const STAGE_META: Record<StageId | 'apr', [string, string]> = {
  proj: ['Project', 'Buyer'],
  pr: ['PR Details', 'Buyer'],
  hdr: ['RFQ Header', 'Buyer'],
  quo: ['Quotes', 'Buyer'],
  qtc: ['Quoted Terms', 'Buyer'],
  tech: ['Tech Eval', 'Technical HOD'],
  trm: ['Negotiation', 'Buyer'],
  cs: ['Comp. Statement', 'Buyer'],
  nfa: ['NFA', 'Buyer'],
  apr: ['Approval', 'Approvers'],
};

export const STAGE_ROLE: Record<StageId, RoleName> = {
  proj: 'Buyer',
  pr: 'Buyer',
  hdr: 'Buyer',
  quo: 'Buyer',
  qtc: 'Buyer',
  tech: 'User HOD (Technical)',
  trm: 'Buyer',
  cs: 'Buyer',
  nfa: 'Buyer',
};

export const STEP_ITEMS: { key: StageId | 'apr'; no: string }[] = [
  { key: 'proj', no: '0' },
  { key: 'pr', no: '0A' },
  { key: 'hdr', no: '1' },
  { key: 'quo', no: '2' },
  { key: 'qtc', no: '2A' },
  { key: 'tech', no: '3' },
  { key: 'trm', no: '4' },
  { key: 'cs', no: '5' },
  { key: 'nfa', no: '6' },
  { key: 'apr', no: '7' },
];

export const PR_COLS: [string, string, 0 | 1, string][] = [
  ['prNumber', 'PR_Number', 1, 'PR-2026-0451'],
  ['prLineNumber', 'PR_Line', 1, '10'],
  ['prDate', 'PR_Date', 0, '2026-11-10'],
  ['approvalStatus', 'PR_Approval_Status', 1, 'Approved'],
  ['companyCode', 'Company_Code', 0, 'AIG-NG'],
  ['plantCode', 'Plant_Code', 0, 'NG-LAG'],
  ['plantName', 'Plant_Name', 0, 'Lagos Plant'],
  ['departmentName', 'Department', 0, 'Mechanical'],
  ['requesterName', 'Requester', 0, 'Plant Maintenance HOD'],
  ['budgetCode', 'Budget_Code', 0, 'OPEX-MECH-26'],
  ['itemCode', 'Item_Code', 1, 'SP-BRG-22220'],
  ['itemDescription', 'Item_Description', 1, 'Spherical Roller Bearing 22220'],
  ['itemLongDescription', 'Specification_Long_Text', 0, 'C3 clearance; brass cage; as per OEM datasheet'],
  ['uomCode', 'UOM', 1, 'NOS'],
  ['requestedQty', 'PR_Qty', 1, '25'],
  ['previouslySourcedQty', 'Already_Sourced_Qty', 0, '5'],
  ['needByDate', 'Need_By_Date', 0, '2027-02-15'],
  ['category', 'Category', 0, 'MRO Spares'],
  ['specDocRef', 'Spec_Document_Ref', 0, 'OEM Datasheet Rev 04'],
];

export const PR_NUM = ['requestedQty', 'previouslySourcedQty'];
export const PR_DATE = ['prDate', 'needByDate'];
export const PR_STATUS = ['Approved', 'Pending Approval', 'Rejected', 'Closed'];

export const QT_KEYS = () => TERMS.filter((t) => t[2] !== 'calc').map((t) => t[0]);
export const QT_REQ = ['basis', 'pay', 'adv', 'delDays', 'freight', 'warr', 'valid'];
export const QT_W: [string, string, number][] = [
  ['price', 'Price – landed value (quoted terms)', 60],
  ['del', 'Delivery period', 10],
  ['adv', 'Advance % (lower is better)', 10],
  ['warr', 'Warranty (months)', 8],
  ['valid', 'Offer validity (days)', 4],
  ['ld', 'LD cap %', 4],
  ['pbg', 'Performance BG %', 4],
];

export const QT_CH: Record<string, [string, string]> = {
  same: ['Unchanged', '#6B7280'],
  better: ['Improved', '#067647'],
  worse: ['Worsened', '#B42318'],
  changed: ['Changed', '#B54708'],
  added: ['Added', '#1D4ED8'],
};

export const LPP_J_MIN = 20;
export const LPP_WARN_PCT = 0.5;
