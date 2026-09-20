/* Minimal OLE2 + BIFF8 (.xls) parser for inspecting LCSC statement files.
 * Usage: node scripts/inspect-xls.mjs <file.xls>
 * Prints each sheet's name, dimensions and the first N rows as a grid.
 */

import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/inspect-xls.mjs <file.xls>");
  process.exit(1);
}
const b = fs.readFileSync(file);

// ---------------- OLE2 (Compound File Binary) ----------------
const sectorSize = 1 << b.readUInt16LE(30); // stored as log2, e.g. 9 -> 512
const miniSectorSize = 1 << (b.readUInt16LE(32) || 6); // usually 64
const miniStreamCutoff = b.readUInt32LE(56);
const firstMiniFatSector = b.readUInt32LE(60);
const numMiniFatSectors = b.readUInt32LE(64);
const firstDirSector = b.readUInt32LE(48);

// Build the FAT from the DIFAT (109 entries + chained DIFAT sectors)
const difat = [];
for (let i = 0; i < 109; i++) difat.push(b.readUInt32LE(76 + i * 4));
let nextDifat = b.readUInt32LE(68);
let guard = 0;
while (nextDifat !== 0xfffffffe && nextDifat !== 0xffffffff && guard++ < 1000) {
  const off = (nextDifat + 1) * sectorSize;
  for (let i = 0; i < sectorSize / 4 - 1; i++) difat.push(b.readUInt32LE(off + i * 4));
  nextDifat = b.readUInt32LE(off + sectorSize - 4);
}
const fat = [];
for (const sec of difat) {
  if (sec === 0xfffffffe || sec === 0xffffffff) break;
  const off = (sec + 1) * sectorSize;
  for (let i = 0; i < sectorSize / 4; i++) fat.push(b.readUInt32LE(off + i * 4));
}

console.error(`[debug] sectorSize=${sectorSize} miniCutoff=${miniStreamCutoff} numFat=${b.readUInt32LE(44)} firstDir=${firstDirSector} firstMiniFat=${firstMiniFatSector} numMiniFat=${numMiniFatSectors} fat.length=${fat.length}`);

function safeNext(cur, table) {
  if (cur === undefined || cur === null || !Number.isInteger(cur)) return 0xfffffffe;
  return table[cur] ?? 0xfffffffe;
}

function readChain(start, count, fatTable, chunkSize) {
  const chunks = [];
  let cur = start;
  let g = 0;
  while (cur !== 0xfffffffe && cur !== 0xffffffff && g++ < 100000) {
    chunks.push(b.subarray((cur + 1) * chunkSize, (cur + 1) * chunkSize + chunkSize));
    cur = safeNext(cur, fatTable);
  }
  return Buffer.concat(chunks).subarray(0, count);
}

// Directory entries
const dirEntries = [];
{
  let sec = firstDirSector;
  let g = 0;
  while (sec !== 0xfffffffe && sec !== 0xffffffff && g++ < 1000) {
    const off = (sec + 1) * sectorSize;
    for (let i = 0; i < sectorSize / 128; i++) {
      const eoff = off + i * 128;
      const nameLen = b.readUInt16LE(eoff + 64);
      if (nameLen === 0) continue;
      const type = b[eoff + 66];
      const start = b.readUInt32LE(eoff + 116);
      const size = Number(b.readBigUInt64LE(eoff + 120));
      const name = b.subarray(eoff, eoff + nameLen - 2).toString("utf16le").replace(/\u0000+$/, "");
      dirEntries.push({ name, type, start, size });
    }
    sec = safeNext(sec, fat);
  }
}

const root = dirEntries.find((e) => e.type === 5);
const miniStream = root ? readChain(root.start, root.size, fat, sectorSize) : Buffer.alloc(0);

// Mini FAT
const miniFat = [];
{
  let sec = firstMiniFatSector;
  let g = 0;
  while (sec !== 0xfffffffe && sec !== 0xffffffff && g++ < 1000) {
    const off = (sec + 1) * sectorSize;
    for (let i = 0; i < sectorSize / 4; i++) miniFat.push(b.readUInt32LE(off + i * 4));
    sec = safeNext(sec, fat);
  }
}

console.error(`[debug] dirEntries=${dirEntries.map((e) => e.name).join(", ")}`);

function getStream(name) {
  const entry = dirEntries.find((e) => e.name === name);
  if (!entry) return null;
  if (entry.size < miniStreamCutoff) {
    // mini stream chain (64-byte mini sectors inside the root stream)
    const chunks = [];
    let cur = entry.start;
    let g = 0;
    while (cur !== 0xfffffffe && cur !== 0xffffffff && g++ < 100000) {
      chunks.push(miniStream.subarray(cur * miniSectorSize, (cur + 1) * miniSectorSize));
      cur = miniFat[cur];
    }
    return Buffer.concat(chunks).subarray(0, entry.size);
  }
  return readChain(entry.start, entry.size, fat, sectorSize);
}

const workbook = getStream("Workbook") || getStream("Book");
if (!workbook) {
  console.error("No Workbook stream found. Entries:", dirEntries.map((e) => e.name).join(", "));
  process.exit(1);
}

// ---------------- BIFF8 records ----------------
function rkToNum(rk) {
  const fX100 = rk & 1;
  if (rk & 2) {
    let v = rk >> 2;
    if (fX100) v /= 100;
    return v;
  }
  const buf = Buffer.alloc(8);
  buf.writeInt32BE(rk & 0xfffffffc, 0);
  buf.writeInt32BE(0, 4);
  let v = buf.readDoubleBE(0);
  if (fX100) v /= 100;
  return v;
}

