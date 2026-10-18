---
title: "ESP32 Touch Monitor: PC Telemetry, Window Streaming, and Local Tools"
published: 2026-10-15
updated: 2026-10-15
description: "An engineering log for a 320×240 ESP32 touch terminal that shows PC telemetry, Codex or Claude Code usage, and selected PC windows over USB, with local games, inventory, vocabulary, and system tools."
image: "./front-monitor.jpg"
tags: ["ESP32", "LVGL", "Embedded Systems", "Touch UI", "PC Monitor", "PC Screen"]
category: Hardware
draft: false
lang: en
---

Some information belongs in a desktop window. Other information is useful when it stays in view. This project takes the second approach: a small ESP32 touch terminal continuously shows the computer's CPU, GPU, memory, temperatures, and local Codex or Claude Code usage for the current day.

It is not a remote desktop that mirrors the computer screen. The PC samples and summarizes numeric data; the device draws its own interface, handles touch input, and runs local tools. Even when the Windows monitor is paused, the games, Wi-Fi page, SD-card tools, and vocabulary lab remain available on the device.

![The finished device showing the PC monitor and Codex dashboard](./front-monitor.jpg)

## The finished device

The prototype is a landscape 320×240 LCD mounted in a black enclosure. The home screen compresses the important information into a few readable cards: the top bar shows the date, weekday, Wi-Fi state, and clock; three circular gauges show CPU, GPU, and RAM; the AI usage card shows either Codex or Claude Code tokens and an estimated CNY cost; the bottom row opens GAME, SYSTEM, and OTHER. The SYSTEM menu also contains PC SCREEN, a low-rate viewer for one selected PC window.

The screen has three independent data paths. PC telemetry is sampled about once per second and becomes offline after five seconds without a new `STAT` packet. Codex and Claude Code usage are recomputed about every five seconds and each becomes `NO DATA` after 90 seconds without a fresh packet or when the host date does not match the device date. PC SCREEN frames share the same serial link and can delay telemetry while a frame is transferred. “Online” is therefore a time-limited state, rather than a permanent result from the last successful connection.

![The enclosure and front panel with the display off](./enclosure-view.jpg)

## A small system, rather than a screenshot

The project has three layers: the firmware on the device, a Windows companion program, and local data sources on the computer. The new release adds a fourth practical path inside the same link: a selected application window is captured, downscaled, sent as a compact frame, and controlled through touch gestures.

![System architecture: Windows gathers PC metrics and local usage, sends numeric packets over USB, and the ESP32 renders the dashboard and runs local tools](./system-architecture.svg)

`pc_monitor_host.py` reads the metrics that Windows can provide and sends `PC:STAT`, `PC:TIME`, `PC:TZOFF`, and `PC:NAME` through the CH340 serial bridge. The host also reads Codex and Claude Code logs, sends both usage caches, and keeps the selected provider on the device. The PC SCREEN worker captures only the window explicitly chosen in the desktop GUI. On the device, `file_xfer.c` is the only UART reader; it dispatches `PC:`, `SCREEN:`, and `FILE:` messages to their respective services.

That boundary is deliberate. AI usage packets contain no prompts, replies, account identifiers, or API keys, and the program does not query a cloud billing service. PC SCREEN is different: when explicitly enabled, the selected window's pixels and touch commands do cross the USB link. The host validates the selected window identity and does not automatically switch to another target, but the operator should still avoid sharing private content.

## Hardware platform: the repository name is not the chip target

The project is named `Esp32-touch`, while the current physical validation uses an **ESP32-D0WD-V3** and the firmware target is the classic `esp32`, not `esp32s3`. The build uses ESP-IDF 5.5.4 and LVGL 8.4. This alignment between the actual chip, target, and display driver matters when reproducing the project.

| Subsystem | Part or interface | Purpose |
| --- | --- | --- |
| Controller | ESP32-D0WD-V3 | FreeRTOS, LVGL, and local applications |
| Display | ILI9341, 320×240, landscape | Dashboard and application rendering |
| Touch | XPT2046 resistive touch controller | Touch input and three-point affine calibration |
| Storage | SPI microSD | Inventory, BOM, vocabulary, and study progress |
| USB | CH340 USB-UART bridge | Flashing, telemetry, and file transfer |
| Indicator | Common-anode RGB LED | Startup, scan, and error states |

