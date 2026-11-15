export type RoleName =
  | 'Buyer'
  | 'Vendor'
  | 'User HOD (Technical)'
  | 'HOD – SCM'
  | 'Finance'
  | 'Head – SCM'
  | 'COO / Plant Head'
  | 'CFO'
  | 'MD / CEO';

export type ThemeId = 'slate' | 'navy' | 'steel';

export type StageId =
  | 'proj'
  | 'pr'
  | 'hdr'
  | 'quo'
  | 'qtc'
  | 'tech'
  | 'trm'
  | 'cs'
  | 'nfa';

export type TabId =
  | 'dash'
  | 'port'
  | 'ver'
  | 'cfg'
  | 'data'
  | StageId
  | 'apr';

export type VersionStatus =
  | 'Draft'
  | 'Pending'
  | 'Approved'
  | 'Returned'
  | 'Rejected'
  | 'Superseded';

export interface DoaBand {
  from: number;
  to: number;
  final: RoleName;
  fin: boolean;
  days: number;
}

export interface DoaLogEntry {
  t: string;
  u: string;
  e: string;
}

export interface ProjectInfo {
  projectNo: string;
  name: string;
  requester: string;
  dept: string;
  scope: string;
  category: string;
  budget: string;
  estimate: string | number;
  route: string;
  needBy: string;
  rfqTarget: string;
  awardTarget: string;
  buyer: string;
  tech: string;
  team: string;
}

export interface HeaderInfo {
  company: string;
  plant: string;
  prNo: string;
  prDate: string;
  needBy: string;
  dept: string;
  cat: string;
  budget: string;
  budgetCode: string;
  budgetAvail: string | number;
  route: string;
  rfqNo: string;
  rfqDate: string;
  rfqDue: string;
  cur: string;
  contacted: string | number;
  desc: string;
  just: string;
  mb: string;
  place: string;
  buyer: string;
  tech: string;
  committee: string;
  lpPO: string;
  lppVal?: string | number;
  consum: string | number;
  lifeLast: string;
  lifeExp: string;
  estimate: string | number;
  inrRate?: string | number;
  inrRateDate?: string;
  inrRateSrc?: string;
}

export interface VendorTerms {
  cur: string;
  fxRate: string | number;
  fxDate: string;
  fxSource: string;
  basis: string;
  delLoc: string;
  pay: string;
  adv: string | number;
  advSec: string;
  delTxt: string;
  delDays: string | number;
  freight: string;
  fr: string | number;
  pf: string | number;
  ins: string | number;
  oth: string | number;
  gst: string | number;
  warr: string;
  pbg: string | number;
  ld: string;
  insp: string;
  valid: string | number;
  firm: string;
  reg: string;
  dev: string;
  __lf?: number | null;
  [key: string]: string | number | null | undefined;
}

export interface TechCriterionEntry {
  result?: 'Pass' | 'Fail' | 'N/A' | '';
  note?: string;
}

export interface LineTechEval {
  evaluator: string;
  date: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | '';
  decisionNote?: string;
  criteria: Record<string, TechCriterionEntry>;
  submitted?: boolean;
  submittedOn?: string;
}

export interface VendorTechEval {
  legacy?: boolean;
  evaluator: string;
  date: string;
  status: 'Pending' | 'Accepted' | 'Rejected' | '';
  decisionNote?: string;
  criteria: Record<string, TechCriterionEntry>;
  submitted?: boolean;
  submittedOn?: string;
  lines?: Record<string, LineTechEval>;
}

export interface VendorAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  phase: 'quote' | 'negotiation';
  dataUrl?: string;
}

export interface Vendor {
  name: string;
  code: string;
  ref: string;
  qdate: string;
  fdate: string;
  terms: VendorTerms;
  qterms?: Partial<VendorTerms>;
  termsNeg?: boolean;
  techEval: VendorTechEval;
  attachments?: VendorAttachment[];
  quoteSubmittedAt?: string;
  negSubmittedAt?: string;
  quoteScope?: 'all' | 'partial';
}

export interface RateCell {
  q: string | number;
  n: string | number;
  regret?: boolean;
  regretReason?: string;
}

export interface LppInfo {
  status?: string;
  rate?: string | number;
  po?: string;
  vendor?: string;
}

export interface PrDocument {
  documentId?: string;
  documentName: string;
  documentType?: string;
  documentRevision?: string;
  documentDate?: string;
  fileSizeBytes?: number;
  checksumSha256?: string;
  isCurrent?: boolean;
}

