---
title: Component Inventory
published: 2026-09-20
description: An interactive inventory of electronic components I have purchased — search, filter, sort, adjust quantities, upload a new file, and download the data as CSV.
image: ''
tags: [Inventory, Electronics, Tools]
category: Tools
draft: false
---

This page is an **interactive inventory** of the electronic components I have on
hand. It is generated from two sources: the LCSC order statement and the BOM of
the UV-detection-board (Bluetooth) project.

Use the controls below to **search**, **filter by category**, **sort** any column,
and **edit quantities** to track what you have left. Low-stock items (fewer on
hand than the BOM needs for one board) are highlighted in red, and items that the
BOM needs but that have not been purchased yet are highlighted in amber.

<div id="inventory-app"></div>

## How it works

- **Data source:** [`/inventory/inventory.json`](/inventory/inventory.json) is a
  static JSON file generated at build time from the two Excel files.
- **Editing:** quantity changes and uploaded files are saved **only in your own
  browser** (localStorage) — they do not change what other visitors see.
- **Publishing updates:** to update the inventory for everyone, regenerate the
  data and redeploy:

  1. Put the new LCSC statement (`.xls`) and/or BOM (`.xlsx`) somewhere on disk;
  2. Run:
     ```sh
     node scripts/inspect-xls.mjs  <statement.xls>  .inventory-tmp/statement.json
     powershell -File scripts/xlsx-to-json.ps1 -Xlsx <bom.xlsx> -OutJson .inventory-tmp/bom.json
     node scripts/build-inventory.mjs
     ```
  3. Commit and push — Cloudflare rebuilds and the new inventory goes live.

## File format (for uploads)

The in-page **Upload file…** button accepts a CSV with these columns (or an
XLS/XLSX whose first row uses the same headers):

| Column | Meaning |
| --- | --- |
| `id` | LCSC part number, e.g. `C2930027` |
| `category` | e.g. `Resistor`, `Capacitor`, `Inductor`, `Connector`… |
| `part` | Manufacturer part number |
| `value` | Value / spec, e.g. `10kΩ`, `100nF`, `4.7uH` |
| `footprint` | Package, e.g. `0603`, `SOT-23` |
| `qty` | Quantity on hand |
| `unit` | Unit, e.g. `个` / `pcs` |
| `price` | Unit price in CNY (optional) |
| `brand` | Manufacturer / brand (optional) |
| `bomQty` | Quantity needed per board (optional) |
| `inBom` | `true`/`false` — whether the part is used in the BOM |
| `description` | Optional note |

Download the [example file](/inventory/inventory.example.csv) and
[the full current data](/inventory/inventory.json) to see the structure.