The display has its own SPI bus, the touch controller uses software SPI, and the SD card uses another SPI bus. The main pin assignments are below; `main/board_pins.h` remains the authoritative reference when changing the board.

| Function | GPIO |
| --- | --- |
| LCD SPI: SCK / MOSI / MISO / CS / DC / BL | 14 / 13 / 12 / 15 / 2 / 21 |
| XPT2046: SCK / MOSI / MISO / CS / IRQ | 25 / 32 / 39 / 33 / 36 |
| microSD: SCK / MISO / MOSI / CS | 18 / 19 / 23 / 5 |
| RGB LED: R / G / B | 17 / 22 / 16 |

The LCD runs in landscape RGB565 mode. LVGL renders into DMA-capable internal buffers, and the ILI9341 driver sends larger SPI transactions instead of splitting every small widget into many transfers.

## Touch calibration: turning ADC readings into reliable taps

XPT2046 reports raw ADC coordinates, not screen pixels. On first boot, or after calibration data is cleared, the device displays three crosshairs, collects three raw coordinate pairs, and solves an affine transform from touch space to screen space. The result is stored in NVS and loaded on later boots.

The SYSTEM menu provides `CALIBRATE`, and holding the BOOT button for about two seconds starts the same process. During calibration the LVGL task is suspended so the bare-metal LCD driver owns the SPI bus; LVGL resumes after the result is saved. This keeps calibration and screen refresh from competing for the same bus.

## The home screen: important information at a glance

The home page is a continuously updating dashboard rather than a scrolling list:

- The top bar shows the device date, weekday, Wi-Fi state, and clock. Time can arrive over USB, while Wi-Fi SNTP remains available.
- CPU, GPU, and RAM use circular gauges. Temperatures and used/total memory sit below the gauges. If the host cannot provide a sensor, the display shows `--` instead of pretending the value is zero.
- The AI card lets the user choose CODEX or CLAUDE on the device. It shows that provider's today's input plus output tokens. The choice is saved in NVS and is not overwritten by the host's normal refresh or reconnect packets.
- Costs appear as an estimate such as `~¥12.34`. If a model price or required token breakdown is missing, the display stays at `~¥--` while the token count remains available.

The three bottom categories keep the 240-pixel-high home page from becoming a crowded menu. The current home page stays visible while idle, so the monitor remains in view during normal desktop use. Daily goals, progress bars, and the old combined-source display have been removed from the current system.

## Three categories for daily use

### GAME: useful even without the PC

GAME contains SUDOKU, 2048, FLAPPY, SNAKE, and BREAKOUT. These run entirely on the device and do not require the PC, Wi-Fi, or SD card. Every game uses the same touch event and back-navigation model, with II to pause, GO to continue, and NEW to restart; Sudoku uses NEW to load another puzzle.

### SYSTEM: maintenance as an interface

SYSTEM provides PC SCREEN, SD CHECK, SYSTEM INFO, WIFI, CALIBRATE, and PC DETAILS.

- **SD CHECK** shows mount state, capacity, and scan results, with manual and AUTO scanning.
- **SYSTEM INFO** exposes chip, memory, uptime, and network details for diagnosis.
- **WIFI** scans access points, accepts a password, connects or disconnects, and stores credentials in NVS.
- **CALIBRATE** asks for confirmation before changing the touch transform.
- **PC DETAILS** gives a larger clock and a more complete view of CPU/GPU/RAM, temperatures, time source, and host state.

### PC SCREEN: a low-rate window viewer

PC SCREEN shares one selected Windows application window rather than the whole desktop. In the desktop GUI, search by title or process, choose a window, and click **Share selected window**. On the device, open **SYSTEM → PC SCREEN**. Switching the selection in the GUI reloads the target without reopening the serial port; returning to another device page stops frame delivery.

A light tap sends a left click to the selected window and records the location. The zoom control cycles through **2X → 4X → 8X → FIT** around the last touched point. At a zoom level, dragging pans the view; at FIT, a press-and-release gesture sends a mouse action. **UP / DN** sends a wheel step, which is useful for reading long ChatGPT conversations. Selecting `cloudmusic.exe` changes the page to **PREV / PLAY / NEXT / VOL- / VOL+** media controls instead of raster frames.

