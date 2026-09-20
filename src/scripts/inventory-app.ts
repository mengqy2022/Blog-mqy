/* Interactive electronic-component inventory app.
 *
 * Mounted by Layout.astro into #inventory-app (rendered from the
 * "Component Inventory" post). Features:
 *   - search, category filter, sortable columns
 *   - editable quantities (persisted per-browser in localStorage)
 *   - low-stock highlighting (inBom && qty < bomQty)
 *   - upload a new CSV / XLS / XLSX file to preview an updated inventory
 *   - export the (edited) inventory as CSV
 *
 * Data source: /inventory/inventory.json (regenerate with
 * scripts/build-inventory.mjs and redeploy to publish updates).
 */

export interface InventoryItem {
  id: string;
  category: string;
  part: string;
  value: string;
  footprint: string;
  qty: number;
  unit: string;
  price: number;
  brand: string;
  bomQty: number;
  inBom: boolean;
  description: string;
}

const DATA_URL = "/inventory/inventory.json";
const EXAMPLE_URL = "/inventory/inventory.example.csv";
const QTY_KEY = "inventory-qty-overrides-v1";
const DATA_KEY = "inventory-data-overrides-v1";

let items: InventoryItem[] = [];
let root: HTMLElement | null = null;
let mounted = false;

let search = "";
let category = "All";
let lowOnly = false;
let sortKey = "part";
let sortDir: 1 | -1 = 1;

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function readOverrides(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(QTY_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeOverrides(o: Record<string, number>) {
  localStorage.setItem(QTY_KEY, JSON.stringify(o));
}

function lcscUrl(id: string): string {
  return `https://www.szlcsc.com/so/search/global.html?k=${encodeURIComponent(id)}`;
}

function categories(): string[] {
  const set = new Set<string>();
  for (const it of items) if (it.category) set.add(it.category);
  return Array.from(set).sort();
}

function filtered(): InventoryItem[] {
  const q = search.trim().toLowerCase();
  let list = items.filter((it) => {
    if (category !== "All" && it.category !== category) return false;
    if (lowOnly && !(it.inBom && it.qty < it.bomQty)) return false;
    if (!q) return true;
    const hay = `${it.part} ${it.value} ${it.footprint} ${it.id} ${it.brand} ${it.description} ${it.category}`.toLowerCase();
    return hay.includes(q);
  });
  const key = sortKey as keyof InventoryItem;
  list = [...list].sort((a, b) => {
    const isNum = key === "qty" || key === "bomQty" || key === "price";
    const av = isNum ? Number(a[key]) : String(a[key] ?? "").toLowerCase();
    const bv = isNum ? Number(b[key]) : String(b[key] ?? "").toLowerCase();
    const cmp = isNum ? av - bv : String(av).localeCompare(String(bv));
    if (cmp < 0) return -1 * sortDir;
    if (cmp > 0) return 1 * sortDir;
    return 0;
  });
  return list;
}

function stats() {
  const totalItems = items.length;
  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const low = items.filter((it) => it.inBom && it.qty < it.bomQty).length;
  const notPurchased = items.filter((it) => it.inBom && it.qty === 0).length;
  return { totalItems, totalQty, low, notPurchased };
}

function renderControls(container: HTMLElement) {
  const { totalItems, totalQty, low, notPurchased } = stats();
  const cats = categories();

  const statsHtml = `
    <div class="flex flex-wrap gap-3 text-sm mb-3">
      <span class="rounded-lg px-3 py-1 bg-black/5 dark:bg-white/10">${totalItems} part types</span>
      <span class="rounded-lg px-3 py-1 bg-black/5 dark:bg-white/10">${totalQty} on hand</span>
      <span class="rounded-lg px-3 py-1 ${low ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-black/5 dark:bg-white/10"}">${low} low stock</span>
      <span class="rounded-lg px-3 py-1 ${notPurchased ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-black/5 dark:bg-white/10"}">${notPurchased} needed, not purchased</span>
    </div>`;

  const chips = ["All", ...cats]
    .map(
      (c) => `
      <button data-cat="${esc(c)}" class="inv-chip btn-regular text-sm px-3 py-1 rounded-lg ${category === c ? "!bg-[var(--primary)] !text-white" : ""}">
        ${esc(c)}${c === "All" ? ` (${items.length})` : ""}
      </button>`,
    )
    .join("");

  container.innerHTML = `
    ${statsHtml}
    <div class="flex flex-col md:flex-row gap-3 mb-3">
      <input id="inv-search" type="text" placeholder="Search part / value / footprint / C# …"
        class="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm bg-black/5 dark:bg-white/10 outline-none focus:ring-2 ring-[var(--primary)]"
        value="${esc(search)}">
      <div class="flex gap-2">
        <label class="btn-regular text-sm px-3 py-2 rounded-lg cursor-pointer select-none">
          <input type="checkbox" id="inv-low" class="mr-1.5" ${lowOnly ? "checked" : ""}> Low stock
        </label>
        <button id="inv-reset" class="btn-regular text-sm px-3 py-2 rounded-lg" title="Clear local edits">Reset</button>
      </div>
    </div>
    <div id="inv-cats" class="flex flex-wrap gap-2 mb-3">${chips}</div>
  `;

  const searchInput = container.querySelector<HTMLInputElement>("#inv-search")!;
  searchInput.addEventListener("input", () => {
    search = searchInput.value;
    render();
  });

  container.querySelector<HTMLInputElement>("#inv-low")!.addEventListener("change", (e) => {
    lowOnly = (e.target as HTMLInputElement).checked;
    render();
  });

  container.querySelector<HTMLButtonElement>("#inv-reset")!.addEventListener("click", () => {
    localStorage.removeItem(QTY_KEY);
    localStorage.removeItem(DATA_KEY);
    location.reload();
  });

  container.querySelector("#inv-cats")!.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-cat]");
    if (!btn) return;
    category = btn.dataset.cat || "All";
    render();
  });
}