export interface PrLine {
  prLineId: string;
  prId?: string;
  companyCode?: string;
  prNumber: string;
  prLineNumber: string;
  prDate?: string;
  approvalStatus: string;
  lineStatus?: string;
  requesterName?: string;
  departmentCode?: string;
  departmentName?: string;
  plantCode?: string;
  plantName?: string;
  budgetCode?: string;
  itemCode: string;
  itemDescription: string;
  itemLongDescription?: string;
  uomCode: string;
  requestedQty: string | number;
  previouslySourcedQty: string | number;
  blockedQty?: number;
  openQty: number;
  needByDate?: string;
  category?: string;
  specDocRef?: string;
  sourceRowVersion?: string;
  lastModifiedAt?: string;
  specCompleteness?: string;
  source?: string;
  documents?: PrDocument[];
  [key: string]: unknown;
}

export interface ErpAppliedLine {
  prLineId: string;
  prNumber: string;
  prLineNumber: string;
  itemCode: string;
  selectedQty: number;
  uomCode: string;
  plantCode?: string;
  plantName?: string;
  documents?: PrDocument[];
}

export interface LineItemErpSource {
  companyCode?: string;
  prId?: string;
  prLineId: string;
  prNumber: string;
  prLineNumber: string;
  prDate?: string;
  plantCode?: string;
  plantName?: string;
  departmentCode?: string;
  departmentName?: string;
  budgetCode?: string;
  selectedQty: number;
  requestedQty: string | number;
  openQty: number;
  sourceRowVersion?: string;
  lastModifiedAt?: string;
  snapshot?: PrLine;
  documents?: PrDocument[];
}

export interface LineItem {
  code: string;
  desc: string;
  uom: string;
  qty: string | number;
  r: RateCell[];
  lpp?: LppInfo;
  erpSource?: LineItemErpSource;
}

export interface PrImportLog {
  at: string;
  file: string;
  ok: boolean;
  rows: number;
  errors?: string[];
}

export interface ErpState {
  mode: string;
  prLines: PrLine[];
  selected: Record<string, { selected: boolean; selectedQty: number }>;
  filters: {
    companyCode?: string;
    plantCode?: string;
    prNumber?: string;
    itemCode?: string;
  };
  selectionApplied: boolean;
  appliedAt?: string;
  appliedLines?: ErpAppliedLine[];
  lastSync?: string | null;
  reservationId?: string | null;
  reservationStatus?: string;
  reservedAt?: string;
  correlationId?: string;
  pageInfo?: { page: number; pageSize: number; total: number };
  importLog?: PrImportLog;
}

export interface NfaNarrative {
  award: string;
  rationale: string;
  nonL1: string;
  lppJust: string;
  special: string;
  remarks: string;
  decl: string;
  ov: Record<string, string>;
  ovr: Record<string, string>;
  lppJ?: Record<string, string>;
}

export interface WorkflowSubmission {
  at: string;
  by: string;
}

export interface NfaData {
  techMode: string;
  project: ProjectInfo;
  projSync?: Record<string, unknown>;
  header: HeaderInfo;
  vendors: Vendor[];
  erp: ErpState;
  items: LineItem[];
  nfa: NfaNarrative;
  workflow?: {
    submitted: Partial<Record<StageId, WorkflowSubmission>>;
  };
}

export interface ApprovalStep {
  lv: string;
  role: RoleName;
  req?: boolean;
  name: string;
  action: 'Pending' | 'Approve' | 'Return for Revision' | 'Reject' | '';
  date: string;
  comment: string;
}

export interface AuditEntry {
  t: string;
  u: string;
  e: string;
}

export interface ReturnedNote {
  lv: string;
  role: string;
  name: string;
  action: string;
  comment: string;
  date: string;
}

export interface NfaVersion {
  ver: string;
  status: VersionStatus;
  createdOn: string;
  createdBy: string;
  reason: string;
  data: NfaData;
  prev?: string;
  prevHash?: string;
  hash?: string;
  hashV?: number;
  submittedOn?: string;
  lockedOn?: string;
  value?: number;
  valueInr?: number | null;
  currency?: string;
  band?: DoaBand;
  returnedFrom?: {
    ver: string;
    status: string;
    notes: ReturnedNote[];
  };
  approvals: ApprovalStep[];
  audit: AuditEntry[];
}

