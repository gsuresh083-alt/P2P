import type { DoaBand, NfaData, NfaRecord, NfaVersion, QtModel } from '../types/enfa.ts';
import { TERMS } from './enfaConstants.ts';
import {
  calc,
  fmt,
  num,
  qtChange,
  qtCore,
  qtDisp,
  qtFlagOf,
  qtHas,
  qtPoints,
} from './enfaEngine.ts';

const enc = new TextEncoder();

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (b: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zipFiles(files: { name: string; data: string | Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const cen: Uint8Array[] = [];
  let off = 0;
  files.forEach((f) => {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true);
    h.setUint16(10, 0, true);
    h.setUint16(12, 0x5821, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, 0, true);
    c.setUint16(14, 0x5821, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint16(30, 0, true);
    c.setUint16(32, 0, true);
    c.setUint16(34, 0, true);
    c.setUint16(36, 0, true);
    c.setUint32(38, 0, true);
    c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  });

  const cenSize = cen.reduce((s, a) => s + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cenSize, true);
  e.setUint32(16, off, true);
  const all = [...parts, ...cen, new Uint8Array(e.buffer)];
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
  let p = 0;
  all.forEach((a) => {
    out.set(a, p);
    p += a.length;
  });
  return out;
}

const xmlEsc = (s: unknown): string =>
  String(s ?? '')
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const col = (n: number): string => {
  let s = '';
  let numVal = n + 1;
  while (numVal > 0) {
    const m = (numVal - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    numVal = Math.floor((numVal - 1) / 26);
  }
  return s;
};

const ref = (r: number, c: number): string => col(c) + (r + 1);
const hex = (c?: string): string => 'FF' + String(c || '000000').replace('#', '').toUpperCase();

interface CellStyle {
  b?: number | boolean;
  i?: number | boolean;
  u?: boolean;
  sz?: number;
  color?: string;
  fill?: string;
  border?: boolean;
  bc?: string;
  bb?: string;
  bbc?: string;
  fmt?: string;
  h?: string;
  v?: string;
  wrap?: boolean;
  indent?: number;
}

class Styles {
  fonts = ['<font><sz val="10"/><color rgb="FF111827"/><name val="Arial"/></font>'];
  fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  fmts: [number, string][] = [];
  xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  map: Record<string, number> = {};

  idx(arr: string[], s: string): number {
    let i = arr.indexOf(s);
    if (i < 0) {
      arr.push(s);
      i = arr.length - 1;
    }
    return i;
  }

  get(o?: CellStyle): number {
    if (!o) return 0;
    const k = JSON.stringify(o);
    if (this.map[k] != null) return this.map[k];
    const font = this.idx(
      this.fonts,
      `<font>${o.b ? '<b/>' : ''}${o.i ? '<i/>' : ''}${o.u ? '<u/>' : ''}<sz val="${
        o.sz || 10
      }"/><color rgb="${hex(o.color || '111827')}"/><name val="Arial"/></font>`
    );
    const fill = o.fill
      ? this.idx(
          this.fills,
          `<fill><patternFill patternType="solid"><fgColor rgb="${hex(
            o.fill
          )}"/><bgColor indexed="64"/></patternFill></fill>`
        )
      : 0;
    const bc = hex(o.bc || 'D0D5DD');
    const side = (n: string, st?: string) =>
      st
        ? `<${n} style="${st}"><color rgb="${
            n === 'bottom' && o.bb ? hex(o.bbc || '111827') : bc
          }"/></${n}>`
        : `<${n}/>`;
    const border =
      o.border === false
        ? 0
        : this.idx(
            this.borders,
            `<border>${side('left', 'thin')}${side('right', 'thin')}${side('top', 'thin')}${side(
              'bottom',
              o.bb || 'thin'
            )}<diagonal/></border>`
          );
    let nf = 0;
    if (o.fmt) {
      const built: Record<string, number> = {
        '0': 1,
        '0.00': 2,
        '#,##0': 3,
        '#,##0.00': 4,
        '0%': 9,
        '0.00%': 10,
      };
      nf =
        built[o.fmt] ??
        (() => {
          let i = this.fmts.findIndex((f) => f[1] === o.fmt);
          if (i < 0) {
            this.fmts.push([164 + this.fmts.length, o.fmt!]);
            i = this.fmts.length - 1;
          }
          return this.fmts[i][0];
        })();
    }
    const al = `<alignment horizontal="${o.h || 'general'}" vertical="${o.v || 'top'}"${
      o.wrap !== false ? ' wrapText="1"' : ''
    }${o.indent ? ` indent="${o.indent}"` : ''}/>`;
    this.xfs.push(
      `<xf numFmtId="${nf}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`
    );
    return (this.map[k] = this.xfs.length - 1);
  }

  xml(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${
      this.fmts.length
        ? `<numFmts count="${this.fmts.length}">${this.fmts
            .map((f) => `<numFmt numFmtId="${f[0]}" formatCode="${xmlEsc(f[1])}"/>`)
            .join('')}</numFmts>`
        : ''
    }<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts><fills count="${
      this.fills.length
    }">${this.fills.join('')}</fills><borders count="${this.borders.length}">${this.borders.join(
      ''
    )}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${
      this.xfs.length
    }">${this.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

interface SheetOpts {
  tab?: string;
  freeze?: [number, number];
  cols?: number[];
  footer?: string;
  zoom?: number;
  portrait?: boolean;
}

class Sheet {
  wb: Book;
  name: string;
  o: SheetOpts;
  cells: Record<string, { v?: string | number | null; f?: string; s: number }> = {};
  merges: string[] = [];
  hts: Record<number, number> = {};
  maxR = 0;
  maxC = 0;

  constructor(wb: Book, name: string, o: SheetOpts = {}) {
    this.wb = wb;
    this.name = String(name).replace(/[\[\]:*?\/\\]/g, '-').slice(0, 31);
    this.o = o;
  }

  set(r: number, c: number, v: string | number | null, st?: CellStyle): this {
    this.cells[`${r},${c}`] = { v, s: this.wb.st.get(st || {}) };
    this.maxR = Math.max(this.maxR, r);
    this.maxC = Math.max(this.maxC, c);
    return this;
  }

  f(r: number, c: number, formula: string, st?: CellStyle): this {
    this.cells[`${r},${c}`] = { f: String(formula).replace(/^=/, ''), s: this.wb.st.get(st || {}) };
    this.maxR = Math.max(this.maxR, r);
    this.maxC = Math.max(this.maxC, c);
    return this;
  }

  merge(r1: number, c1: number, r2: number, c2: number, v?: string | number | null, st?: CellStyle): this {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (!(r === r1 && c === c1)) this.set(r, c, null, st);
      }
    }
    if (v !== undefined) this.set(r1, c1, v, st);
    this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`);
    return this;
  }

  h(r: number, ht: number): this {
    this.hts[r] = ht;
    return this;
  }

  xml(): string {
    const rows: Record<number, [number, { v?: string | number | null; f?: string; s: number }][]> = {};
    Object.entries(this.cells).forEach(([k, c]) => {
      const [r, cc] = k.split(',').map(Number);
      (rows[r] = rows[r] || []).push([cc, c]);
    });
    const data = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)
      .map(
        (r) =>
          `<row r="${r + 1}"${this.hts[r] ? ` ht="${this.hts[r]}" customHeight="1"` : ''}>${rows[r]
            .sort((a, b) => a[0] - b[0])
            .map(([cc, c]) => {
              const R = ref(r, cc);
              const s = c.s ? ` s="${c.s}"` : '';
              if (c.f != null) return `<c r="${R}"${s}><f>${xmlEsc(c.f)}</f></c>`;
              if (c.v == null || c.v === '') return `<c r="${R}"${s}/>`;
              if (typeof c.v === 'number' && Number.isFinite(c.v))
                return `<c r="${R}"${s}><v>${c.v}</v></c>`;
              return `<c r="${R}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(
                c.v
              )}</t></is></c>`;
            })
            .join('')}</row>`
      )
      .join('');
    const fz = this.o.freeze;
    let pane = '';
    if (fz) {
      const [fr, fc] = fz;
      const act = fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight';
      pane = `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${ref(
        fr,
        fc
      )}" activePane="${act}" state="frozen"/><selection pane="${act}" activeCell="${ref(
        fr,
        fc
      )}" sqref="${ref(fr, fc)}"/>`;
    }
    const cols = (this.o.cols || [])
      .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
      .join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr>${
      this.o.tab ? `<tabColor rgb="${hex(this.o.tab)}"/>` : ''
    }<pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ref(
      this.maxR,
      this.maxC
    )}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"${
      this.wb.sheets[0] === this ? ' tabSelected="1"' : ''
    } zoomScale="${this.o.zoom || 100}">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${
      cols ? `<cols>${cols}</cols>` : ''
    }<sheetData>${data}</sheetData>${
      this.merges.length
        ? `<mergeCells count="${this.merges.length}">${this.merges
            .map((m) => `<mergeCell ref="${m}"/>`)
            .join('')}</mergeCells>`
        : ''
    }<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.25" footer="0.25"/><pageSetup paperSize="9" orientation="${
      this.o.portrait ? 'portrait' : 'landscape'
    }" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>${xmlEsc(
      `&L${this.o.footer || ''}&RPage &P of &N`
    )}</oddFooter></headerFooter></worksheet>`;
  }
}

class Book {
  sheets: Sheet[] = [];
  st = new Styles();
  title = 'e-NFA';

  sheet(name: string, o?: SheetOpts): Sheet {
    const s = new Sheet(this, name, o);
    this.sheets.push(s);
    return s;
  }

  build(): Uint8Array {
    const n = this.sheets.length;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files: { name: string; data: string | Uint8Array }[] = [
      {
        name: '[Content_Types].xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${this.sheets
          .map(
            (_s, i) =>
              `<Override PartName="/xl/worksheets/sheet${
                i + 1
              }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
      },
      {
        name: '_rels/.rels',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
      },
      {
        name: 'docProps/core.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(
          this.title || 'e-NFA'
        )}</dc:title><dc:creator>e-NFA</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
      },
      {
        name: 'docProps/app.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>e-NFA</Application></Properties>`,
      },
      {
        name: 'xl/workbook.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView activeTab="0"/></bookViews><sheets>${this.sheets
          .map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
      },
      {
        name: 'xl/_rels/workbook.xml.rels',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.sheets
          .map(
            (_s, i) =>
              `<Relationship Id="rId${
                i + 1
              }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
                i + 1
              }.xml"/>`
          )
          .join('')}<Relationship Id="rId${
          n + 1
        }" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      },
    ];
    this.sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml() }));
    files.push({ name: 'xl/styles.xml', data: this.st.xml() });
    return zipFiles(files);
  }
}

