import { deflateRawSync } from "zlib";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dateSerial(d: Date): number {
  const ms = d.getTime();
  const epoch = Date.UTC(1899, 11, 30);
  let serial = Math.floor((ms - epoch) / 8_640_000);
  if (serial >= 60) serial += 1; // Excel leap-year bug
  return serial;
}

type Cell = { r: number; c: number; t: "s" | "n" | "str"; v: string | number; s?: number };

function buildSharedStrings(items: string[]): { xml: string; map: Record<string, number> } {
  const map: Record<string, number> = {};
  const si = items.map((s) => {
    if (!(s in map)) map[s] = Object.keys(map).length;
    const idx = map[s];
    return `<si><t>${esc(s)}</t></si>`;
  });
  return { xml: si.join(""), map };
}

function sheetXml(opts: {
  cells: Cell[];
  sharedMap: Record<string, number>;
  cols?: { w: number }[];
  freezeRow?: number;
  autoFilter?: string;
}): string {
  const maxR = Math.max(1, ...opts.cells.map((c) => c.r)) + 1;
  const maxC = Math.max(1, ...opts.cells.map((c) => c.c)) + 1;

  let colsXml = "";
  if (opts.cols) {
    colsXml = "<cols>" + opts.cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" customWidth="1" width="${c.w}"/>`).join("") + "</cols>";
  }

  const rows: Cell[][] = [];
  for (const cell of opts.cells) {
    if (!rows[cell.r]) rows[cell.r] = [];
    rows[cell.r].push(cell);
  }

  let rowXml = "";
  for (const r of rows) {
    if (!r) continue;
    rowXml += `<row r="${r[0].r + 1}">`;
    for (const cell of r) {
      const ref = String.fromCharCode(65 + cell.c) + (cell.r + 1);
      const sAttr = cell.s != null ? ` s="${cell.s}"` : "";
      if (cell.t === "s") {
        const idx = opts.sharedMap[cell.v as string] ?? 0;
        rowXml += `<c r="${ref}" t="s"${sAttr}><v>${idx}</v></c>`;
      } else {
        rowXml += `<c r="${ref}"${sAttr}><v>${cell.v}</v></c>`;
      }
    }
    rowXml += "</row>";
  }

  const freezeXml = opts.freezeRow
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${opts.freezeRow}" topLeftCell="A${opts.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  const afXml = opts.autoFilter ? `<autoFilter ref="${opts.autoFilter}"/>` : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${freezeXml}
<sheetFormatPr defaultRowHeight="15"/>
${colsXml}
<sheetData>${rowXml}</sheetData>
${afXml}
</worksheet>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
  <numFmt numFmtId="164" formatCode="₹#,##0.00"/>
  <numFmt numFmtId="165" formatCode="0.00%"/>
  <numFmt numFmtId="166" formatCode="d-mmm-yyyy"/>
</numFmts>
<fonts count="3">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="14"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
  <fill><patternFill patternType="none"/></fill>
  <fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF2E4057"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
</fills>
<borders count="2">
  <border><left/><right/><top/><bottom/><diagonal/></border>
  <border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: { name: string; content: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: { name: Buffer; offset: number; compressed: Buffer; crc: number; uncompressed: number }[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name);
    const compressed = deflateRawSync(file.content);
    const crc = crc32(file.content);

    // Local file header
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // mod time/date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.content.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 28);

    parts.push(local, compressed);
    central.push({ name: nameBuf, offset, compressed, crc, uncompressed: file.content.length });
    offset += local.length + compressed.length;
  }

  const centralStart = offset;
  for (const c of central) {
    const entry = Buffer.alloc(46 + c.name.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0, 8); // flags
    entry.writeUInt16LE(8, 10); // deflate
    entry.writeUInt32LE(0, 12); // mod time/date
    entry.writeUInt32LE(c.crc, 16);
    entry.writeUInt32LE(c.compressed.length, 20);
    entry.writeUInt32LE(c.uncompressed, 24);
    entry.writeUInt16LE(c.name.length, 28);
    entry.writeUInt16LE(0, 30); // extra field length
    entry.writeUInt16LE(0, 32); // comment length
    entry.writeUInt16LE(0, 34); // disk
    entry.writeUInt16LE(0, 36); // internal attr
    entry.writeUInt32LE(0, 38); // external attr
    entry.writeUInt32LE(c.offset, 42);
    c.name.copy(entry, 46);

    parts.push(entry);
    offset += entry.length;
  }

  const centralEnd = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(centralEnd - centralStart, 12);
  eocd.writeUInt32LE(centralStart, 16);
  parts.push(eocd);

  return Buffer.concat(parts);
}

export interface ProductRow {
  index: number;
  name: string;
  category: string;
  sku: string;
  barcode: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  gstPercent: number;
  minStock: number;
  stock: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archivedBy?: string;
}

export function generateProductXlsx(
  products: ProductRow[],
  summary: { storeName: string; date: string; total: number; active: number; low: number; out: number },
  opts: { archived?: boolean } = {},
): Buffer {
  const headers = opts.archived
    ? ["Sr. No.", "Product Name", "Category", "SKU", "Barcode", "Unit", "Purchase Price", "Selling Price", "GST %", "Stock", "Low Stock", "Status", "Archived Date", "Archived By", "Created", "Updated"]
    : ["Sr. No.", "Product Name", "Category", "SKU", "Barcode", "Unit", "Purchase Price", "Selling Price", "GST %", "Stock", "Low Stock Threshold", "Status", "Created Date", "Updated Date"];

  const strSet = new Set<string>();
  for (const h of headers) strSet.add(h);
  for (const p of products) {
    strSet.add(p.name);
    strSet.add(p.category || "-");
    strSet.add(p.sku || "-");
    strSet.add(p.barcode || "-");
    strSet.add(p.unit);
    strSet.add(p.status);
    if (p.archivedBy) strSet.add(p.archivedBy);
  }
  strSet.add(summary.storeName);
  strSet.add(summary.date);
  ["Store Name", "Generated", "Total Products", "Active Products", "Low Stock", "Out of Stock", "Products Summary"].forEach((s) => strSet.add(s));

  const ssArr = Array.from(strSet);
  const { xml: ssXml, map: ssMap } = buildSharedStrings(ssArr);

  const numHeaders = headers.length;
  const s = (t: string) => ({ t: "s" as const, v: t });
  const n = (v: number) => ({ t: "n" as const, v });
  const d = (iso: string) => ({ t: "n" as const, v: dateSerial(new Date(iso)), s: 3 });
  const price = (v: number) => ({ t: "n" as const, v, s: 2 });

  const cells: Cell[] = [];

  // Header row
  for (let c = 0; c < numHeaders; c++) cells.push({ r: 0, c, ...s(headers[c]), s: 1 });

  // Data rows
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const r = i + 1;
    cells.push({ r, c: 0, ...n(p.index) });
    cells.push({ r, c: 1, ...s(p.name) });
    cells.push({ r, c: 2, ...s(p.category || "-") });
    cells.push({ r, c: 3, ...s(p.sku || "-") });
    cells.push({ r, c: 4, ...s(p.barcode || "-") });
    cells.push({ r, c: 5, ...s(p.unit) });
    cells.push({ r, c: 6, ...price(p.purchasePrice) });
    cells.push({ r, c: 7, ...price(p.sellingPrice) });
    cells.push({ r, c: 8, ...n(p.gstPercent) });
    cells.push({ r, c: 9, ...n(p.stock) });
    cells.push({ r, c: 10, ...n(p.minStock) });
    cells.push({ r, c: 11, ...s(p.status) });
    if (opts.archived) {
      cells.push({ r, c: 12, ...(p.archivedAt ? d(p.archivedAt) : s("-")) });
      cells.push({ r, c: 13, ...s(p.archivedBy || "-") });
      cells.push({ r, c: 14, ...d(p.createdAt) });
      cells.push({ r, c: 15, ...d(p.updatedAt) });
    } else {
      cells.push({ r, c: 12, ...d(p.createdAt) });
      cells.push({ r, c: 13, ...d(p.updatedAt) });
    }
  }

  const sheet1 = sheetXml({
    cells,
    sharedMap: ssMap,
    cols: [8, 32, 18, 14, 16, 8, 16, 16, 10, 10, 14, 14, 14, 14].map((w) => ({ w })),
    freezeRow: 1,
    autoFilter: `A1:${String.fromCharCode(64 + numHeaders)}${products.length + 1}`,
  });

  // Summary sheet
  const sc: Cell[] = [];
  const addLabel = (r: number, label: string, value: string | number, isNum = false) => {
    sc.push({ r, c: 0, ...s(label), s: 5 });
    sc.push({ r, c: 1, ...(isNum ? n(value as number) : s(String(value))) });
  };
  addLabel(0, "Products Summary", "", false);
  sc.push({ r: 0, c: 1, ...s("") });
  addLabel(2, "Store Name", summary.storeName);
  addLabel(3, "Generated", summary.date);
  addLabel(5, "Total Products", summary.total, true);
  addLabel(6, "Active Products", summary.active, true);
  addLabel(7, "Low Stock", summary.low, true);
  addLabel(8, "Out of Stock", summary.out, true);

  const sheet2 = sheetXml({
    cells: sc,
    sharedMap: ssMap,
    cols: [20, 30].map((w) => ({ w })),
  });

  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Products" sheetId="1" r:id="rId1"/>
    <sheet name="Summary" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return buildZip([
    { name: "[Content_Types].xml", content: Buffer.from(contentTypes) },
    { name: "_rels/.rels", content: Buffer.from(pkgRels) },
    { name: "xl/workbook.xml", content: Buffer.from(wbXml) },
    { name: "xl/_rels/workbook.xml.rels", content: Buffer.from(relsXml) },
    { name: "xl/styles.xml", content: Buffer.from(stylesXml()) },
    { name: "xl/sharedStrings.xml", content: Buffer.from(`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ssArr.length}" uniqueCount="${ssArr.length}">${ssXml}</sst>`) },
    { name: "xl/worksheets/sheet1.xml", content: Buffer.from(sheet1) },
    { name: "xl/worksheets/sheet2.xml", content: Buffer.from(sheet2) },
  ]);
}