The wire image is 320×176 RGB332 with run-length encoding. The no-PSRAM ESP32 keeps a 256×140 indexed cache plus a 256-entry palette, then scales it to the display region. This saves RAM, but the 115200-baud link is intentionally a low-rate control view: a worst-case frame takes close to ten seconds, small text needs zoom, and it is not suitable for video or fast games. The host accepts input only for the latest acknowledged window session and frame, and black letterbox margins do not accept clicks.

SD scanning runs in its own FreeRTOS task. The RGB LED is blue while scanning, green on success, and red on failure; the UI task remains responsive instead of blocking while a directory is inspected.

### OTHER: local data and learning tools

OTHER contains INVENTORY and VOCAB LAB. Inventory data lives on the SD card in UTF-8 `PRODUCT_NO,MODEL,QTY` records. The device can filter, increment, decrement, and delete entries; the companion serial tools can upload supported BOM or purchasing CSV files.

VOCAB LAB is an offline-first vocabulary workspace with book browsing, study cards, spaced review, touch dictation, and daily plans. Books are read as streams with an index instead of loading an entire file into RAM. Handwriting is processed as lightweight local strokes and is not uploaded to a cloud OCR service.

## One serial link with clear service boundaries

The device and Windows program use an ASCII line protocol at 115200 baud. The main telemetry and provider-selection packets are:

```text
PC:STAT|cpu|gpu|cpu_C|gpu_C|mem|used_MB|total_MB
PC:USAGE|source|today_tokens|0|YYYYMMDD|estimated_CNY_fen
PC:AI|source
PC:TIME|unix_seconds
PC:TZOFF|minutes
PC:NAME|hostname
```

`PC:STAT` and each provider's `PC:USAGE` cache have independent validity windows: a fresh AI packet does not make an expired CPU sample online again. The device's `PC:AI` selection is persisted separately, so normal telemetry cannot silently switch the visible provider. The old `PC:CODEX` packet remains supported for compatibility, with the former daily-goal slot ignored.

The same UART also carries `SCREEN:?`, `SCREEN:OPEN`, `SCREEN:CLOSE`, `SCREEN:APP`, `SCREEN:FRAME`, `SCREEN:STATUS`, and input messages, as well as `FILE:LIST`, `FILE:PUT`, `FILE:GET`, and `FILE:DEL`. A frame announces its session, number, encoded length, and FNV-1a checksum, waits for `SCREEN:READY`, then sends exactly the RLE payload. The device confirms `SCREEN:OK` only after validation. The shared reader processes every complete line in a read chunk and retains a partial line across reads; binary frame and file payloads never interleave with other host writes.

The selected-window protocol also protects against stale control: the host binds input to the latest acknowledged session and frame, checks the window identity and viewport, and rejects old input. Capture runs in a separate process with a timeout, so a hung application cannot block future window switching. The trade-off is visible in daily use: a maximum frame is about 112,640 bytes and takes roughly 9.78 seconds on the wire, with measured display confirmation around 10.17 seconds.

Only one program should own the serial port at a time. Pause the Windows monitor before flashing, opening a serial console, or using an inventory tool, then resume it when the operation is complete. PC SCREEN and telemetry share the same UART, so frame transfers can delay normal samples.

## AI usage and cost are explainable estimates

Codex and Claude Code usage come from their local session logs and are grouped by the computer's local calendar date. The readers parse model and usage fields and keep incremental offsets to avoid counting the same snapshot twice. They do not transmit prompt text, response text, credentials, or API keys to the device.

The amount uses the locally configured `codex_prices.json`: normal input, cached input, cache writes, and output are priced separately and then converted to CNY. The user owns the rates and exchange rate; the program does not connect to an official billing endpoint and does not claim to show plan balance. If the model is unknown, the breakdown is incomplete, or the price file is invalid, the amount remains unavailable instead of presenting a misleading partial total. The device remembers whether CODEX or CLAUDE is selected, while the host continues sending both independent caches.

## Windows companion: one dark control center

The project includes `ESP32TouchDashboard.exe` version **2026.10.18.4**. It opens a dark control center with Device, PC SCREEN, AI Usage, and Settings/Logs pages. Choose automatic or manual COM selection, save the port, and click **Connect / Resume monitoring**. The GUI can be used directly; `--install` additionally creates a per-user installation, Start Menu entry, and login startup. With no device attached, the background process waits without opening a nonexistent port. When the CH340 device appears, it identifies the port and starts sending telemetry.

