---
title: "Embedded Hardware Design: Reusable Rules for AI-Assisted Schematics and PCBs"
published: 2026-11-14
description: "A portable hardware design skill that connects schematic readability, PCB layout and routing, per-pin power review, and revision-specific evidence, with practical installation steps and clear verification boundaries."
image: "./cover.svg"
tags: ["Embedded Systems", "PCB Design", "Schematic", "AI", "Codex", "Open Source"]
category: Hardware
draft: false
lang: en
---

When an AI assistant helps with a schematic or PCB, the difficult part is keeping the engineering context intact across many small changes. A cleaner page can still hide an incorrect pin mapping. A board with no DRC errors can still have poor assembly access or an unsuitable decoupling path. A report from yesterday can describe copper that no longer exists today.

**Embedded Hardware Design** collects the working rules, review templates, and evidence checks I use to keep that context visible. It covers schematic organization, PCB placement and routing, power and ground review, and the records needed to explain what has actually been checked. The package can be installed as a skill in a compatible AI agent or used as a merged rules document in an ordinary chat.

The project is available in the [embedded-hardware-design-skill repository](https://github.com/mengqy2022/embedded-hardware-design-skill). This article follows the [November 14, 2026 source snapshot](https://github.com/mengqy2022/embedded-hardware-design-skill/tree/3fae43d2e059a56f3952ffed2486288b2b035d38). Its source metadata is **2.4.2**, while the latest published stable release at the time of writing is **v2.4.1**. The newer rules described below are accumulated on `main` under **Unreleased**; the v2.4.1 release attachments do not include them.

## What the package provides

The repository is organized around design work rather than one large prompt. `SKILL.md` identifies the entry point and tells the agent which references to read for the current task. The detailed rules live under `references/`, reusable project records live under `assets/`, and Python helpers live under `scripts/`.

| Design activity | What the rules ask the designer to establish |
| --- | --- |
| New board or electrical change | Measurable requirements, interface contracts, calculations, risks, and acceptance evidence |
| Schematic work | Clear functional blocks, accurate symbols and pin mappings, readable labels, and controlled connectivity |
| PCB placement | Mechanical constraints, assembly space, connector access, sensitive channels, and power-loop feasibility |
| Power and ground | Per-pin supply requirements, suitable capacitors, and the complete supply and return paths |
| Routing and finishing | Reference continuity, interface-specific constraints, ground completion, DRC, and manufacturing checks |
| Delivery | Current revision identity, review coverage, evidence files, and explicit unresolved items |

The intended scope is common low-voltage embedded hardware. High-voltage, isolation, DDR, and RF designs need their own accurate device and system guidance. Values such as trace width, impedance, capacitance, and clearance come from the actual project, components, stackup, and manufacturing process.

The skill supplies a method. Live editing still needs an independently installed and connected EDA tool. For EasyEDA Pro, the documentation describes using separate API tooling; other EDA environments need their own supported editing, checking, and export mechanisms.

## Start with requirements that can be checked

The **HW-01–07** workflow connects an intended behavior to a design decision and then to evidence. A useful record follows this chain:

**Requirement → component or net → source and calculation → verification method → current evidence.**

For example, a power rail requirement needs a defined load range and allowable voltage range. Its record can point to the regulator, the relevant capacitor part numbers, a bounded calculation, and a planned load test. A successful calculation can close the calculation item while the physical load test remains pending.

This distinction keeps the record useful throughout development. Design review, manufacturing-file review, prototype measurement, and compliance or production validation have separate conclusions. A design can be delivered at a completed stage with its remaining tests clearly listed.

The workflow also scales with the change. A new board or interface change calls for the relevant engineering analysis. Moving a label or making a local silkscreen correction calls for checking the affected items. Existing valid project records can be reused with an explanation of why they still apply.

## Schematics should preserve meaning as they become easier to read

The schematic rules cover functional grouping, reading direction, symbol and pin consistency, spacing, labels, and visual overlap. Their purpose is to make a page easier to understand while preserving its electrical intent.

Several defaults reflect the way I prefer to review a design: keep the component body and its pins consistent, avoid overlapping text, use a single clear label along a continuous same-net connection, and frame functional sections. These are documented working preferences with stated boundaries. The EDA tool's actual net-label scope and connectivity behavior still need verification.

For a layout-only schematic cleanup, comparing the before-and-after netlists helps establish that the change stayed cosmetic. For an electrical modification, the affected networks, symbols, footprints, BOM, and any PCB synchronization need review together.

The EasyEDA automation reference also records reviewed methods and corrections from the upstream schematic enhancement skill. It calls attention to details that can be lost in bulk automation: accurate pin roles, required exposed-pad or ground connections, and the danger of deleting shared connectivity by region alone. The upstream example is a reference to evaluate for the current board.

## PCB review happens before routing and again before delivery

**PCB-V07** introduces two explicit review stages. At the **layout** stage, before large-scale routing, the design needs evidence that components can be assembled and that the supply and return paths are feasible. At the **final** stage, those checks are repeated against the actual routed copper and current manufacturing outputs.

The coverage is deliberately more detailed than a whole-board screenshot. Each component needs a review of its physical body, neighboring objects, relevant clearances, and assembly or tool access. Each power, regulator, or bias pin needs an appropriate capacitor relationship or a device-specific reason for an exception.

For a power pin, the final record should identify the capacitor and power domain, the path from the capacitor to the pin, and the return from the capacitor ground through valid ground copper or vias to the IC ground. A nearby ground via is useful geometric information, but its distance alone does not describe the complete return path.

The usual sequence is to establish placement and critical loops, pass the layout review, route constrained and ordinary networks, complete ground copper and stitching, and then perform the finishing checks. The documented finishing sequence includes a first complete zero-error DRC, applicable teardrops, a copper refill, and another complete DRC before export. Actual Gerbers, drills, and the required assembly files then receive their own review.

### What the evidence checker can establish

The stage review template, `assets/PCB_STAGE_REVIEW.json`, links the report to the current PCB source, an inventory, and evidence artifacts with SHA-256 hashes. The inventory lists the expected components and power pins; the report carries the corresponding review records.

From a checkout of the skill repository, the helper is invoked with the intended stage explicitly:

```powershell
python scripts/check_pcb_stage.py review/PCB_STAGE_LAYOUT.json --pcb exports/current.epcb --stage layout
python scripts/check_pcb_stage.py review/PCB_STAGE_FINAL.json --pcb exports/current.epcb --stage final
```

These paths are examples to replace with the project's actual files. The checker verifies required entries, coverage against the supplied inventory, evidence-file presence and hashes, and consistency with the supplied PCB file and stage. Missing entries, changed artifacts, or an incorrect stage can block the review.

The input still comes from real tool output and human or agent review. The helper does not inspect copper geometry, run native DRC, prove that the inventory classified every power pin correctly, or judge whether a written conclusion is true. Refreshing a hash after an edit also requires reviewing the affected design and evidence. The [stage-review reference](https://github.com/mengqy2022/embedded-hardware-design-skill/blob/3fae43d2e059a56f3952ffed2486288b2b035d38/references/pcb-stage-review.md) describes these boundaries in detail.

## Rules remain tied to the actual device and board

One recurring theme is to keep a convenient default from turning into a universal electrical rule.

For MLCC selection, **PCB-L22** asks for the exact manufacturer part number and effective capacitance under the actual bias, temperature, tolerance, and aging conditions. Package names such as 0402 or 0603 do not establish a universal maximum usable capacitance. A nominal value also does not establish the capacitance available in operation.

For decoupling, the rules distinguish the parallel electrical topology from the physical routing arrangement. A preference for arranging larger and smaller capacitors in a particular order must remain compatible with the device's guidance, low-inductance loops, and stability requirements. The same care applies to trace-width defaults: a familiar width still needs a project-specific current and manufacturing basis.

The [source register](https://github.com/mengqy2022/embedded-hardware-design-skill/blob/3fae43d2e059a56f3952ffed2486288b2b035d38/references/sources.md) records sources, reviewed scope, and limits. `provenance.json` records version and origin information. Those records support traceability; they do not certify every future design that adopts the rules.

## The November source updates

The current source adds several practical refinements that remain outside the v2.4.1 release attachments:

| Rule | Current source guidance | Applicability |
| --- | --- | --- |
| PCB-V02 | Use Arial for PCB silkscreen and visible component text; size characters and strokes for the available space and process; clear holes and mask openings; prefer readable placement away from same-side trace projections. | The font and placement preference are workspace defaults. Manufacturing readability and clearance still need checking. |
| PCB-V04 | Keep independent same-net solder lands separate and connect them with compliant copper. | Review physical assembly geometry, including same-net objects; distinguish independent pads from a manufacturer's compound physical land. |
| PCB-P09 | Choose four-layer usage from the actual differential routing layer and return path. Bottom-layer differential routing preferably has a continuous adjacent inner GND reference. | This depends on the board's real stackup and channel. It provides no fixed impedance guarantee. |
| PCB-P10 | Prefer rectangular or simple orthogonal power regions on native inner plane layers, with documented regular subdivisions for necessary mechanical clearances. | Check clearance, minimum copper width, connectivity, return paths, and the exported Gerbers. |

These changes came from documented design review and user feedback. Their presence in the rule set does not upgrade an earlier board's validation status.

## Installing the stable package

For a reproducible starting point, use a fixed [v2.4.1 release](https://github.com/mengqy2022/embedded-hardware-design-skill/releases/tag/v2.4.1). The release includes the installable ZIP, a merged chat rules document, and `SHA256SUMS.txt`.

For a first installation in Codex's default skill directory on Windows:

```powershell
$skillArchive = Join-Path $env:TEMP 'embedded-hardware-design-2.4.1.zip'
Invoke-WebRequest 'https://github.com/mengqy2022/embedded-hardware-design-skill/releases/download/v2.4.1/embedded-hardware-design-2.4.1.zip' -OutFile $skillArchive
Get-FileHash -LiteralPath $skillArchive -Algorithm SHA256
# Compare the result with SHA256SUMS.txt from the same release before extracting.
Expand-Archive -LiteralPath $skillArchive -DestinationPath "$env:USERPROFILE/.codex/skills"
```

The installed entry should be `embedded-hardware-design/SKILL.md` beneath the directory recognized by the host. If the host uses a different skill location, use that location. Start a new session and confirm that the skill is visible.

For an upgrade, first back up and move the existing directory outside the host's scanned skill directories, then install the replacement and migrate intentional local changes. The earlier name `pcb-design-rules` also needs to be moved out of the scanned directory to avoid loading duplicate rules. The [installation guide](https://github.com/mengqy2022/embedded-hardware-design-skill/blob/3fae43d2e059a56f3952ffed2486288b2b035d38/docs/INSTALLATION.md) explains the full process.

The GitHub **Download ZIP** archive used as the source for this article is a repository snapshot. Its outer folder and contents differ from the packaged release, so the installation commands above deliberately download the release asset. To evaluate the newer source rules, use the recorded source snapshot and keep that choice visible in the project records.

Ordinary ChatGPT users can upload the release's `HARDWARE_DESIGN_RULES_CHATGPT.md` with project constraints and relevant engineering files. File upload provides context for the task. Live EDA editing and native checks still require connected tools. Python 3.10 or later is needed only when running the auxiliary scripts.

## Making use of the rules visible

An explicit task can start with:

```text
Use $embedded-hardware-design for this schematic and PCB task.
Read the current project, installed skill version, constraints, and applicable references first.
Preserve locked mechanical objects and existing electrical intent unless the requested change affects them.
At delivery, list completed checks, unresolved items, and evidence for the current revision.
```

A workspace instruction can make this the default for relevant hardware tasks. The package also allows implicit invocation in compatible hosts. The observable check is the actual task behavior: the assistant should identify the version and references it read, apply the relevant rules, and return evidence for the work it performed.

Configuration alone cannot establish that every future task will follow the workflow. The project therefore keeps the usage announcement and the engineering result separate: one identifies the method in use, while the other records the checks that were completed.

## Source, attribution, and verification scope

This article is an original overview based on the repository README, installation guide, changelog, provenance metadata, and the applicable workflow and review references. The cover is reused from the repository. The rules and original helper code are published under [CC BY-SA 4.0](https://github.com/mengqy2022/embedded-hardware-design-skill/blob/3fae43d2e059a56f3952ffed2486288b2b035d38/LICENSE), with attribution to the workplace_Embedded PCB standards contributors. The repository also preserves attribution to SparkFun Electronics / jimblom and other referenced sources. This overview reorganizes and explains the material; vendor documents and third-party plugins retain their own rights. For the reused cover and adapted rule summaries on this page, **CC BY-SA 4.0 applies in place of the site's default article license**.

The source snapshot and stable-release identity were checked for this article. No EDA project was modified, and no board-level ERC, DRC, SI/PI, EMC, or physical measurements were performed for the article. The repository provides a way to keep those future checks organized and reviewable, with their conclusions tied to the revision that was actually examined.
