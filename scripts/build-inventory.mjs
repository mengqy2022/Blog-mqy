/* Merge the LCSC statement (.xls) and the BOM (.xlsx) into a unified
 * inventory dataset used by the interactive inventory page.
 *
 * Prerequisites (run first):
 *   node scripts/inspect-xls.mjs  <statement.xls>  .inventory-tmp/statement.json
 *   powershell -File scripts/xlsx-to-json.ps1 -Xlsx <bom.xlsx> -OutJson .inventory-tmp/bom.json
 *
 * Then:
 *   node scripts/build-inventory.mjs
 * Writes:
 *   public/inventory/inventory.json        (the dataset the page loads)
 *   public/inventory/inventory.example.csv (template accepted by the in-page upload)
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const tmp = path.join(root, ".inventory-tmp");

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

const statement = readJson(path.join(tmp, "statement.json"));
const bom = readJson(path.join(tmp, "bom.json"));

const sheet = statement.find((s) => s.name === "Sheet1") || statement[0];
const stmtRows = sheet.rows.map((r) => r.cells);

// ---- Group the statement by LCSC part number (C#) ----
const items = new Map();
for (let i = 1; i < stmtRows.length; i++) {
  const r = stmtRows[i];
  if (!r || r.length < 11) continue;
  const cid = String(r[4] ?? "").trim();
  const part = String(r[8] ?? "").trim();
  // skip junk rows without a part number AND without a C# (e.g. blank continuation lines)
  if (!cid && !part) continue;
  const key = cid || `__${part}_${i}`;

  if (!items.has(key)) {
    items.set(key, {
      id: cid,
      categoryRaw: String(r[6] ?? "").trim(),
      part,
      footprint: String(r[9] ?? "").trim(),
      unit: String(r[11] ?? "").trim(),
      brand: String(r[5] ?? "").trim(),
      description: String(r[7] ?? "").trim(),
      price: Number(r[12]) || 0,
      qty: 0,
      inBom: false,
      bomQty: 0,
      value: "",
    });
  }
  const it = items.get(key);
  it.qty += Number(r[10]) || 0;
  const p = Number(r[12]);
  if (p > 0) it.price = p; // keep the latest unit price
  if (!it.part && part) it.part = part;
  if (!it.categoryRaw && String(r[6] ?? "").trim()) it.categoryRaw = String(r[6]).trim();
  if (!it.description && String(r[7] ?? "").trim()) it.description = String(r[7]).trim();
}

// ---- Group the BOM by LCSC part number (C#) ----
const bomByC = new Map();
for (const row of bom) {
  const cid = String(row["Supplier Part"] ?? "").trim();
  // skip empty rows and repeated header rows
  if (!cid || cid === "Supplier Part") continue;
  if (!bomByC.has(cid)) {
    bomByC.set(cid, { qty: 0, part: "", value: "", footprint: "", manufacturer: "" });
  }
  const b = bomByC.get(cid);
  b.qty += Number(row["Quantity"]) || 0;
  if (String(row["Manufacturer Part"] ?? "").trim()) b.part = String(row["Manufacturer Part"]).trim();
  const value = String(row["Value"] ?? "").trim() || String(row["Comment"] ?? "").trim();
  if (value) b.value = value;
  if (String(row["Footprint"] ?? "").trim()) b.footprint = String(row["Footprint"]).trim();
  if (String(row["Manufacturer"] ?? "").trim()) b.manufacturer = String(row["Manufacturer"]).trim();
}

// ---- Merge BOM info into statement items, and add BOM-only items ----
const merged = [];
for (const [, it] of items) {
  if (it.id && bomByC.has(it.id)) {
    const b = bomByC.get(it.id);
    it.inBom = true;
    it.bomQty = b.qty;
    if (b.value) it.value = b.value;
    if (!it.footprint && b.footprint) it.footprint = b.footprint;
    if (!it.part && b.part) it.part = b.part;
    if (!it.brand && b.manufacturer) it.brand = b.manufacturer;
    bomByC.delete(it.id);
  }
  merged.push(it);
}
for (const [cid, b] of bomByC) {
  merged.push({
    id: cid,
    categoryRaw: "",
    part: b.part,
    footprint: b.footprint,
    unit: "",
    brand: b.manufacturer,
    description: "",
    price: 0,
    qty: 0,
    inBom: true,
    bomQty: b.qty,
    value: b.value,
  });
}

// ---- Normalize categories to English ----
const CATEGORY_MAP = {
  "贴片电阻": "Resistor",
  "贴片电容(MLCC)": "Capacitor",
  "钽电容": "Tantalum Capacitor",
  "功率电感": "Inductor",
  "场效应管(MOSFET)": "MOSFET",
  "肖特基二极管": "Diode",
  "静电和浪涌保护(TVS/ESD)": "TVS/ESD Protection",
  "发光二极管/LED": "LED",
  "无源晶振": "Crystal",
  "自恢复保险丝": "Fuse",
  "DC-DC电源芯片": "Power IC",
  "逻辑门": "Logic IC",
  "USB集线器": "Interface IC",
  "轻触开关": "Switch",
  "滑动开关": "Switch",
  "按键开关": "Switch",
  "USB连接器": "Connector",
  "线对板针座": "Connector",
  "电池夹": "Connector",
  "其他模块": "Module",
  "资料册": "Misc",
};

function inferCategory(it) {
  const value = String(it.value || "").toLowerCase();
  const part = String(it.part || "").toLowerCase();
  const fp = String(it.footprint || "").toLowerCase();
  const s = `${value} ${part} ${fp}`;

  // Value-based: resistors / capacitors / inductors first
  if (/(uf|nf|pf|mf)\b/.test(value)) return "Capacitor";
  if (/(uh|mh)\b/.test(value)) return "Inductor";
  if (value.includes("Ω") || value.includes("ohm")) return "Resistor";
  if (fp.startsWith("r0") && /^\d+$/.test(fp.slice(1))) return "Resistor"; // R0603
  if (fp.includes("res-")) return "Resistor"; // RES-SMD_...

  // Known parts (LCSC part-number patterns)
  if (/^ss\d/.test(part)) return "Diode"; // SS34/SS54 Schottky
  if (/^ao\d{4}|2n7002|si2300|irf\d|nce\d|^ao3400/.test(part)) return "MOSFET";
  if (/^74(lvc|hc|ahct|hct|lvc1g)?\d|^sn74|^cd40\d|^cd45\d/.test(part)) return "Logic IC";
  if (/esp32|wroom|cc2640|nrf52|esp8266|adwh002/.test(s)) return "Module";

  // Known analog/power ICs
  const powerIcs = ["ams1117", "me6211", "mt3608", "tp4057", "ns4168", "lmv358", "ch217k", "mp2307", "tps54", "xl6009", "lm2596", "mc34063", "xc6206", "rt9013"];
  if (powerIcs.some((p) => part.startsWith(p))) return "Power IC";

  // LED / optical
  if (fp.includes("led") || part.includes("led")) return "LED";

  // Connectors / headers / wiring
  if (
    fp.includes("conn-") || fp.includes("hdr-") || fp.includes("fpc-") || fp.includes("bat-") ||
    fp.includes("usb-") || fp.includes("usb_") ||
    part.includes("ph2.54") || part.includes("ph2.0") || part.includes("xh2.54") ||
    part.includes("pz254") || part.includes("gh1.25") || part.includes("wafer") ||
    part.includes("mx1.25") || part.includes("fpc") || part.includes("usb") ||
    part.includes("type-c") || part.includes("typec")
  ) return "Connector";

  // Switches
  if (fp.includes("sw-") || /msk12c02|ts24|5824|zx-qc|ps-5824/.test(part)) return "Switch";

  // Crystals / oscillators
  if (/crystal|oscillator|\bmhz|\bkhz|32\.768/.test(s)) return "Crystal";

  // Fuses / protection
  if (/fuse/.test(s)) return "Fuse";
  if (/tvs|esd|smfj/.test(s)) return "TVS/ESD Protection";

  // Generic IC by footprint
  if (
    fp.includes("sot-23") || fp.includes("sot-223") || fp.includes("sot-353") ||
    fp.includes("sop-") || fp.includes("soic-") || fp.includes("esop-") ||
    fp.includes("qfn") || fp.includes("dfn") || fp.includes("sod-") ||
    fp.includes("essop") || fp.includes("ssop")
  ) return "IC";

  return "Misc";
}

const out = [];
for (const it of merged) {
  it.category = CATEGORY_MAP[it.categoryRaw] || inferCategory(it);
  it.value = it.value || it.part || it.id;
  // keep the dataset English/clean
  delete it.categoryRaw;
  out.push(it);
}

out.sort((a, b) => {
  const c = a.category.localeCompare(b.category);
  if (c) return c;
  return (a.part || "").localeCompare(b.part || "");
});

// ---- Write outputs ----
const outDir = path.join(root, "public", "inventory");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "inventory.json"), JSON.stringify(out, null, 2));

const exampleHeader = [
  "id", "category", "part", "value", "footprint",
  "qty", "unit", "price", "brand", "bomQty", "inBom", "description",
].join(",");
const example = [
  exampleHeader,
  'C2930027,Resistor,FRC0603J103 TS,10kΩ,0603,100,个,0.0056,"FOJAN(富捷)",8,true,"10k ohm ±5% 100mW thick film resistor, tape"',
  'C1591,Capacitor,CL10B104KB8NNNC,100nF,C0603,100,个,0.0195,"SAMSUNG(三星)",9,true,"100nF ±10% 50V MLCC, tape"',
  'C48641617,Connector,HX-PH2.0-2PZZ,HX-PH2.0-2PZZ,CONN-TH_2P-P2.50_HX-PH2.0-2PZZ,3,个,0,hanxia(韩下),3,true,"2-pin PH2.0 connector"',
].join("\n");
fs.writeFileSync(path.join(outDir, "inventory.example.csv"), example);

const catCount = {};
for (const it of out) catCount[it.category] = (catCount[it.category] || 0) + 1;
const totalQty = out.reduce((s, it) => s + it.qty, 0);
const bomNeeded = out.filter((it) => it.inBom).reduce((s, it) => s + it.bomQty, 0);

console.log(`Total unique items : ${out.length}`);
console.log(`Total qty on hand : ${totalQty}`);
console.log(`BOM items (in use): ${out.filter((it) => it.inBom).length} (need ${bomNeeded})`);
console.log(`Not yet purchased : ${out.filter((it) => it.qty === 0).length}`);
console.log("Categories:", JSON.stringify(catCount, null, 0));
console.log(`Wrote public/inventory/inventory.json and inventory.example.csv`);