The control center can enable or disable startup, pause or resume monitoring, check the COM link with `FILE:PING`, inspect CH340 driver state, open the price configuration, and view rotating logs. Pausing releases the serial port and the paused state survives the next login. If several identical USB-UART devices are connected, VID/PID alone cannot prove which one is the target, so the agent waits for a resolvable candidate instead of choosing randomly. Closing the GUI no longer stops background capture or leaves the system at `Switching window...`; the 2026.10.18.4 package gives the background process its own PyInstaller extraction lifecycle.

For PC SCREEN, search windows by title or process, share one target, and open **SYSTEM → PC SCREEN** on the device. The GUI can switch targets without reopening the UART. A closed target must be selected again, and the host does not automatically redirect input to another application. Ordinary user permissions are recommended for both the target application and the Dashboard; elevated or GPU-rendered windows, minimized windows, and some Qt/OpenGL applications may still capture black frames or ignore input.

Host sensors depend on Windows and its drivers. The current implementation mainly uses NVIDIA NVML for GPU data, and CPU temperature can be unavailable when the computer has no usable WMI provider. Those are sensor limits, not display failures.

## Firmware decisions that keep the device responsive

`app_main()` initializes NVS, LCD, touch, and SD before starting Wi-Fi and LVGL. The SD card is mounted early, before Wi-Fi and the UI reserve more internal heap, and touch calibration is completed before the LVGL task begins. PC monitoring, file transfer, Wi-Fi observation, and the BOOT long-press task start afterward.

LVGL objects are accessed only from the LVGL task; other tasks post UI commands through a queue. Slow filesystem and network operations stay outside the drawing loop. The PC monitor updates a protected state snapshot, and the UI reads that snapshot rather than changing widgets from the UART task. PC SCREEN follows the same ownership rule: incoming frames are decoded into an indexed cache, then consumed by the LVGL thread. The cache is 256×140 plus a 256-entry palette, about 36,864 bytes, rather than a full RGB framebuffer.

These choices prioritize sustained use on a small screen: stale data is explicit, missing values remain honest, long operations do not block touch input, and the serial port has one well-defined reader.

## Build and reproduce

The firmware uses ESP-IDF 5.5.4 with the `esp32` target:

```powershell
idf.py set-target esp32
idf.py build
idf.py -p COM5 flash
```

`COM5` is only an example. The Windows companion can be used as the repository's EXE, or built in a Python 3.11 x64 environment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build_exe.ps1
```

The engineering repository contains the complete [Chinese README](https://github.com/mengqy2022/Esp32-touch/blob/main/README_CN.md), [hardware notes](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/HARDWARE.md), [architecture notes](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/ARCHITECTURE.md), [serial protocol](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/PROTOCOL.md), and [validation record](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/VALIDATION.md). The packaged release also includes a [complete PC SCREEN firmware guide](https://github.com/mengqy2022/Esp32-touch/blob/main/dist/PC_SCREEN_FIRMWARE_CN.md).

## Validation and limits

The latest engineering record covers firmware build and flashing, the home-page data path, independent Codex and Claude usage caches, PC SCREEN frame validation, window capture and input tests, Windows packaging and installation, startup registration, GUI-close background capture, and pause/resume behavior. ChatGPT and GitHub Desktop produced non-black captures, and the user confirmed ChatGPT on the device. Yomi running elevated still fails capture and needs a normal-permission retest; some minimized or GPU windows remain application-dependent. The five game engines pass logic checks but still need per-game physical touch and visual acceptance. Full reboot, hot-plug, multiple identical devices, sleep/wake, real Claude billing comparison, and 24-hour stability tests remain later acceptance work.

This makes the device useful today while leaving its limits visible. The project covers a complete path from hardware interfaces, touch calibration, LVGL screens, and FreeRTOS tasks to Windows collection and a serial protocol, without presenting unmeasured laboratory results as product specifications.

## Closing thoughts

The valuable part of this project is not simply lighting a small screen. It is the clean division between the computer, the embedded device, and local data: the computer samples, the serial link transports, and the ESP32 renders and interacts. Games, inventory, and vocabulary tools give the device a life of its own when the computer is away.

The result is a tool screen that can stay on the desk without interrupting the main workflow. A glance tells you whether the PC is online, whether resources are under pressure, how far today's AI usage has progressed, and which local tool to open next. When a full desktop window is useful, PC SCREEN adds a deliberately slow but practical touch-controlled view without turning the ESP32 into a video receiver.

::github{repo="mengqy2022/Esp32-touch"}