function renderTable(container: HTMLElement) {
  const list = filtered();
  const head = (label: string, key: string, cls = "") => {
    const active = sortKey === key;
    return `<th class="px-3 py-2 text-left text-xs font-semibold cursor-pointer select-none whitespace-nowrap hover:text-[var(--primary)] ${cls}"
      data-sort="${key}">${label}${active ? (sortDir === 1 ? " ▲" : " ▼") : ""}</th>`;
  };

  const rows = list
    .map((it) => {
      const low = it.inBom && it.qty < it.bomQty;
      const none = it.inBom && it.qty === 0;
      const price = it.price ? `¥${it.price.toFixed(4)}` : "—";
      const idLink = it.id
        ? `<a href="${lcscUrl(it.id)}" target="_blank" rel="noopener" class="link text-[var(--primary)] text-xs">${esc(it.id)}</a>`
        : "<span class='text-xs opacity-40'>—</span>";
      return `
      <tr class="${low ? "!bg-red-500/10" : none ? "!bg-amber-500/10" : ""} border-t border-black/5 dark:border-white/10">
        <td class="px-3 py-1.5 text-xs whitespace-nowrap"><span class="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5">${esc(it.category)}</span></td>
        <td class="px-3 py-1.5">
          <div class="font-medium text-sm leading-tight">${esc(it.part || it.value || it.id)}</div>
          <div class="text-xs opacity-50 leading-tight">${esc(it.value)}${it.brand ? " · " + esc(it.brand) : ""}</div>
        </td>
        <td class="px-3 py-1.5 text-xs whitespace-nowrap">${esc(it.footprint)}</td>
        <td class="px-3 py-1.5">
          <input type="number" min="0" step="1" data-qty="${esc(it.id)}" value="${it.qty}"
            class="inv-qty w-20 rounded-md px-2 py-1 text-sm text-right bg-black/5 dark:bg-white/10 outline-none focus:ring-2 ring-[var(--primary)]">
          <span class="text-xs opacity-40">${esc(it.unit)}</span>
        </td>
        <td class="px-3 py-1.5 text-xs text-right whitespace-nowrap ${low ? "font-bold text-red-500" : ""}">
          ${it.bomQty ? `${it.bomQty} <span class="opacity-40">/ board</span>` : "<span class='opacity-30'>—</span>"}
        </td>
        <td class="px-3 py-1.5 text-xs text-right whitespace-nowrap">${price}</td>
        <td class="px-3 py-1.5">${idLink}</td>
      </tr>`;
    })
    .join("");

  const empty = `<tr><td colspan="7" class="px-3 py-6 text-center text-sm opacity-50">No matching items.</td></tr>`;

  container.innerHTML = `
    <div class="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table class="w-full text-sm">
        <thead class="bg-black/5 dark:bg-white/10">
          <tr>${head("Category", "category")}${head("Part / Value", "part")}${head("Footprint", "footprint")}${head("Qty", "qty", "text-right")}${head("BOM", "bomQty", "text-right")}${head("Price", "price", "text-right")}${head("LCSC #", "id")}</tr>
        </thead>
        <tbody>${rows || empty}</tbody>
      </table>
    </div>
    <div class="text-xs opacity-50 mt-2">${list.length} of ${items.length} items shown. Click a header to sort. Edit quantities to keep track — changes are saved in this browser only.</div>
  `;

  container.querySelectorAll<HTMLElement>("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.dataset.sort!;
      if (sortKey === k) sortDir = sortDir === 1 ? -1 : 1;
      else {
        sortKey = k;
        sortDir = 1;
      }
      render();
    });
  });

  const overrides = readOverrides();
  container.querySelectorAll<HTMLInputElement>("input.inv-qty").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.qty!;
      const v = Math.max(0, Math.floor(num(input.value)));
      input.value = String(v);
      overrides[id] = v;
      writeOverrides(overrides);
      const it = items.find((x) => x.id === id);
      if (it) it.qty = v;
      render();
    });
  });
}