export interface NfaRecord {
  no: string;
  id: string;
  versions: NfaVersion[];
}

export interface EnfaStore {
  nfas: Record<string, NfaRecord>;
  cur: string;
  tab: TabId;
  role: RoleName;
  doa: DoaBand[];
  doaLog?: DoaLogEntry[];
  seq: number;
  lastBackup?: string;
  demoSeeded?: boolean;
  activeVendorIdx?: number;
  lastInternalTab?: TabId;
}

export interface RankedVendorRow {
  landed: number;
  j: number;
  rank: number;
}

export interface CalcRow {
  it: LineItem;
  qty: number;
  landed: (number | null)[];
  ranked: RankedVendorRow[];
  l1v: number | null;
  l1j: number | null;
  l2v: number | null;
  l2j: number | null;
  tie: boolean;
  gap: number | null;
}

export interface VendorSummary {
  name: string;
  cnt: number;
  q: number;
  n: number;
  qb: number;
  nb: number;
  l: number;
  currency: string;
  fx: number | null;
  complete: boolean;
  technicalStatus: string;
  rank: number | null;
}

export interface LppValidation {
  lppStMiss: boolean;
  lppRateMiss: boolean;
  lppPoMiss: boolean;
  lppVenMiss: boolean;
  lppMissing: boolean;
  lppJMissing: boolean;
  lppJShort: boolean;
  lppIssues: string[];
  lppWarn: string[];
  lppOk: boolean;
}

export interface AwardRow extends LppValidation {
  j: number | null;
  landed: number | null;
  q: number | null;
  n: number | null;
  unit: number | null;
  lppNo: boolean;
  lppRate: number | null;
  lppVar: number | null;
  lppPct: number | null;
  lppUp: boolean;
  lppImpact: number | null;
  lppJ: string;
  sav: number | null;
  isOv: boolean;
  tieOpen: boolean;
  nonL1: boolean;
  varL1: number | null;
}

export interface LppSummary {
  items: number;
  up: number;
  down: number;
  none: number;
  missing: number;
  jMissing: number;
  basket: number;
  now: number;
  impact: number;
  pct: number | null;
}

export interface CalcResult {
  lppSum: LppSummary;
  inr: number | null;
  totalInr: number | null;
  priced: number;
  negMissing: number[];
  lf: number[];
  fx: (number | null)[];
  cur: string[];
  base: string;
  rows: CalcRow[];
  vs: VendorSummary[];
  pkgJ: number | null;
  aw: AwardRow[];
  total: number;
  sav: number;
  qt: number;
  savPct: number | null;
  split: { j: number; name: string; val: number; share: number }[];
  band: DoaBand;
  tokCount: number;
  quoted: number;
}

export interface QtEvalResult {
  best: number[];
  worst: number[];
  equal: boolean;
  diff?: boolean;
  note: string;
}

export interface QtVendorModel {
  j: number;
  name: string;
  cur: string;
  fx: number | null;
  qt: VendorTerms;
  nt: VendorTerms;
  t: VendorTerms;
  ref: string;
  qdate: string;
  landed: number;
  basic: number;
  items: number;
  complete: boolean;
  comparable: number;
  priceIdx: number;
  flags: string[];
  score: number;
  rank: number;
  priceRank: number | null;
  bestCount: number;
}

export interface QtItemCell {
  r: number | null;
  basic: number | null;
  landed: number | null;
}

export interface QtItemModel {
  i: number;
  code: string;
  desc: string;
  uom: string;
  qty: number;
  cells: QtItemCell[];
  l1: number | null;
  l1k: number | null;
}

export interface QtScoreRow {
  key: string;
  lab: string;
  w: number;
  vals: (number | null)[];
  pts: number[];
}

export interface QtModel {
  src: 'q' | 'n';
  c: CalcResult;
  base: string;
  band: number;
  vend: QtVendorModel[];
  items: QtItemModel[];
  rows: { k: string; lab: string; ty: string; ev: QtEvalResult }[];
  scores: QtScoreRow[];
  best: QtVendorModel | null;
  anyTerms: boolean;
}

export interface NegotiationPoint {
  v: string;
  topic: string;
  cur: string;
  best: string;
  ask: string;
  pri: 'High' | 'Medium' | 'Low';
}

export interface SubmitBlocker {
  t: string;
  tab: TabId | null;
  label?: string;
}