const sheets = [];
let sst = [];
let boundsheets = [];
let current = null;

function setCell(row, col, val) {
  if (!current) return;
  if (!current.rows[row]) current.rows[row] = [];
  current.rows[row][col] = val;
  if (col + 1 > current.maxCol) current.maxCol = col + 1;
}

let pos = 0;
let bofCount = 0;
let pendingString = null;
while (pos + 4 <= workbook.length) {
  const id = workbook.readUInt16LE(pos);
  const len = workbook.readUInt16LE(pos + 2);
  const d = workbook.subarray(pos + 4, pos + 4 + len);
  pos += 4 + len;

  switch (id) {
    case 0x0809: { // BOF
      bofCount++;
      if (bofCount > 1) {
        const meta = boundsheets[sheets.length];
        current = { name: meta ? meta.name : `Sheet${sheets.length + 1}`, rows: [], maxCol: 0 };
        sheets.push(current);
      }
      break;
    }
    case 0x0085: { // BOUNDSHEET
      const cch = d.readUInt8(6);
      const flags = d.readUInt8(7);
      const name = flags & 1 ? d.subarray(8, 8 + cch * 2).toString("utf16le") : d.subarray(8, 8 + cch).toString("latin1");
      boundsheets.push({ name });
      break;
    }
    case 0x00fc: { // SST
      let p = 8;
      while (p < d.length) {
        const cch = d.readUInt16LE(p); p += 2;
        const flags = d.readUInt8(p); p += 1;
        let rich = 0, phon = 0;
        if (flags & 0x08) { rich = d.readUInt16LE(p); p += 2; }
        if (flags & 0x10) { phon = d.readUInt32LE(p); p += 4; }
        const str = flags & 1
          ? d.subarray(p, p + cch * 2).toString("utf16le")
          : d.subarray(p, p + cch).toString("latin1");
        p += (flags & 1) ? cch * 2 : cch;
        p += rich * 4 + phon;
        sst.push(str);
      }
      break;
    }
    case 0x00fd: { // LABELSST
      const row = d.readUInt16LE(0), col = d.readUInt16LE(2);
      const idx = d.readUInt32LE(6);
      setCell(row, col, sst[idx] ?? "");
      break;
    }
    case 0x0203: { // NUMBER
      const row = d.readUInt16LE(0), col = d.readUInt16LE(2);
      setCell(row, col, d.readDoubleLE(6));
      break;
    }
    case 0x027e: { // RK
      const row = d.readUInt16LE(0), col = d.readUInt16LE(2);
      setCell(row, col, rkToNum(d.readInt32LE(6)));
      break;
    }
    case 0x00bd: { // MULRK
      const row = d.readUInt16LE(0);
      const colFirst = d.readUInt16LE(2);
      const n = (len - 6) / 6;
      for (let i = 0; i < n; i++) {
        setCell(row, colFirst + i, rkToNum(d.readInt32LE(4 + i * 6 + 2)));
      }
      break;
    }
    case 0x0204: { // LABEL
      const row = d.readUInt16LE(0), col = d.readUInt16LE(2);
      const cch = d.readUInt16LE(6);
      const flags = d.readUInt8(8);
      const str = flags & 1
        ? d.subarray(9, 9 + cch * 2).toString("utf16le")
        : d.subarray(9, 9 + cch).toString("latin1");
      setCell(row, col, str);
      break;
    }
    case 0x0006: { // FORMULA
      const row = d.readUInt16LE(0), col = d.readUInt16LE(2);
      const res = d.subarray(6, 14);
      if (res[6] === 0xff && res[7] === 0xff) {
        pendingString = { row, col }; // string result arrives in a STRING record
      } else if (res[6] === 0x00 && res[7] === 0x00) {
        setCell(row, col, res.readDoubleLE(0));
      }
      break;
    }
    case 0x0207: { // STRING (formula string result)
      if (pendingString) {
        const cch = d.readUInt16LE(0);
        const flags = d.readUInt8(2);
        const str = flags & 1
          ? d.subarray(3, 3 + cch * 2).toString("utf16le")
          : d.subarray(3, 3 + cch).toString("latin1");
        setCell(pendingString.row, pendingString.col, str);
        pendingString = null;
      }
      break;
    }
    case 0x000a: { // EOF
      current = null;
      break;
    }
  }
}

// ---------------- Output ----------------
const outFile = process.argv[3];
if (outFile) {
  const payload = sheets.map((s) => ({
    name: s.name,
    rows: s.rows
      .map((r, idx) => (r && r.length ? { row: idx + 1, cells: r } : null))
      .filter(Boolean),
  }));
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outFile} (${sheets.length} sheets)`);
  process.exit(0);
}

const maxRowsToShow = 60;
console.log(`Sheets: ${sheets.length}`);
for (const s of sheets) {
  const nonEmpty = s.rows.filter((r) => r && r.length).length;
  console.log(`\n===== Sheet "${s.name}" | ${nonEmpty} non-empty rows | ${s.maxCol} columns =====`);
  for (let r = 0; r < Math.min(s.rows.length, maxRowsToShow); r++) {
    const row = s.rows[r];
    if (!row || row.length === 0) continue;
    const cells = [];
    for (let c = 0; c < s.maxCol; c++) {
      let v = row[c];
      if (v === undefined || v === null || v === "") v = "";
      v = String(v).replace(/\r?\n/g, " ").replace(/,/g, ";");
      if (v.length > 40) v = v.slice(0, 40) + "…";
      cells.push(v);
    }
    console.log(`${r + 1}: ${cells.join(" | ")}`);
  }
}