function renderUpload(container: HTMLElement) {
  container.innerHTML = `
    <div class="rounded-xl border border-dashed border-black/15 dark:border-white/20 p-4">
      <div class="text-sm font-medium mb-1">Update inventory from a file</div>
      <div class="text-xs opacity-60 mb-3">
        Upload a CSV (see the example format), or an XLS/XLSX — it is parsed in your browser and
        replaces the table for this session. To publish updates for all visitors, regenerate
        <code>inventory.json</code> with <code>scripts/build-inventory.mjs</code> and redeploy.
      </div>
      <div class="flex flex-wrap gap-2">
        <button id="inv-upload" class="btn-regular text-sm px-3 py-2 rounded-lg">Upload file…</button>
        <button id="inv-export" class="btn-regular text-sm px-3 py-2 rounded-lg">Download CSV</button>
        <a id="inv-example" href="${EXAMPLE_URL}" download class="btn-regular text-sm px-3 py-2 rounded-lg">Example format</a>
      </div>
      <input id="inv-file" type="file" accept=".csv,.xls,.xlsx" class="hidden">
      <div id="inv-msg" class="text-xs mt-2 opacity-70"></div>
    </div>
  `;

  container.querySelector<HTMLButtonElement>("#inv-upload")!.addEventListener("click", () => {
    container.querySelector<HTMLInputElement>("#inv-file")!.click();
  });

  container.querySelector<HTMLInputElement>("#inv-file")!.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const msg = container.querySelector<HTMLElement>("#inv-msg")!;
    try {
      if (/\.(xls|xlsx)$/i.test(file.name)) {
        msg.textContent = "Parsing spreadsheet…";
        const rows = await parseSpreadsheet(file);
        const parsed = rowsToItems(rows);
        if (parsed.length === 0) throw new Error("No data rows found");
        applyUploaded(parsed);
        msg.textContent = `Loaded ${parsed.length} items from ${file.name} (session only).`;
      } else {
        const text = await file.text();
        const parsed = rowsToItems(parseCsv(text));
        if (parsed.length === 0) throw new Error("No data rows found");
        applyUploaded(parsed);
        msg.textContent = `Loaded ${parsed.length} items from ${file.name} (session only).`;
      }
    } catch (err) {
      msg.textContent = `Upload failed: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      (e.target as HTMLInputElement).value = "";
    }
  });

  container.querySelector<HTMLButtonElement>("#inv-export")!.addEventListener("click", () => {
    const header = ["id", "category", "part", "value", "footprint", "qty", "unit", "price", "brand", "bomQty", "inBom", "description"];
    const lines = [
      header.join(","),
      ...items.map((it) =>
        [
          it.id, it.category, it.part, it.value, it.footprint, it.qty, it.unit, it.price, it.brand, it.bomQty, it.inBom, it.description,
        ]
          .map((v) => {
            const s = String(v ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      ),
    ];
    download("inventory-export.csv", lines.join("\n"), "text/csv");
  });
}

function applyUploaded(parsed: InventoryItem[]) {
  items = parsed;
  search = "";
  category = "All";
  lowOnly = false;
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(parsed));
  } catch {
    /* storage full — ignore */
  }
  render();
}

function rowsToItems(rows: string[][]): InventoryItem[] {
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const idx = (name: string) => header.indexOf(name);
  const out: InventoryItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some((c) => c.trim() !== "")) continue;
    const get = (name: string) => {
      const j = idx(name);
      return j >= 0 && j < r.length ? String(r[j] ?? "").trim() : "";
    };
    const part = get("part");
    const id = get("id");
    const value = get("value");
    if (!part && !id && !value) continue;
    out.push({
      id,
      category: get("category") || "Misc",
      part,
      value: value || part || id,
      footprint: get("footprint"),
      qty: Math.max(0, Math.floor(num(get("qty")))),
      unit: get("unit"),
      price: num(get("price")),
      brand: get("brand"),
      bomQty: Math.max(0, Math.floor(num(get("bomqty")))),
      inBom: /^(1|true|yes)$/i.test(get("inbom")),
      description: get("description"),
    });
  }
  return out;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

async function parseSpreadsheet(file: File): Promise<string[][]> {
  const XLSX = await loadXlsx();
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  return raw.map((r) => (r || []).map((c) => String(c ?? "")));
}

async function loadXlsx(): Promise<any> {
  if ((window as any).XLSX) return (window as any).XLSX;
  const src = "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js";
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the spreadsheet parser (offline?). Use CSV instead."));
    document.head.appendChild(s);
  });
  return (window as any).XLSX;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function render() {
  if (!root) return;
  const controls = document.createElement("div");
  renderControls(controls);
  const table = document.createElement("div");
  renderTable(table);
  root.replaceChildren(controls, table);
}

export async function mountInventory() {
  if (mounted) return;
  const el = document.getElementById("inventory-app");
  if (!el) return;
  mounted = true;
  root = el;

  try {
    const stored = localStorage.getItem(DATA_KEY);
    if (stored) {
      items = JSON.parse(stored) as InventoryItem[];
    } else {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      items = (await res.json()) as InventoryItem[];
    }
    // apply per-item quantity overrides saved in this browser
    const overrides = readOverrides();
    for (const it of items) {
      if (overrides[it.id] !== undefined) it.qty = overrides[it.id];
    }
  } catch (err) {
    el.innerHTML = `<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
      Failed to load inventory data: ${esc(err instanceof Error ? err.message : String(err))}
    </div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "inventory-app";
  el.replaceChildren(wrapper);

  // render() only re-renders this dynamic region, so the upload/export
  // controls (appended as a sibling below) survive every interaction.
  const dynamic = document.createElement("div");
  dynamic.id = "inv-dynamic";
  wrapper.appendChild(dynamic);

  const upload = document.createElement("div");
  renderUpload(upload);
  wrapper.appendChild(upload);

  root = dynamic;
  render();
}