export function buildQtExcelBytes(
  nfa: NfaRecord,
  ver: NfaVersion,
  mode: 'pre' | 'post',
  doa: DoaBand[]
): { bytes: Uint8Array; filename: string } | { error: string } {
  const d: NfaData = ver.data;
  const Q = qtCore(d, 'q', doa);
  if (!Q.vend.length) {
    return { error: 'Enter vendor quotations (Quotes stage) before downloading the comparison.' };
  }
  const NM = mode === 'post' ? qtCore(d, 'n', doa) : null;
  if (mode === 'post' && (!NM || !NM.vend.length)) {
    return { error: 'Enter negotiated prices on the Negotiation stage first.' };
  }
  const M: QtModel = mode === 'post' && NM ? NM : Q;
  const wb = new Book();
  const base = d.header.cur || 'INR';
  const R = ref;
  const A = (r: number, c: number) => `$${col(c)}$${r + 1}`;
  const RA = (r: number, c: number) => `${col(c)}$${r + 1}`;
  const CA = (r: number, c: number) => `$${col(c)}${r + 1}`;
  const qs = (n: string) => `'${n.replace(/'/g, "''")}'`;

  wb.title = `${mode === 'post' ? 'Negotiation outcome – ' : 'Quoted terms comparison – '}${nfa.no}`;

  const K = {
    dark: '1E293B',
    acc: '0F766E',
    accS: 'E6F4F1',
    lab: 'F3F4F6',
    best: 'DCFCE7',
    bestT: '166534',
    worst: 'FEE2E2',
    worstT: '991B1B',
    flag: 'FEF3C7',
    flagT: '92400E',
    info: 'E0F2FE',
    infoT: '075985',
    inp: 'FFF9DB',
    mut: '6B7280',
    blue: '1D4ED8',
  };
  const X = (...o: CellStyle[]): CellStyle => Object.assign({}, ...o);
  const st: Record<string, CellStyle> = {
    title: { b: 1, sz: 15, color: 'FFFFFF', fill: K.dark, border: false, v: 'center', wrap: false },
    sub: { i: 1, sz: 9, color: 'CBD5E1', fill: K.dark, border: false, v: 'center', wrap: false },
    h: { b: 1, color: 'FFFFFF', fill: K.acc, h: 'center', v: 'center' },
    hl: { b: 1, color: 'FFFFFF', fill: K.acc, v: 'center' },
    vh: { b: 1, color: 'FFFFFF', fill: K.dark, h: 'center', v: 'center' },
    sec: { b: 1, sz: 11, color: K.acc, border: false, wrap: false, bb: 'medium', bbc: K.acc },
    lab: { b: 1, fill: K.lab },
    td: {},
    mut: { i: 1, sz: 9, color: K.mut, border: false },
    n0: { fmt: '#,##0', h: 'right' },
    n2: { fmt: '#,##0.00', h: 'right' },
    n4: { fmt: '0.0000', h: 'right' },
    p1: { fmt: '0.0%', h: 'right' },
    n1: { fmt: '0.0', h: 'right' },
    inp: { fill: K.inp, color: K.blue },
    best: { fill: K.best, color: K.bestT, b: 1 },
    worst: { fill: K.worst, color: K.worstT },
    flag: { fill: K.flag, color: K.flagT },
    info: { fill: K.info, color: K.infoT },
  };
  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const subLine = `${nfa.no} · ${ver.ver} · RFQ ${d.header.rfqNo || '—'} · Base currency ${base} · Generated ${stamp}`;
  const head = (sh: Sheet, n: number, title: string) => {
    sh.merge(0, 0, 0, n - 1, title, st.title).h(0, 30);
    sh.merge(1, 0, 1, n - 1, subLine, st.sub).h(1, 18);
  };
  const fillOf = (ev: { best: number[]; worst: number[]; diff?: boolean }, j: number, flag: boolean) =>
    flag ? st.flag : ev.best.includes(j) ? st.best : ev.worst.includes(j) ? st.worst : ev.diff ? st.info : {};
  const LBL = { q: 'quoted', n: 'negotiated' };

  function priceSheet(Md: QtModel, name: string) {
    const n = Md.vend.length;
    const lc = 5 + 2 * n;
    const sh = wb.sheet(name, {
      tab: '0EA5E9',
      freeze: [8, 3],
      cols: [5, 18, 40, 7, 9, ...Md.vend.flatMap(() => [14, 16]), 16, 24],
      footer: name,
    });
    head(sh, lc + 2, `Item-wise ${LBL[Md.src]} prices – landed comparison (${base})`);
    [
      ['Quote currency'],
      [`FX → ${base}`],
      [`Landing % (freight + P&F + insurance + other, ${LBL[Md.src]} terms)`],
    ].forEach(([l], i) => sh.merge(3 + i, 0, 3 + i, 4, l, st.lab));
    Md.vend.forEach((V, k) => {
      const c0 = 5 + 2 * k;
      sh.merge(3, c0, 3, c0 + 1, V.cur, X(st.td, { h: 'center' }));
      sh.merge(4, c0, 4, c0 + 1, V.fx ?? '', X(st.n4, st.inp, { h: 'center' }));
      sh.merge(5, c0, 5, c0 + 1, V.t.__lf ?? 0, X(st.n2, st.inp, { h: 'center' }));
      sh.merge(6, c0, 6, c0 + 1, V.name, st.vh);
    });
    sh.merge(6, 0, 6, 4, '', st.vh);
    sh.merge(6, lc, 6, lc + 1, 'Lowest landed (L1)', st.vh);
    ['#', 'Item code', 'Description', 'UOM', 'Qty'].forEach((h, i) => sh.set(7, i, h, st.h));
    Md.vend.forEach((V, k) => {
      sh.set(7, 5 + 2 * k, `Rate (${V.cur})`, st.h);
      sh.set(7, 6 + 2 * k, `Landed (${base})`, st.h);
    });
    sh.set(7, lc, 'L1 landed', st.h);
    sh.set(7, lc + 1, 'L1 vendor', st.h);
    sh.h(7, 30);
    const r0 = 8;
    const ni = Md.items.length;
    const rl = r0 + ni - 1;
    Md.items.forEach((it, i) => {
      const r = r0 + i;
      sh.set(r, 0, i + 1, X(st.td, { h: 'center' }));
      sh.set(r, 1, it.code || '');
      sh.set(r, 2, it.desc || '');
      sh.set(r, 3, it.uom || '', X(st.td, { h: 'center' }));
      sh.set(r, 4, it.qty, st.n2);
      Md.vend.forEach((_V, k) => {
        const rc = 5 + 2 * k;
        const x = it.cells[k];
        sh.set(r, rc, x.r ?? '', X(st.n2, { color: K.blue }));
        sh.f(
          r,
          rc + 1,
          `IF(${R(r, rc)}="","",${CA(r, 4)}*${R(r, rc)}*${RA(4, rc)}*(1+${RA(5, rc)}/100))`,
          X(st.n0, it.l1k === k ? st.best : {})
        );
      });
      const amts = Md.vend.map((_V, k) => R(r, 6 + 2 * k)).join(',');
      sh.f(r, lc, `IF(COUNT(${amts})=0,"",MIN(${amts}))`, X(st.n0, st.best));
      sh.set(r, lc + 1, it.l1k == null ? '—' : Md.vend[it.l1k].name, st.best);
    });
    const t = rl + 1;
    const lab = [
      'Total landed value – items quoted',
      'Total basic value (excl. loading)',
      `Items quoted (of ${ni})`,
      'L1 landed value of the same items',
      'Price index (1.000 = L1 on every item quoted)',
      'Gap vs L1',
    ];
    lab.forEach((l, i) => sh.merge(t + i, 0, t + i, 4, l, X(st.lab, i === 4 ? { color: K.acc } : {})));
    const refs = { landed: [] as string[], basic: [] as string[], idx: [] as string[], gap: [] as string[] };
    Md.vend.forEach((_V, k) => {
      const rc = 5 + 2 * k;
      const ac = rc + 1;
      const ar = `${R(r0, ac)}:${R(rl, ac)}`;
      const rr = `${R(r0, rc)}:${R(rl, rc)}`;
      sh.f(t, ac, `SUM(${ar})`, X(st.n0, { b: 1 }));
      sh.f(t + 1, ac, `SUMPRODUCT(${A(r0, 4)}:${A(rl, 4)},${rr})*${RA(4, rc)}`, st.n0);
      sh.f(t + 2, ac, `COUNT(${rr})`, X(st.n0, { h: 'center' }));
      sh.f(t + 3, ac, `SUMPRODUCT((${ar}<>"")*1,${A(r0, lc)}:${A(rl, lc)})`, st.n0);
      sh.f(t + 4, ac, `IF(${R(t, ac)}=0,0,${R(t + 3, ac)}/${R(t, ac)})`, X(st.n4, { b: 1, color: K.acc }));
      sh.f(t + 5, ac, `IF(${R(t + 3, ac)}=0,"",${R(t, ac)}/${R(t + 3, ac)}-1)`, st.p1);
      for (let i = 0; i < 6; i++) sh.set(t + i, rc, '', st.lab);
      refs.landed.push(`${qs(sh.name)}!${A(t, ac)}`);
      refs.basic.push(`${qs(sh.name)}!${A(t + 1, ac)}`);
      refs.idx.push(`${qs(sh.name)}!${A(t + 4, ac)}`);
      refs.gap.push(`${qs(sh.name)}!${A(t + 5, ac)}`);
    });
    sh.set(
      t + 7,
      0,
      'Blue figures and yellow cells come from the quotations and can be edited – landed values, L1 and the price index recalculate. Landed value excludes GST/VAT.',
      st.mut
    );
    sh.merge(t + 7, 0, t + 7, lc + 1);
    return refs;
  }

  function scoreSheet(
    Md: QtModel,
    name: string,
    pr: { idx: string[] }
  ) {
    const n = Md.vend.length;
    const sh = wb.sheet(name, {
      tab: '7C3AED',
      freeze: [6, 3],
      cols: [38, 10, 44, ...Md.vend.map(() => 20)],
      footer: name,
    });
    head(sh, 3 + n, `Commercial scoring – ${LBL[Md.src]} terms (decision aid)`);
    sh.merge(
      3,
      0,
      3,
      2 + n,
      'Change the yellow weights to match your evaluation policy – points, totals and ranks recalculate. Weights should add up to 100.',
      X(st.mut, { wrap: true })
    );
    sh.h(3, 28);
    ['Parameter', 'Weight', 'How points are given'].forEach((h, i) => sh.set(5, i, h, st.h));
    Md.vend.forEach((V, k) => sh.set(5, 3 + k, V.name, st.vh));
    sh.h(5, 32);
    sh.merge(6, 0, 6, 2 + n, 'A. Values taken from the quotations', X(st.lab, { color: K.acc }));
    const rules: Record<string, string> = {
      price: 'L1 price index from the Price sheet (1.000 = lowest landed)',
      del: 'Shortest delivery gets full points; others in proportion',
      adv: 'Lowest advance gets full points; (100 − adv) relative to best',
      warr: 'Longest warranty gets full points; others in proportion',
      valid: 'Longest validity gets full points; others in proportion',
      ld: 'Highest LD cap gets full points; others in proportion',
      pbg: 'Highest PBG % gets full points; others in proportion',
    };
    const paramNames: Record<string, string> = {
      price: 'Price index (item-wise L1 ÷ vendor landed)',
      del: 'Delivery period (days)',
      adv: 'Advance (%)',
      warr: 'Warranty (months)',
      valid: 'Offer validity (days)',
      ld: 'LD cap (%)',
      pbg: 'Performance BG (%)',
    };
    const vr0 = 7;
    const pr0 = vr0 + Md.scores.length + 1;
    Md.scores.forEach((s, i) => {
      const r = vr0 + i;
      sh.set(r, 0, paramNames[s.key] || s.lab, st.lab);
      sh.set(r, 1, '', st.lab);
      sh.set(r, 2, rules[s.key] || '', X(st.td, { sz: 9, color: K.mut }));
      Md.vend.forEach((_V, k) => {
        if (s.key === 'price') sh.f(r, 3 + k, pr.idx[k], X(st.n4));
        else sh.set(r, 3 + k, s.vals[k] ?? '', X(st.n1, st.inp));
      });
    });
    sh.merge(pr0 - 1, 0, pr0 - 1, 2 + n, 'B. Points (out of the weight)', X(st.lab, { color: K.acc }));
    Md.scores.forEach((s, i) => {
      const r = pr0 + i;
      const vr = vr0 + i;
      const w = A(r, 1);
      const rng = `${A(vr, 3)}:${A(vr, 2 + n)}`;
      sh.set(r, 0, s.lab, st.lab);
      sh.set(r, 1, s.w, X(st.n0, st.inp, { h: 'center', b: 1 }));
      sh.set(r, 2, 'Weight × relative performance', X(st.td, { sz: 9, color: K.mut }));
      Md.vend.forEach((_V, k) => {
        const v = R(vr, 3 + k);
        const f =
          s.key === 'price'
            ? `IF(${v}="",0,${w}*${v})`
            : s.key === 'del'
            ? `IF(OR(${v}="",${v}<=0),0,IF(MIN(${rng})<=0,0,${w}*MIN(${rng})/${v}))`
            : s.key === 'adv'
            ? `IF(${v}="",0,IF(MIN(${rng})>=100,0,${w}*(100-${v})/(100-MIN(${rng}))))`
            : `IF(OR(${v}="",MAX(${rng})<=0),0,${w}*${v}/MAX(${rng}))`;
        sh.f(r, 3 + k, f, st.n1);
      });
    });
    const tr = pr0 + Md.scores.length;
    sh.set(tr, 0, 'TOTAL COMMERCIAL SCORE (out of 100)', X(st.hl));
    sh.f(tr, 1, `SUM(${R(pr0, 1)}:${R(tr - 1, 1)})`, X(st.n0, st.hl, { h: 'center' }));
    sh.set(tr, 2, '', st.hl);
    Md.vend.forEach((_V, k) => {
      sh.f(tr, 3 + k, `SUM(${R(pr0, 3 + k)}:${R(tr - 1, 3 + k)})`, X(st.n1, { b: 1, sz: 11, fill: K.accS }));
      sh.f(tr + 1, 3 + k, `RANK(${R(tr, 3 + k)},${A(tr, 3)}:${A(tr, 2 + n)})`, X(st.n0, { h: 'center', b: 1 }));
    });
    sh.set(tr + 1, 0, 'Rank', st.lab);
    sh.set(tr + 1, 1, '', st.lab);
    sh.set(tr + 1, 2, '', st.lab);
    sh.h(tr, 22);
    sh.merge(
      tr + 3,
      0,
      tr + 3,
      2 + n,
      'The score is a commercial decision aid only. The award follows the Comparative Statement after technical evaluation, negotiation and DoA approval.',
      st.mut
    );
    const nm = `${qs(sh.name)}!${A(5, 3)}:${A(5, 2 + n)}`;
    const tot = `${qs(sh.name)}!${A(tr, 3)}:${A(tr, 2 + n)}`;
    return {
      names: nm,
      totals: tot,
      tot: Md.vend.map((_V, k) => `${qs(sh.name)}!${A(tr, 3 + k)}`),
      rank: Md.vend.map((_V, k) => `${qs(sh.name)}!${A(tr + 1, 3 + k)}`),
    };
  }

  function termsSheet(
    Md: QtModel,
    name: string,
    pr: { landed: string[] },
    sc: { tot: string[] }
  ) {
    const n = Md.vend.length;
    const sh = wb.sheet(name, {
      tab: '0F766E',
      freeze: [4, 2],
      cols: [5, 32, ...Md.vend.map(() => 26), 24, 54],
      footer: name,
    });
    head(sh, 4 + n, `Terms & conditions – ${LBL[Md.src]} – vendor comparison`);
    ['#', 'Term / condition', ...Md.vend.map((V) => V.name), 'Best in this RFQ', 'Observation / suggestion'].forEach(
      (h, i) => sh.set(3, i, h, i >= 2 && i < 2 + n ? st.vh : st.h)
    );
    sh.h(3, 32);
    const vb = Md.vend.filter((V) => V.complete).sort((a, b) => a.landed - b.landed);
    const top: [string, ((k: number) => string) | null, 'landed' | 'score' | null][] = [
      ['Items quoted', (k) => `${Md.vend[k].items} of ${Md.items.length}`, null],
      [`Landed value (${base})`, null, 'landed'],
      ['Commercial score (/100)', null, 'score'],
    ];
    top.forEach(([l, fn, kind], i) => {
      const r = 4 + i;
      sh.set(r, 0, '', st.lab);
      sh.set(r, 1, l, X(st.lab, { color: K.acc }));
      Md.vend.forEach((V, k) => {
        const fill =
          kind === 'landed'
            ? vb[0] === V
              ? st.best
              : vb.length > 1 && vb[vb.length - 1] === V
              ? st.worst
              : {}
            : kind === 'score'
            ? V.rank === 1
              ? st.best
              : V.rank === n && n > 1
              ? st.worst
              : {}
            : !V.complete
            ? st.flag
            : {};
        if (kind === 'landed') sh.f(r, 2 + k, pr.landed[k], X(st.n0, fill, { b: 1 }));
        else if (kind === 'score') sh.f(r, 2 + k, sc.tot[k], X(st.n1, fill, { b: 1 }));
        else sh.set(r, 2 + k, fn ? fn(k) : '', X(fill, { h: 'center' }));
      });
      sh.set(
        r,
        2 + n,
        kind === 'landed' ? vb[0]?.name || '—' : kind === 'score' ? Md.best?.name || '—' : '',
        X(st.td, { b: 1 })
      );
      sh.set(
        r,
        3 + n,
        kind === 'landed'
          ? 'Lowest landed value among vendors who quoted every item (excl. GST)'
          : kind === 'score'
          ? 'Weighted score – see Scoring sheet'
          : '',
        X(st.td, { sz: 9 })
      );
    });
    Md.rows.forEach((row, i) => {
      const r = 7 + i;
      const flags: string[] = [];
      sh.set(r, 0, i + 1, X(st.td, { h: 'center' }));
      sh.set(r, 1, row.lab + (row.k === 'LF' ? ' (calculated)' : ''), st.lab);
      Md.vend.forEach((V, k) => {
        const fl = qtFlagOf(row.k, V.t, M.band);
        if (fl) flags.push(V.name);
        const v = qtDisp(row.k, V.t);
        sh.set(
          r,
          2 + k,
          v === '' ? 'not stated' : v,
          X(fillOf(row.ev, V.j, fl), v === '' ? { i: 1, color: K.mut } : {})
        );
      });
      const bestN = row.ev.diff
        ? 'Differs – compare'
        : row.ev.equal
        ? Md.vend.some((V) => qtHas(V.t[row.k]) || row.k === 'LF')
          ? 'Equal for all'
          : '—'
        : row.ev.best.map((j) => Md.vend.find((V) => V.j === j)!.name).join(', ');
      sh.set(r, 2 + n, bestN, X(row.ev.best.length && !row.ev.equal ? st.best : {}));
      sh.set(
        r,
        3 + n,
        [row.ev.note, flags.length ? `⚠ Review: ${flags.join(', ')}` : ''].filter(Boolean).join(' · '),
        X(st.td, { sz: 9 })
      );
    });
    const lg = 7 + Md.rows.length + 1;
    sh.set(lg, 1, 'Legend', X(st.lab));
    (
      [
        ['Best in this RFQ', st.best],
        ['Weakest in this RFQ', st.worst],
        ['Risk – review before award', st.flag],
        ['Differs – verify (e.g. GST rate)', st.info],
      ] as [string, CellStyle][]
    ).forEach(([t, s], i) => sh.set(lg + 1 + i, 1, t, s));
    return sh;
  }

  function pointsSheet() {
    const P = qtPoints(Q);
    const sh = wb.sheet('Negotiation Points', {
      tab: 'D97706',
      freeze: [4, 0],
      cols: [5, 26, 24, 34, 30, 44, 10, 34, 18, 14],
      footer: 'Negotiation points',
    });
    head(sh, 10, 'Negotiation points – what to ask each vendor');
    [
      '#',
      'Vendor',
      'Topic',
      "Vendor's quoted position",
      'Best offer in this RFQ',
      'Suggested ask',
      'Priority',
      'Agreed outcome (fill in)',
      'Owner',
      'Target date',
    ].forEach((h, i) => sh.set(3, i, h, st.h));
    sh.h(3, 30);
    let r = 4;
    let no = 0;
    let last = '';
    const pf: Record<string, CellStyle> = { High: st.worst, Medium: st.flag, Low: st.best };
    P.forEach((p) => {
      if (p.v !== last) {
        sh.merge(r, 0, r, 9, p.v, X(st.vh, { h: 'left', indent: 1 }));
        sh.h(r, 20);
        r++;
        last = p.v;
      }
      sh.set(r, 0, ++no, X(st.td, { h: 'center' }));
      sh.set(r, 1, p.v, { sz: 9, color: K.mut });
      sh.set(r, 2, p.topic, { b: 1 });
      sh.set(r, 3, p.cur);
      sh.set(r, 4, p.best);
      sh.set(r, 5, p.ask);
      sh.set(r, 6, p.pri, X(pf[p.pri] || {}, { h: 'center', b: 1 }));
      sh.set(r, 7, '', st.inp);
      sh.set(r, 8, '', st.inp);
      sh.set(r, 9, '', st.inp);
      r++;
    });
    if (!P.length) sh.merge(4, 0, 4, 9, 'No gaps found – all vendors equal on the compared terms.', st.mut);
    sh.merge(
      r + 1,
      0,
      r + 1,
      9,
      'Use this sheet in vendor meetings and with team leads. Record the agreed outcome, then update the Negotiation & Terms stage in e-NFA.',
      st.mut
    );
  }

  function qvnSheet() {
    const n = Q.vend.length;
    const sh = wb.sheet('Quoted vs Negotiated', {
      tab: '16A34A',
      freeze: [0, 3],
      cols: [5, 36, 9, ...Q.vend.flatMap(() => [18, 18, 13])],
      footer: 'Quoted vs negotiated',
    });
    head(sh, 3 + 3 * n, 'Quoted vs negotiated – prices and terms');
    const nv = (j: number) => NM!.vend.find((V) => V.j === j);
    let r = 3;
    sh.merge(r, 0, r, 2 + 3 * n, `A. Price outcome by vendor (${base}, landed, excl. GST)`, st.sec);
    r++;
    [
      '#',
      'Vendor',
      'Items',
      'Quoted landed',
      'Negotiated landed',
      'Saving',
      'Saving %',
      'Terms improved',
      'Terms worsened',
    ].forEach((h, i) => sh.set(r, i, h, st.h));
    sh.h(r, 30);
    r++;
    const sumRow = r;
    Q.vend.forEach((V, k) => {
      const N2 = nv(V.j);
      const imp = TERMS.filter(([kk]) => qtChange(kk, V.qt, V.nt) === 'better').length;
      const wor = TERMS.filter(([kk]) => qtChange(kk, V.qt, V.nt) === 'worse').length;
      sh.set(r, 0, k + 1, X(st.td, { h: 'center' }));
      sh.set(r, 1, V.name, { b: 1 });
      sh.set(r, 2, `${N2 ? N2.items : 0} / ${V.items}`, X(st.td, { h: 'center' }));
      if (N2) {
        sh.set(
          r,
          3,
          Q.items.reduce(
            (s, it) =>
              s +
              (it.cells[k].landed != null && NM!.items[it.i].cells[NM!.vend.indexOf(N2)].landed != null
                ? (it.cells[k].landed as number)
                : 0),
            0
          ),
          st.n0
        );
        sh.set(r, 4, N2.landed, X(st.n0, { b: 1 }));
        sh.f(r, 5, `${R(r, 3)}-${R(r, 4)}`, X(st.n0, { color: K.bestT, b: 1 }));
        sh.f(r, 6, `IF(${R(r, 3)}=0,"",${R(r, 5)}/${R(r, 3)})`, X(st.p1, { color: K.bestT, b: 1 }));
      } else {
        sh.set(r, 3, V.landed, st.n0);
        sh.merge(r, 4, r, 6, 'Not negotiated (not technically accepted)', X(st.flag, { i: 1 }));
      }
      sh.set(r, 7, imp, X(st.n0, { h: 'center' }, imp ? st.best : {}));
      sh.set(r, 8, wor, X(st.n0, { h: 'center' }, wor ? st.worst : {}));
      r++;
    });
    sh.set(r, 1, 'TOTAL (negotiated vendors)', st.lab);
    sh.f(
      r,
      3,
      `SUMPRODUCT((${R(sumRow, 4)}:${R(r - 1, 4)}<>"")*1,${R(sumRow, 3)}:${R(r - 1, 3)})`,
      X(st.n0, st.lab)
    );
    sh.f(r, 4, `SUM(${R(sumRow, 4)}:${R(r - 1, 4)})`, X(st.n0, st.lab));
    sh.f(r, 5, `${R(r, 3)}-${R(r, 4)}`, X(st.n0, st.lab, { color: K.bestT }));
    sh.f(r, 6, `IF(${R(r, 3)}=0,"",${R(r, 5)}/${R(r, 3)})`, X(st.p1, st.lab, { color: K.bestT }));
    r += 2;
    sh.merge(r, 0, r, 2 + 3 * n, 'B. Item-wise rates (quote currency) – quoted vs negotiated', st.sec);
    r++;
    sh.set(r, 0, '', st.vh);
    sh.set(r, 1, '', st.vh);
    sh.set(r, 2, '', st.vh);
    Q.vend.forEach((V, k) => sh.merge(r, 3 + 3 * k, r, 5 + 3 * k, `${V.name} (${V.cur})`, st.vh));
    r++;
    ['#', 'Item', 'Qty'].forEach((h, i) => sh.set(r, i, h, st.h));
    Q.vend.forEach((_V, k) => {
      sh.set(r, 3 + 3 * k, 'Quoted', st.h);
      sh.set(r, 4 + 3 * k, 'Negotiated', st.h);
      sh.set(r, 5 + 3 * k, 'Change', st.h);
    });
    r++;
    Q.items.forEach((it, i) => {
      sh.set(r, 0, i + 1, X(st.td, { h: 'center' }));
      sh.set(r, 1, (it.code ? `${it.code} – ` : '') + (it.desc || ''), { sz: 9 });
      sh.set(r, 2, it.qty, st.n2);
      Q.vend.forEach((V, k) => {
        const q = num(d.items[i].r?.[V.j]?.q);
        const nn = num(d.items[i].r?.[V.j]?.n);
        sh.set(r, 3 + 3 * k, q ?? '', st.n2);
        sh.set(r, 4 + 3 * k, nn ?? '', X(st.n2, { b: 1 }));
        const ch = q && nn != null ? nn / q - 1 : null;
        sh.f(
          r,
          5 + 3 * k,
          `IF(OR(${R(r, 3 + 3 * k)}="",${R(r, 4 + 3 * k)}=""),"",${R(r, 4 + 3 * k)}/${R(
            r,
            3 + 3 * k
          )}-1)`,
          X(st.p1, ch == null ? {} : ch < 0 ? st.best : ch > 0 ? st.worst : {})
        );
      });
      r++;
    });
    r++;
    sh.merge(r, 0, r, 2 + 3 * n, 'C. Terms & conditions – quoted vs negotiated', st.sec);
    r++;
    sh.set(r, 0, '', st.vh);
    sh.set(r, 1, '', st.vh);
    sh.set(r, 2, '', st.vh);
    Q.vend.forEach((V, k) => sh.merge(r, 3 + 3 * k, r, 5 + 3 * k, V.name, st.vh));
    r++;
    ['#', 'Term / condition', ''].forEach((h, i) => sh.set(r, i, h, st.h));
    Q.vend.forEach((_V, k) => {
      sh.set(r, 3 + 3 * k, 'Quoted', st.h);
      sh.set(r, 4 + 3 * k, 'Negotiated', st.h);
      sh.set(r, 5 + 3 * k, 'Outcome', st.h);
    });
    r++;
    const cs: Record<string, CellStyle> = {
      same: { color: K.mut },
      better: st.best,
      worse: st.worst,
      changed: st.flag,
      added: st.info,
    };
    const chMap: Record<string, string> = {
      same: 'Unchanged',
      better: 'Improved',
      worse: 'Worsened',
      changed: 'Changed',
      added: 'Added',
    };
    TERMS.forEach(([k, lab], i) => {
      sh.set(r, 0, i + 1, X(st.td, { h: 'center' }));
      sh.merge(r, 1, r, 2, lab, st.lab);
      Q.vend.forEach((V, kk) => {
        const ch = qtChange(k, V.qt, V.nt);
        sh.set(r, 3 + 3 * kk, qtDisp(k, V.qt) || '—', { sz: 9 });
        sh.set(r, 4 + 3 * kk, qtDisp(k, V.nt) || '—', X({ sz: 9 }, ch !== 'same' ? { b: 1 } : {}));
        sh.set(r, 5 + 3 * kk, chMap[ch] || ch, X(cs[ch] || {}, { h: 'center', sz: 9 }));
      });
      r++;
    });
    sh.merge(
      r + 1,
      0,
      r + 1,
      2 + 3 * n,
      'Green = improved for the buyer · Red = worsened · Amber = changed (judge manually) · Saving = quoted landed − negotiated landed on items negotiated.',
      st.mut
    );
  }

  function summary(
    pr: { landed: string[]; gap: string[] },
    sc: { names: string; totals: string; tot: string[]; rank: string[] }
  ) {
    const sh = wb.sheet('Summary', {
      tab: '1E293B',
      cols: [26, 24, 12, 16, 16, 12, 10, 14, 10, 12, 48],
      portrait: false,
      footer: 'Summary',
    });
    const W = 11;
    head(
      sh,
      W,
      mode === 'post'
        ? 'Negotiation outcome – quoted vs negotiated'
        : 'Quoted terms & price comparison – before negotiation'
    );
    const pj = d.project;
    const h = d.header;
    const info: [string, string][] = [
      ['Project', pj.name || h.desc || ''],
      ['NFA / version', `${nfa.no} · ${ver.ver}`],
      ['RFQ no. / date', `${h.rfqNo || '—'} / ${h.rfqDate || '—'}`],
      ['PR reference(s)', h.prNo || '—'],
      ['Base currency', base],
      ['Buyer', h.buyer || pj.buyer || '—'],
      ['Vendors compared', Q.vend.map((V) => V.name).join(', ')],
    ];
    info.forEach(([a, b], i) => {
      sh.set(3 + i, 0, a, st.lab);
      sh.merge(3 + i, 1, 3 + i, W - 1, b, st.td);
    });
    let r = 3 + info.length + 1;
    sh.merge(r, 0, r, W - 1, '', X(st.best, { sz: 12, v: 'center' }));
    sh.f(
      r,
      0,
      `"Suggested vendor (highest commercial score, ${LBL[M.src]} terms): "&INDEX(${sc.names},MATCH(MAX(${sc.totals}),${sc.totals},0))&"  ·  "&TEXT(MAX(${sc.totals}),"0.0")&" / 100"`,
      X(st.best, { sz: 12, v: 'center' })
    );
    sh.h(r, 26);
    r++;
    const vb = M.vend.filter((V) => V.complete).sort((a, b) => a.landed - b.landed);
    sh.merge(
      r,
      0,
      r,
      W - 1,
      vb.length
        ? `Lowest landed value (vendors who quoted every item): ${vb[0].name} – ${base} ${fmt(
            vb[0].landed,
            0,
            base
          )}${
            vb[1]
              ? `  ·  next: ${vb[1].name} (+${((vb[1].landed / vb[0].landed - 1) * 100).toFixed(1)}%)`
              : ''
          }`
        : 'No vendor has quoted every item – compare on the Price sheet',
      X(st.td, { b: 1 })
    );
    r++;
    if (mode === 'post') {
      const aw = Q.c.split.filter((s) => s.val > 0);
      sh.merge(
        r,
        0,
        r,
        W - 1,
        aw.length
          ? `Current award per Comparative Statement: ${aw
              .map((s) => `${s.name} ${base} ${fmt(s.val, 0, base)}`)
              .join('; ')}`
          : 'Award not yet selected in the Comparative Statement',
        X(st.td)
      );
      r++;
    }
    sh.merge(
      r,
      0,
      r,
      W - 1,
      'Decision aid only – the award is made in the Comparative Statement after technical evaluation, negotiation and approval as per DoA.',
      st.mut
    );
    r += 2;
    const hd =
      mode === 'post'
        ? [
            'Vendor',
            'Quote ref',
            'Items (neg / quoted)',
            'Quoted landed',
            'Negotiated landed',
            'Saving %',
            'Score (quoted)',
            'Score (negotiated)',
            'Rank',
            'Best on # terms',
            'Risks / remarks',
          ]
        : [
            'Vendor',
            'Quote ref',
            'Items quoted',
            'Landed value',
            'Gap vs L1',
            'Price rank',
            'Score /100',
            'Overall rank',
            'Currency',
            'Best on # terms',
            'Risks / remarks',
          ];
    hd.forEach((x, i) => sh.set(r, i, x, st.h));
    sh.h(r, 30);
    r++;
    Q.vend.forEach((V, k) => {
      const mk = M.vend.findIndex((x) => x.j === V.j);
      const MV = M.vend[mk];
      sh.set(r, 0, V.name, { b: 1 });
      sh.set(r, 1, V.ref || '—');
      if (mode === 'post') {
        sh.set(r, 2, `${MV ? MV.items : 0} / ${V.items}`, X(st.td, { h: 'center' }));
        sh.set(r, 3, V.landed, st.n0);
        if (MV) {
          sh.f(r, 4, pr.landed[mk], X(st.n0, { b: 1 }));
          sh.f(r, 5, `IF(${R(r, 3)}=0,"",1-${R(r, 4)}/${R(r, 3)})`, X(st.p1, { color: K.bestT }));
        } else {
          sh.set(r, 4, '—', X(st.td, { h: 'center' }));
          sh.set(r, 5, '', st.td);
        }
        sh.set(r, 6, V.score, st.n1);
        if (MV) {
          sh.f(r, 7, sc.tot[mk], X(st.n1, { b: 1 }, MV.rank === 1 ? st.best : {}));
          sh.f(r, 8, sc.rank[mk], X(st.n0, { h: 'center' }));
        } else {
          sh.set(r, 7, '—', X(st.td, { h: 'center' }));
          sh.set(r, 8, '', st.td);
        }
        sh.set(r, 9, MV ? MV.bestCount : 0, X(st.n0, { h: 'center' }));
        sh.set(
          r,
          10,
          (MV ? MV.flags : ['Not technically accepted / no negotiated price']).join('; ') || '—',
          X({ sz: 9 }, MV && MV.flags.length ? st.flag : {})
        );
      } else {
        sh.set(r, 2, `${V.items} of ${Q.items.length}`, X(st.td, { h: 'center' }, V.complete ? {} : st.flag));
        sh.f(r, 3, pr.landed[k], X(st.n0, { b: 1 }, vb[0] === V ? st.best : {}));
        sh.f(r, 4, pr.gap[k], st.p1);
        sh.set(r, 5, V.priceRank ?? 'partial', X(st.td, { h: 'center' }));
        sh.f(r, 6, sc.tot[k], X(st.n1, { b: 1 }, V.rank === 1 ? st.best : {}));
        sh.f(r, 7, sc.rank[k], X(st.n0, { h: 'center' }));
        sh.set(r, 8, V.cur + (V.cur !== base ? ` @ ${V.fx}` : ''), X(st.td, { h: 'center' }));
        sh.set(r, 9, V.bestCount, X(st.n0, { h: 'center' }));
        sh.set(r, 10, V.flags.join('; ') || '—', X({ sz: 9 }, V.flags.length ? st.flag : {}));
      }
      r++;
    });
    r++;
    sh.merge(r, 0, r, W - 1, 'Workbook guide', st.sec);
    r++;
    (mode === 'post'
      ? [
          ['Quoted vs Negotiated', 'Price saving per vendor, item-wise rate changes and every term – improved / worsened'],
          ['Terms – Negotiated', 'Final terms compared across vendors (best / weakest / risks)'],
          ['Price – Negotiated', 'Item-wise negotiated prices, landed values and L1'],
          ['Scoring – Negotiated', 'Weighted commercial score on final terms (editable weights)'],
        ]
      : [
          ['Terms Comparison', 'Every quoted term side by side – green best, red weakest, amber risk, blue differs'],
          ['Price Comparison', 'Item-wise quoted rates, landed values (with quoted loadings) and L1'],
          ['Scoring', 'Weighted commercial score – change the yellow weights to suit'],
          ['Negotiation Points', 'What to ask each vendor, with priority and space to record the agreed outcome'],
        ]
    ).forEach(([a, b]) => {
      sh.set(r, 0, a, X(st.lab, { color: K.acc }));
      sh.merge(r, 1, r, W - 1, b);
      r++;
    });
    return sh;
  }

  const pr = priceSheet(M, mode === 'post' ? 'Price – Negotiated' : 'Price Comparison');
  const sc = scoreSheet(M, mode === 'post' ? 'Scoring – Negotiated' : 'Scoring', pr);
  termsSheet(M, mode === 'post' ? 'Terms – Negotiated' : 'Terms Comparison', pr, sc);
  if (mode === 'post') qvnSheet();
  else pointsSheet();
  summary(pr, sc);

  const ord =
    mode === 'post'
      ? ['Summary', 'Quoted vs Negotiated', 'Terms – Negotiated', 'Price – Negotiated', 'Scoring – Negotiated']
      : ['Summary', 'Terms Comparison', 'Price Comparison', 'Scoring', 'Negotiation Points'];
  wb.sheets = ord.map((nm) => wb.sheets.find((s) => s.name === nm)).filter(Boolean) as Sheet[];
  const bytes = wb.build();
  const filename = `${mode === 'post' ? 'Negotiation_Outcome_' : 'Quoted_Terms_Comparison_'}${`${nfa.no}_${ver.ver}`.replace(
    /[^\w.-]+/g,
    '_'
  )}.xlsx`;
  return { bytes, filename };
}

export const calcLive = (d: NfaData, doa: DoaBand[]) => calc(d, doa);