export function generateTemplateXlsx(headers: string[], example: string[]): Buffer {
  const strSet = new Set<string>();
  for (const h of headers) strSet.add(h);
  for (const e of example) strSet.add(e);
  strSet.add("Products Template");
  strSet.add("Fill one product per row starting from row 3. Row 2 is an example - delete it before uploading.");
  const ssArr = Array.from(strSet);
  const { xml: ssXml, map: ssMap } = buildSharedStrings(ssArr);

  const cells: Cell[] = [];
  for (let c = 0; c < headers.length; c++) cells.push({ r: 0, c, t: "s", v: headers[c], s: 1 }); // header
  for (let c = 0; c < headers.length; c++) {
    const v = example[c] ?? "";
    const num = /^-?\d+(\.\d+)?$/.test(v);
    cells.push({ r: 1, c, ...(num ? { t: "n" as const, v: parseFloat(v), s: 4 } : { t: "s" as const, v }) });
  }
  cells.push({ r: 3, c: 0, t: "s", v: "Instructions", s: 5 });
  const instr = "Fill one product per row starting from row 3. Row 2 is an example - delete it before uploading.";
  cells.push({ r: 4, c: 0, t: "s", v: instr });

  const sheetXmlStr = sheetXml({
    cells,
    sharedMap: ssMap,
    cols: headers.map(() => ({ w: 18 })),
    freezeRow: 1,
    autoFilter: `A1:${String.fromCharCode(64 + headers.length)}${headers.length}`,
  });

  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const pkgRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return buildZip([
    { name: "[Content_Types].xml", content: Buffer.from(contentTypes) },
    { name: "_rels/.rels", content: Buffer.from(pkgRels) },
    { name: "xl/workbook.xml", content: Buffer.from(wbXml) },
    { name: "xl/_rels/workbook.xml.rels", content: Buffer.from(relsXml) },
    { name: "xl/styles.xml", content: Buffer.from(stylesXml()) },
    { name: "xl/sharedStrings.xml", content: Buffer.from(`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${ssArr.length}" uniqueCount="${ssArr.length}">${ssXml}</sst>`) },
    { name: "xl/worksheets/sheet1.xml", content: Buffer.from(sheetXmlStr) },
  ]);
}
