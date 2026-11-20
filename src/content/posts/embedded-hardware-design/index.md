---

title: "BoardCraft: Evidence-Based Schematics and PCB Design with AI"
published: 2026-11-14
updated: 2026-11-20
description: "BoardCraft, formerly embedded-hardware-design, brings evidence-backed rule selection, independent PCB review gates, and illustrated LED and GD32E230 examples to AI-assisted hardware design. Updated for version 3.0.1."
image: "./cover.svg"
tags: ["Embedded Systems", "PCB Design", "Schematic", "AI", "Codex", "Open Source"]
category: "Hardware"
draft: false
lang: en
---

**BoardCraft (板匠)** is the new name of my `embedded-hardware-design` skill. It organizes the rules, review templates, and evidence checks I use when an AI assistant helps with schematics and PCBs. The shorter name comes with a substantial v3 update: rules can now be selected from the actual design, verification has clearer independent gates, and two illustrated examples show the method in EasyEDA.

The engineering problem remains familiar. A cleaner schematic can still hide an incorrect pin mapping. A PCB with no DRC errors can still have poor assembly access or an unsuitable decoupling path. A report from yesterday can describe copper that no longer exists today. BoardCraft keeps requirements, design objects, and evidence connected as the work changes.

This article covers **BoardCraft 3.0.1**, dated November 19, 2026, and the [current documentation snapshot](https://github.com/mengqy2022/boardcraft/tree/2d158ebf775f1481e08437465d3ea98c47bfcb3a). The repository is now [mengqy2022/boardcraft](https://github.com/mengqy2022/boardcraft), and the skill invocation is **`$boardcraft`**. Existing SCH/PCB rule identifiers and historical project evidence retain their meaning.

## What changed since the original article

The earlier article described the 2.4 generation. The current edition brings three connected changes:

- **Design-aware rule selection:** classify components, nets, copper layers, and special features with evidence, then generate the applicable task modules. Unresolved classifications stay visible.
- **Independent verification:** preserve PCB-V07 stage reviews, add PCB-V08 for separate rule-gate and native DRC evidence, and use PCB-V09 to cover six engineering review areas.
- **Examples readers can inspect:** a six-component button LED board and a GD32E230 development-board PCB comparison, with schematic, routing, and revision-comparison GIFs.

The new name, cover, repository links, installation directory, chat rules document, and tool guide are updated together. The method still focuses on common low-voltage embedded hardware. High-voltage, isolation, DDR, and specialized RF or flexible-board designs need accurate device, material, and manufacturing guidance.

## Select the rules from the current design

Version 3 begins with the current project. The agent reads the schematic and PCB identity, components and nets, actual copper layers, manufacturing constraints, and locked mechanical objects. That information becomes an inventory with sources for its classifications.

| Module or feature                                            | What activates it                                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Common project rules                                         | Project identity, task scope, constraints, and evidence are always relevant.                          |
| Schematic                                                    | Symbols, real pins and footprints, connectivity, labels, or page organization.                        |
| PCB, power/return, and silkscreen                            | PCB stages need placement, assembly, supply and ground paths, readable markings, and delivery review. |
| Multilayer                                                   | The actual copper-layer count is greater than two.                                                    |
| Differential/high-speed, crystal, analog, or switching power | Components, connections, interface requirements, and project evidence establish the feature.          |
| RF or FPC                                                    | The design includes RF objects or flexible-board materials and bending requirements.                  |

Each feature has a `present`, `absent`, or `unknown` state. Net names and part numbers suggest candidates; classification needs the actual interface, pin connections, and project context. Edge behavior and propagation matter for high-speed decisions, so a clock-frequency threshold alone is insufficient.

From a repository checkout, a typical sequence is:

```powershell
python scripts/route_rules.py inventory.json --stage layout --output task_rules.json
python scripts/route_rules.py inventory.json --check task_rules.json --source current.epcb
```

Replace these example paths with the project's actual files. The router reads an already reviewed inventory. Its validation checks module selection, classification evidence fields, unresolved items, and consistency with the source-file hash. It does not connect to EasyEDA or establish that a classification is electrically correct.

Unknown items block completion of classification while work without that dependency can continue. A simple LED board can stay small; a mixed MCU, USB, analog, or RF design gets the references it needs. The [routing contract](https://github.com/mengqy2022/boardcraft/blob/2d158ebf775f1481e08437465d3ea98c47bfcb3a/references/task-routing.md) defines the inventory and boundaries.

## Keep requirements and evidence connected

The **HW-01–07** workflow continues to connect intended behavior to design decisions:

**Requirement → component or net → source and calculation → verification method → current evidence.**

A power-rail record should identify load and allowable voltage ranges, regulator and capacitor part numbers, calculations and assumptions, and planned load tests. A completed calculation can have a result while the physical test remains pending.

The schematic rules follow the same approach: organize functional blocks, use accurate symbol-to-pin-to-pad mappings, keep labels readable, and compare connectivity after changes. A cosmetic cleanup should preserve the netlist. An electrical change needs the affected schematic, PCB, footprints, BOM, and evidence reviewed together.

The scope scales with the task. A new board or interface change needs the relevant analysis. A local label correction needs review of its actual effects. Existing evidence can be reused when a comparison establishes that it still applies.

## Four different checks support completion

Rule selection, stage evidence, native checks, and engineering review answer different questions:

| Check           | What it establishes within its stated scope                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| v3 rule routing | Selected modules and classification records match the supplied inventory and current snapshot.                                    |
| PCB-V07         | Layout and final-stage records cover components, power pins, applicable rules, and current evidence.                              |
| PCB-V08         | The project rule gate and current PCB's native EDA DRC were run independently, have separate evidence, and both pass.             |
| PCB-V09         | Review covers electrical connectivity, power integrity, signal integrity, EMC risk, thermal behavior, and manufacturing/assembly. |

Before large-scale routing, the **layout** stage needs assembly-space review and an appropriate capacitor relationship or device-specific exception for each supply or bias pin. Planned supply and return paths must be feasible. The **final** stage checks the actual copper and current manufacturing outputs.

The stage checker remains explicit:

```powershell
python scripts/check_pcb_stage.py review/PCB_STAGE_LAYOUT.json --pcb exports/current.epcb --stage layout
python scripts/check_pcb_stage.py review/PCB_STAGE_FINAL.json --pcb exports/current.epcb --stage final
```

Current records require the rule gate, actual layer semantics, power-region review, and mechanical baseline under `RULE_GATE` and PCB-P09/P10/P11. Final records also require the six engineering areas. The rule gate and final DRC cannot be waived as not applicable. Older reports missing new items need review and current evidence.

The scripts verify coverage and file freshness. Their inputs still depend on accurate inventories and real review. For a power pin, that includes the capacitor, supply domain, copper path to the pin, and complete ground return. A nearby via or short straight-line distance provides geometry without establishing the whole loop's performance.

PCB-V09 scales methods to risk. Review, calculation, simulation, manufacturing checks, and prototype tests have distinct results. It does not require a field solver for every small board or turn an EMC risk review into compliance testing. The [verification reference](https://github.com/mengqy2022/boardcraft/blob/2d158ebf775f1481e08437465d3ea98c47bfcb3a/references/verification.md) explains the evidence expected.

## Example 01: a button-controlled LED board

The first tutorial is deliberately small: an external regulated 5 V supply, a header, a resistor, a red LED, a pushbutton, and two input capacitors. Pressing the button closes the LED's series path; releasing it opens the path. There is no MCU or firmware.

![Button LED schematic wiring replay in EasyEDA](/images/boardcraft/led-schematic-wiring.gif)

_Design-process replay from actual EDA operations, cropped to the drawing. It is not a recording of the first uninterrupted design session._

The nominal calculation uses a 1 kΩ resistor and an assumed 2 V LED drop: `(5 − 2) / 1000 = 3 mA`, with 9 mW resistor dissipation. The tutorial records assumptions and a more conservative electrical upper bound. The parallel input capacitors demonstrate bypass/storage layout; they do not set LED current or implement button debounce.

The two-layer board measures **30.48 × 20.32 mm**. Its process includes real library and pin/pad checks, routed connections, ground copper and stitching, applicable teardrops, native checks, and manufacturing-file inspection.

![Button LED PCB routing replay, including ground copper and finishing](/images/boardcraft/led-pcb-routing.gif)

The tutorial records **zero schematic DRC errors and warnings**, a final PCB DRC pass, and **11 applicable teardrops**. It also documents automation failures that were fixed, including pin/pad associations and library-property handling. An initially missed layout-stage gate was later performed on the actual layout before the routing replay; the original sequence is not retroactively described as having passed.

The board has not been manufactured or powered for the tutorial. Brightness, physical assembly, EMC, temperature, and lifetime remain unmeasured. The [full LED tutorial](https://github.com/mengqy2022/boardcraft/blob/2d158ebf775f1481e08437465d3ea98c47bfcb3a/docs/DEMO.md) includes exact parts, calculations, and demonstration limits.

## Example 02: a GD32E230 PCB comparison

The second example applies the method to an existing **GD32E230C8T6** development board. It preserves the original schematic and PCB, then works on a separate PCB copy with the same **53.34 × 22.86 mm** outline and locked USB, switch, and header baselines.

![GD32E230 original two-layer PCB and BoardCraft four-layer variant comparison](/images/boardcraft/gd32-pcb-comparison.gif)

_The original uses two layers; the BoardCraft copy uses four. Manufacturing conditions and cost differ, so this does not demonstrate that a two-layer implementation cannot work well._

The recorded netlist comparison covers **178 pin entries and 52 nonempty nets**. Four MCU bypass capacitors move from Bottom to Top, with per-pin supply and complete-return review. Suitable routes are reused; conflicts are rerouted locally. Inner2 carries no signals and provides nearby ground reference for bottom-layer USB routing.

| MCU power pin / capacitor | Original pad-to-pad straight-line distance | BoardCraft copy |
| ------------------------- | ------------------------------------------ | --------------- |
| U1.1 / C10                | 1.757 mm                                   | 1.146 mm        |
| U1.9 / C11                | 2.751 mm                                   | 1.548 mm        |
| U1.24 / C9                | 3.570 mm                                   | 1.810 mm        |
| U1.48 / C12               | 4.585 mm                                   | 3.129 mm        |

These are placement distances. The example separately records top-layer copper paths and checks ground connections against real copper polygons. It identifies further improvement opportunities; a shorter distance is not a measured decoupling result.

![GD32E230 BoardCraft placement and routing process replay](/images/boardcraft/gd32-pcb-routing.gif)

The final record reports **zero native DRC errors**, **53 applicable teardrops**, and exported four-layer Gerbers and drills. The two crystal circuits have mixed length changes, so the documentation does not claim every sensitive connection became shorter. Tight component gaps still need assembly-sequence and rework consideration.

USB routes are largely reused, with recorded D+ and D− lengths of approximately 15.947 mm and 14.514 mm. **90 Ω impedance has not been calculated from a confirmed manufacturing stackup**, and no eye diagram or TDR result is claimed. MLCC bias behavior, maximum external loading, LDO temperature, crystal behavior, ESD/EMC, and prototype operation also remain open.

The original circuit belongs to the [LCSC development-board project and its authors](https://oshwhub.com/li-chuang-kai-fa-ban/li-chuang-gd32e230-zui-xiao-xi-tong-ban). BoardCraft contributes the PCB comparison and explanation. The [complete case study](https://github.com/mengqy2022/boardcraft/blob/2d158ebf775f1481e08437465d3ea98c47bfcb3a/docs/GD32E230.md) preserves attribution and explains upstream licensing and platform-use conditions; the original circuit is not relicensed under the BoardCraft rules license.

## Layer types and manufacturing stay project-specific

The layer guidance is more precise than in the original article. A four-layer board may use four native **SIGNAL** layers, with copper zones providing power or ground. A native **PLANE** layer is required when the project explicitly asks for that EDA layer type. Actual types, networks, exported copper, and return paths must agree.

**PCB-P10** applies regular rectangular or simple orthogonal geometry to power regions on either SIGNAL or PLANE implementations. **PCB-P11** protects locked components, interfaces, the outline, and holes through structured before-and-after comparisons.

Differential geometry comes from the confirmed fabrication stackup and interface requirements. A fixed mil value alone cannot establish 90 Ω. **PCB-L22** likewise asks for the exact MLCC part and effective capacitance under working conditions. Silkscreen and independent same-net lands retain their own physical and manufacturing checks.

The v3 silkscreen, RF, and FPC references provide focused entry points. RF work needs the actual antenna, matching network, stackup, and measurements. Flexible-board work needs bending use, materials, coverlay, stiffeners, and manufacturer conditions. Neither example validates RF or FPC hardware.

## Tools have specific jobs

BoardCraft supplies rules and evidence workflows. Live editing and calculations come from separate tools:

| Tool                         | Role and documented verification scope                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| EasyEDA API / Bridge         | Read and edit the project, run native checks, and export; confirm document identity and read changes back.                                            |
| rftools-mcp                  | Model-bounded engineering/RF calculations; version 2.11.3 was exercised with local LED calculations.                                                  |
| drawio-engineering-mcp       | Editable explanatory diagrams; the pinned version produced stackup XML, while its SVG exporter returned a placeholder rather than a rendered diagram. |
| Ponytail / mattpocock-skills | Optional support for reuse, focused research, and clear agent instructions.                                                                           |

These tools are installed separately. Calculations, EDA editing, and explanatory diagrams retain their own evidence. The examples did not run remote RF simulations; optional plugins are not automatically installed or executed. The [tool guide](https://github.com/mengqy2022/boardcraft/blob/2d158ebf775f1481e08437465d3ea98c47bfcb3a/docs/TOOLS.md) collects upstream links and verified limitations.

## Install BoardCraft 3.0.1 and migrate the old name

The current **3.0.1 attachments are hosted on the existing [v3.0.0 release page](https://github.com/mengqy2022/boardcraft/releases/tag/v3.0.0)**. The original Git tag still points to the original 3.0.0 source. For the updated package, use `boardcraft-3.0.1.zip` or `boardcraft.zip`; its recorded source commit is [`6634e32`](https://github.com/mengqy2022/boardcraft/commit/6634e32b904c436169b7bb195605a0d4e700b7d9). `SOURCE_REVISION.json` and `SHA256SUMS.txt` identify the attachment edition separately from the tag.

For a first installation in Codex's default skill directory on Windows:

```powershell
$skillArchive = Join-Path $env:TEMP 'boardcraft-3.0.1.zip'
Invoke-WebRequest 'https://github.com/mengqy2022/boardcraft/releases/download/v3.0.0/boardcraft-3.0.1.zip' -OutFile $skillArchive
Get-FileHash -LiteralPath $skillArchive -Algorithm SHA256
# Compare with the matching filename in SHA256SUMS.txt from the same release page.
Expand-Archive -LiteralPath $skillArchive -DestinationPath "$env:USERPROFILE/.codex/skills"
```

The installed entry is `boardcraft/SKILL.md` beneath the host's recognized skill directory. For an upgrade, back up and move the old `embedded-hardware-design`, earlier `pcb-design-rules`, or existing `boardcraft` directory outside scanned locations before installing the replacement. Migrate intentional local changes and update active workspace instructions to **`$boardcraft`**. Preserve historical reports with their original names and versions.

Start a new session and check that the new name is visible. A task can begin with:

```text
Use $boardcraft for the current EasyEDA project.
Read the actual design, installed skill version, and mechanical constraints.
Classify components and nets with evidence, then list the applicable rules.
Review placement and each supply/return path before routing.
Deliver current-revision rule-gate, native DRC, and engineering-review evidence,
with unmeasured items listed explicitly.
```

Ordinary ChatGPT users should use **`BOARDCRAFT_CHATGPT.md`** with project constraints. The release page retains older attachment names for history; the new names identify the current edition. Python 3.10 or later is required only for auxiliary scripts. The [installation guide](https://github.com/mengqy2022/boardcraft/blob/2d158ebf775f1481e08437465d3ea98c47bfcb3a/docs/INSTALLATION.md) covers checksums and cross-computer use.

## Sources and verification scope

This update follows the 3.0.1 README, changelog, installation guide, routing and verification references, and two published case studies. The source register and `provenance.json` preserve origins and applicable boundaries. The article reorganizes and explains those records; the cover and GIFs are reused from the project with their original scope and attribution.

BoardCraft's rules and original helper code use [CC BY-SA 4.0](https://github.com/mengqy2022/boardcraft/blob/2d158ebf775f1481e08437465d3ea98c47bfcb3a/LICENSE), with attribution to the workplace_Embedded PCB standards contributors and retained credits, including SparkFun Electronics / jimblom. **CC BY-SA 4.0 applies to the reused BoardCraft cover and adapted rule summaries in place of the site's default article license.** The GD32 source circuit and associated upstream material retain their own rights and conditions, as documented in the case study.

Example results above are reported from the published records. Updating this article does not rerun EDA checks or hardware measurements. Design review, manufacturing inspection, prototype tests, and compliance conclusions remain tied to the revision and conditions actually examined.

::github{repo="mengqy2022/boardcraft"}
