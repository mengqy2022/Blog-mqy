---
title: "ESP32 Touch Monitor: PC Telemetry, Window Streaming, and Local Tools"
published: 2026-10-15
updated: 2026-11-01
description: "An illustrated engineering log for a 320×240 ESP32 touch terminal: PC telemetry, daily model names and cost breakdowns for Codex and Claude Code, selected-window streaming, and Salary Cat with work calendars and eight animated cats."
image: "./front-monitor.jpg"
tags: ["ESP32", "LVGL", "Embedded Systems", "Touch UI", "PC Monitor", "PC Screen"]
category: Hardware
draft: false
lang: en
---

Some information belongs in a desktop window. Other information is useful when it stays in view. This project takes the second approach: a small ESP32 touch terminal continuously shows the computer's CPU, GPU, memory, temperatures, and local Codex or Claude Code usage for the current day.

The home dashboard is drawn on the device from compact data packets. A separate PC SCREEN page can stream one selected Windows application and send touch input back. Alongside these connected features, the ESP32 runs its own games, inventory, vocabulary workspace, and now **Salary Cat**: a local earnings dashboard that turns a work schedule into a daily progress display, accompanied by an animated cat.

This log follows the **November 1, 2026 release**, with companion version **2026.11.01.2** and matching firmware. The update adds a desktop breakdown of today's model usage and estimated costs, synchronizes model names to the device, and includes Salary Cat's weekend animations and Friday color fix. **The published EXE and full firmware downloads now include these features**, so Salary Cat no longer requires a source build.

![Earlier physical prototype showing the PC monitor and Codex dashboard](./front-monitor.jpg)

*Physical prototype from an earlier revision. Its AI goal/progress display predates the current independent CODEX and CLAUDE cards; the screen examples below show the updated interface.*

## The finished device

The prototype is a landscape 320×240 LCD mounted in a black enclosure. The home screen compresses the important information into a few readable cards: the top bar shows the date, weekday, Wi-Fi state, and clock; three circular gauges show CPU, GPU, and RAM; the AI usage card shows either Codex or Claude Code tokens, an estimated CNY cost, and the models used today; the bottom row opens GAME, SYSTEM, and OTHER. The SYSTEM menu also contains PC SCREEN, a low-rate viewer for one selected PC window.

The screen has three independent data paths. PC telemetry is sampled about once per second and becomes offline after five seconds without a new `STAT` packet. Codex and Claude Code usage are recomputed about every five seconds and each becomes `NO DATA` after 90 seconds without a fresh packet or when the host date does not match the device date. PC SCREEN frames share the same serial link and can delay telemetry while a frame is transferred. “Online” is therefore a time-limited state, rather than a permanent result from the last successful connection.

![The enclosure and front panel with the display off](./enclosure-view.jpg)

## How the system fits together

The project has three layers: the firmware on the device, a Windows companion program, and local data sources on the computer. Telemetry, AI usage, selected-window frames, file transfers, and work-calendar updates share one USB serial connection. Local tools keep their own state on the device; Salary Cat needs a valid clock and a saved schedule, but does not need a continuous PC connection.

![System architecture: Windows sends telemetry, usage, selected-window frames, files, time, and calendar updates over USB; the ESP32 renders LVGL pages and runs local tools with NVS and SD storage](./system-architecture.svg)

`pc_monitor_host.py` reads the metrics that Windows can provide and sends `PC:STAT`, `PC:TIME`, `PC:TZOFF`, and `PC:NAME` through the CH340 serial bridge. The host also reads Codex and Claude Code logs and sends both usage caches; the device retains the user's provider choice. The PC SCREEN worker captures only the window explicitly chosen in the desktop GUI. The updated companion can also validate and synchronize a yearly work calendar. On the device, `file_xfer.c` is the only UART reader; it dispatches `PC:`, `SCREEN:`, `FILE:`, and `SALARY:` messages to their respective services.

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
- The AI card lets the user choose CODEX or CLAUDE on the device. Tokens and estimated cost are totals across that provider's models used today. The choice is saved in NVS and is not overwritten by the host's normal refresh or reconnect packets.
- Above the amount, a model-name strip follows the selected provider. Long names scroll horizontally; missing or expired names show `MODELS --`. The list describes today's local usage, including completed sessions and subagents, rather than models currently running at the same time.
- Costs appear as an estimate such as `~¥12.34`. If a model price or required token breakdown is missing, the display stays at `~¥--` while the token count remains available.

The three bottom categories keep the 240-pixel-high home page from becoming a crowded menu. The current home page stays visible while idle, so the monitor remains in view during normal desktop use. Daily goals, progress bars, and the old combined-source display have been removed from the current system.

| CODEX selected | CLAUDE selected |
| --- | --- |
| ![Current home screen with CODEX selected and scrolling daily model names](./images/device/home-models.png) | ![Current home screen with CLAUDE selected and its daily model name](./images/device/home-models-claude.png) |

*Device screen examples in this article are rendered from the actual C interface with LVGL 8.4 on a computer, at the native 320×240 resolution. They are interface examples, not device photographs. Home and menu examples use October 20, 2026 at 10:30 with synthetic PC and AI values; the model strip is captured at one point in its scroll. Salary Cat examples use the dates described in their captions. Chinese labels match the firmware; captions explain them in English. The desktop AI Usage image below comes from a real GUI test window with a separate synthetic dataset. These images do not establish physical touch behavior or settings persistence after a restart.*

## Three categories for daily use

| GAME: five games | SYSTEM: six utilities | OTHER: three tools |
| --- | --- | --- |
| ![GAME menu with Sudoku, 2048, Flappy, Snake, and Breakout](./images/device/game.png) | ![SYSTEM menu with PC Screen, SD Check, System Info, WiFi, Calibrate, and PC Details](./images/device/system.png) | ![OTHER menu with Inventory, Vocab Lab, and Salary Cat](./images/device/other.png) |

### GAME: useful even without the PC

GAME contains SUDOKU, 2048, FLAPPY, SNAKE, and BREAKOUT. These run entirely on the device and do not require the PC, Wi-Fi, or SD card. Every game uses the same touch event and back-navigation model, with II to pause, GO to continue, and NEW to restart; Sudoku uses NEW to load another puzzle.

### SYSTEM: maintenance as an interface

SYSTEM provides PC SCREEN, SD CHECK, SYSTEM INFO, WIFI, CALIBRATE, and PC DETAILS.

- **SD CHECK** shows mount state, capacity, and scan results, with manual and AUTO scanning.
- **SYSTEM INFO** exposes chip, memory, uptime, and network details for diagnosis.
- **WIFI** scans access points, accepts a password, connects or disconnects, and stores credentials in NVS.
- **CALIBRATE** asks for confirmation before changing the touch transform.
- **PC DETAILS** gives a larger clock and a more complete view of CPU/GPU/RAM, temperatures, time source, and host state.

SD scanning runs in its own FreeRTOS task. The RGB LED is blue while scanning, green on success, and red on failure; the UI task remains responsive instead of blocking while a directory is inspected.

### PC SCREEN: a low-rate window viewer

PC SCREEN shares one selected Windows application window rather than the whole desktop. In the desktop GUI, search by title or process, choose a window, and click **Share selected window**. On the device, open **SYSTEM → PC SCREEN**. Switching the selection in the GUI reloads the target without reopening the serial port; returning to another device page stops frame delivery.

A light tap sends a left click to the selected window and records the location. The zoom control cycles through **2X → 4X → 8X → FIT** around the last touched point. At a zoom level, dragging pans the view; at FIT, a press-and-release gesture sends a mouse action. **UP / DN** sends a wheel step, which is useful for reading long ChatGPT conversations. Selecting `cloudmusic.exe` changes the page to **PREV / PLAY / NEXT / VOL- / VOL+** media controls instead of raster frames.

The wire image is 320×176 RGB332 with run-length encoding. The no-PSRAM ESP32 keeps a 256×140 indexed cache plus a 256-entry palette, then scales it to the display region. This saves RAM, but the 115200-baud link is intentionally a low-rate control view: a worst-case frame takes close to ten seconds, small text needs zoom, and it is not suitable for video or fast games. The host accepts input only for the latest acknowledged window session and frame, and black letterbox margins do not accept clicks.

### OTHER: local data and learning tools

OTHER contains INVENTORY, VOCAB LAB, and SALARY CAT. Inventory data lives on the SD card in UTF-8 `PRODUCT_NO,MODEL,QTY` records. The device can filter, increment, decrement, and delete entries; the companion serial tools can upload supported BOM or purchasing CSV files.

VOCAB LAB is an offline-first vocabulary workspace with book browsing, study cards, spaced review, touch dictation, and daily plans. Books are read as streams with an index instead of loading an entire file into RAM. Handwriting is processed as lightweight local strokes and is not uploaded to a cloud OCR service.

## Salary Cat: a workday made visible

Open **OTHER → SALARY CAT** to see a monochrome dashboard: an animated cat on the left, a large earnings estimate on the right, and work progress and a countdown below. It shows elapsed scheduled work time, the month's planned working days, and the next shift boundary: start, lunch break, afternoon return, or finish.

![Salary Cat animated dashboard with today's earnings, work time, progress, and countdown](./images/salary-cat/animated-dashboard.gif)

*A looping preview sampled from the LVGL renderer. It illustrates the animation and layout; its playback rate is not a measurement of the physical display.*

Seven day-specific cats give the page a small change each day, with an eighth animation for national weekend makeup shifts. The animation keeps playing while this page is open, including breaks, evenings, and rest days. Opening another page releases its playback buffer and timer. Salary Cat never takes over an active game or PC SCREEN session. The original home page remains the default at boot, with Salary Cat available as an optional startup page.

### Weekend cats and a Friday color fix

Saturday and Sunday now have their own cats. A separate makeup-workday cat appears only when the enabled, covered China calendar explicitly marks a weekend date as work. A personal rest override takes priority. A personal extra-work date or a recurring weekend shift keeps the cat for that day of the week; disabling the China calendar also removes the special makeup selection.

| Saturday rest day | Sunday rest day | National weekend makeup shift |
| --- | --- | --- |
| ![Saturday cat with zero earnings on a rest day](./images/salary-cat/saturday-animated.gif) | ![Sunday cat with zero earnings on a rest day](./images/salary-cat/sunday-animated.gif) | ![Special makeup-workday cat with scheduled earnings](./images/salary-cat/makeup-animated.gif) |

*Actual LVGL page previews with fixed examples for October 17, October 18, and October 10, respectively. Ordinary weekend rest days show zero daily earnings; the October 10 makeup shift accumulates scheduled earnings. These loops illustrate the selection and layout, not physical display frame rates.*

The October 30 fix also preserves Friday's white body as it enters and leaves the image boundary. The asset converter now closes the open edge before removing the white background, so the body is no longer mistaken for background. The motion, frame timings, and 4.30-second loop stay the same; the other seven animations are unchanged by this fix.

![Friday cat entering and leaving the panel with its white body preserved](./images/salary-cat/friday-animated.gif)

*A complete Friday loop rendered by LVGL, using October 30 at 10:30 as a fixed example. The GIF contains 30 frames after identical images are merged, covering the firmware animation's full 33-frame, 4.30-second cycle.*

### Three amounts, one tap

Tap the large amount to cycle through **today earned → month estimate → annual estimate**. Each view uses the same saved salary and schedule.

| Today earned | Month estimate | Annual estimate |
| --- | --- | --- |
| ![Salary Cat today estimate of 83.33 yuan](./images/salary-cat/today.png) | ![Salary Cat month estimate of 3083.33 yuan](./images/salary-cat/month.png) | ![Salary Cat annual estimate of 72000 yuan](./images/salary-cat/annual.png) |

The example uses **¥6,000 per month**, two shifts of **09:00–12:00 and 14:00–17:00**, and **18 working days** in October 2026. At 10:30 on October 20, 1.5 scheduled hours have elapsed today. The display therefore shows **¥83.33 today**, **¥3,083.33 for the month so far** after nine previous working days, and **¥72,000 annually**.

The calculation starts with scheduled time:

```text
Monthly scheduled time = working days in the month × daily shift duration
Today earned = monthly salary × today's elapsed scheduled time / monthly scheduled time
Month estimate = monthly salary × elapsed scheduled time this month / monthly scheduled time
Annual estimate = monthly salary × 12
```

Lunch does not accumulate earnings. Today's amount is zero on a rest day and stops increasing at the scheduled finish; the monthly amount is capped at the monthly salary. A month with no planned working days displays zero instead of dividing by zero. Internally, the firmware totals worked seconds first, uses integer fen (one hundredth of a yuan), and truncates the final result to cents, avoiding accumulated rounding from adding a rounded amount every second.

These are **schedule-based estimates**. The page does not record attendance, detect leave or lateness, calculate overtime or taxes, or produce a payslip. Changing salary, shifts, or calendar rules recalculates the current month under the new settings; it does not preserve historical salary segments.

### Settings on the device

The top-right settings button opens a scrollable list for salary, the four shift times, weekly workdays, China's holiday adjustments, date exceptions, and the startup page. Tap a numeric field to open its keypad. Times use four digits: `0900` means 09:00. `DEL` removes a digit and `OK` confirms that field; **Save** commits salary and schedule changes.

| Scrollable settings | Salary keypad |
| --- | --- |
| ![Salary Cat settings for salary, shift times, calendar, and startup page](./images/salary-cat/settings.png) | ![Salary input keypad with delete and confirm controls](./images/salary-cat/salary-input.png) |

Salary accepts up to two decimal places, from zero to ¥1,000,000. Shifts must be two ordered periods within the same day; overnight shifts are not supported. At least one weekly workday must be selected. Settings and calendar data live in the separate `salary_cat` NVS namespace and are written when they change, rather than every second. A failed save reports an error and preserves the prior data.

### A calendar that understands makeup workdays

A weekday rule alone cannot explain a Saturday makeup shift or a holiday that falls on a Monday. Salary Cat resolves each date in this order:

1. **Personal date exception:** explicitly work, rest, or return to automatic rules.
2. **China holiday and makeup-workday table:** when enabled and the year is covered.
3. **Weekly schedule:** the selected recurring workdays.

| Weekly schedule | Date exception | Saturday makeup shift |
| --- | --- | --- |
| ![Monday through Friday selected as weekly workdays](./images/salary-cat/weekdays.png) | ![Date override controls for work, rest, or automatic](./images/salary-cat/date-override.png) | ![October 10 Saturday counted as a makeup workday](./images/salary-cat/makeup-workday.png) |

The default enables the bundled 2026 China calendar. October has 22 Monday-to-Friday dates, minus five weekday holidays within October 1–7, plus the Saturday makeup shift on October 10: **22 − 5 + 1 = 18 working days**. A company that does not work that Saturday can override it to rest. Up to 32 personal date exceptions are supported; these edits save immediately, and choosing automatic removes the exception.

The updated Windows companion's **Settings/Logs → Import Salary Cat work calendar** accepts a validated yearly JSON file containing `year`, `work`, `rest`, and `source`. Work and rest lists describe exceptions to the weekly schedule. Invalid dates, duplicates, conflicts, and mismatched years are rejected. The host sends only the current local year's calendar on connection and about every 60 seconds. The device stages all 12 monthly exception masks before replacing the saved calendar, leaving personal date overrides intact.

This calendar is local data. It does not read Outlook or Windows events, download future holiday tables automatically, or infer a company's schedule. Only one year is stored; an uncovered year explicitly falls back to the weekly schedule. Once time has been synchronized over USB or Wi-Fi, earnings can continue to be calculated offline. After power loss, the device needs a fresh time sync; without a valid clock, it waits instead of estimating from an unknown date.

### Animation within a small memory budget

Salary Cat works without an SD card. Its eight cats use 87 frames of 112×112 RGB332 run-length encoded artwork, totaling **257,896 bytes** in the current firmware asset. Only the active animation needs a **13,568-byte** playback buffer, which is freed on exit. The weekend additions increase stored artwork without increasing this buffer. A page-specific Noto Sans SC subset supplies the Chinese labels. The calculation, persistence, and UI are separated into `salary.c`, `salary_store.c`, and `salary_ui.c`; host calendar validation and synchronization live in `tools/work_calendar.py`.

The cat artwork was supplied for this project and has separate [source and usage notes](https://github.com/mengqy2022/Esp32-touch/blob/main/assets/salary_cat/README.md); the Chinese font uses the SIL Open Font License. These assets are documented separately from the code's license in the [third-party notices](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/THIRD_PARTY_NOTICES.md).

## One serial link with clear service boundaries

The device and Windows program use an ASCII line protocol at 115200 baud. The main telemetry and provider-selection packets are:

```text
PC:STAT|cpu|gpu|cpu_C|gpu_C|mem|used_MB|total_MB
PC:USAGE|source|today_tokens|0|YYYYMMDD|estimated_CNY_fen
PC:MODELS|source|YYYYMMDD|model names
PC:AI|source
PC:TIME|unix_seconds
PC:TZOFF|minutes
PC:NAME|hostname
```

`PC:STAT` and each provider's `PC:USAGE` cache have independent validity windows: a fresh AI packet does not make an expired CPU sample online again. The device's `PC:AI` selection is persisted separately, so normal telemetry cannot silently switch the visible provider. The old `PC:CODEX` packet remains supported for compatibility, with the former daily-goal slot ignored.

`PC:MODELS` adds optional metadata without changing the usage packet. Each provider has its own names and date; names expire independently after 90 seconds and are hidden when the associated usage is stale or belongs to another day. The host deduplicates names and bounds the list to 191 printable ASCII bytes, with a remaining count when necessary. An empty list clears the names, and `PC:MODELS?` reads back the selected provider's metadata for diagnosis. Older firmware can still receive the unchanged token and cost packets, but both host and firmware must be upgraded to display model names.

The same UART also carries `SCREEN:?`, `SCREEN:OPEN`, `SCREEN:CLOSE`, `SCREEN:APP`, `SCREEN:FRAME`, `SCREEN:STATUS`, and input messages, as well as `FILE:LIST`, `FILE:PUT`, `FILE:GET`, and `FILE:DEL`. A frame announces its session, number, encoded length, and FNV-1a checksum, waits for `SCREEN:READY`, then sends exactly the RLE payload. The device confirms `SCREEN:OK` only after validation. The shared reader processes every complete line in a read chunk and retains a partial line across reads; binary frame and file payloads never interleave with other host writes.

Salary Cat adds a small calendar message to the same owner-controlled link:

```text
SALARY:CAL|year|month|work_hex|rest_hex
```

The device replies `OK` or `ERR`. The host sends all twelve months only after validating the yearly JSON; the device replaces its saved calendar only after the full set has arrived. This keeps a partial USB transfer from leaving a half-updated schedule.

The selected-window protocol also protects against stale control: the host binds input to the latest acknowledged session and frame, checks the window identity and viewport, and rejects old input. Capture runs in a separate process with a timeout, so a hung application cannot block future window switching. The trade-off is visible in daily use: a maximum frame is about 112,640 bytes and takes roughly 9.78 seconds on the wire, with measured display confirmation around 10.17 seconds.

Only one program should own the serial port at a time. Pause the Windows monitor before flashing, opening a serial console, or using an inventory tool, then resume it when the operation is complete. PC SCREEN and telemetry share the same UART, so frame transfers can delay normal samples.

## AI usage and cost are explainable estimates

Codex and Claude Code usage come from their local session logs and are grouped by the computer's local calendar date. The readers parse model and usage fields and keep incremental offsets to avoid counting the same snapshot twice. They do not transmit prompt text, response text, credentials, or API keys to the device. Codex's total is input plus output, with cached input already included. Claude's input fields use a different convention, so the reader adds cache reads and writes before forming a comparable input-plus-output total.

### From a daily total to an explainable breakdown

In the desktop companion, open **AI Usage → Query source → CODEX or CLAUDE** to see today's model names, context tiers, input including caches, cache reads, cache writes, output, and estimated CNY amounts. The list refreshes about every five seconds, with an immediate-refresh button. It works without a connected device because it reads local logs; selecting a query source changes only this desktop view and preserves the provider chosen on the device.

![Desktop AI Usage page showing model and context rows, token categories, and a combined CNY estimate](./images/device/ai-usage.png)

*A real 1040×700 GUI test window with synthetic November 1 logs: two models, 420,000 total tokens, and row estimates of ¥0.2952 and ¥7.1280. The combined estimate is ¥7.42. This desktop example is independent of the home-screen examples and contains no personal usage.*

When a session changes model, subsequent usage belongs to the new model. A model using both short and long context appears in separate rows. The desktop rows and the device total use the same calculation: normal input, cache reads, cache writes, and output each use their configured rate; exact `Decimal` amounts are added before the combined total is rounded once to CNY cents. Rows display four decimal places, so adding the displayed row values can differ slightly from the final total.

For tiered models, context of **272,000 tokens or less** selects the short tier; larger values select the long tier. The reader prefers explicit `context_tokens`, then per-request input, then the input increment. The fallback is an approximation when the log does not expose actual billing context. Missing cache-write usage is treated as zero based on the fields available in the log.

### Configured prices, visible uncertainty

The amount uses the local `codex_prices.json`. The November 1 template covers eight GPT model identifiers using the user's confirmed **20% of the supplied standard-price examples**, while retaining the existing Claude rates. These are project configuration examples supplied by the user, not independently verified official prices or a universal discount. Rates and the default USD-to-CNY exchange rate of 7.20 remain editable; CNY-denominated custom prices are also supported. The upgrade fills missing model entries, preserves custom rates and exchange rates, and writes a dated migration backup. Full rates and accounting rules are in the [usage and pricing guide](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/CODEX_USAGE_CN.md).

If a model is unknown, required token detail or a consumed category's price is missing, or the price file is invalid, the model and token count remain visible but the complete amount is unavailable (`~¥--`). A missing cache-write price is not treated as free usage. The program does not present a known subtotal as the full bill, query an official billing endpoint, or show plan balance. Changing prices recalculates the retained day's estimate; historical price versions are not stored. The device remembers whether CODEX or CLAUDE is selected, while the host continues sending both independent caches.

## Windows companion: one dark control center

The repository's published `ESP32TouchDashboard.exe` is version **2026.11.01.2**, paired with the November 1 full firmware package. It opens a dark control center with Device, PC SCREEN, AI Usage, and Settings/Logs pages. Choose automatic or manual COM selection, save the port, and click **Connect / Resume monitoring**. The GUI can be used directly; `--install` additionally creates a per-user installation, Start Menu entry, and login startup. With no device attached, the background process waits without opening a nonexistent port. When the CH340 device appears, it identifies the port and starts sending telemetry.

The control center can enable or disable startup, pause or resume monitoring, check the COM link with `FILE:PING`, inspect CH340 driver state, open the price configuration, and view rotating logs. Pausing releases the serial port and the paused state survives the next login. If several identical USB-UART devices are connected, VID/PID alone cannot prove which one is the target, so the agent waits for a resolvable candidate instead of choosing randomly. Closing the GUI no longer stops background capture or leaves the system at `Switching window...`; the 2026.10.18.4 package gives the background process its own PyInstaller extraction lifecycle.

For PC SCREEN, search windows by title or process, share one target, and open **SYSTEM → PC SCREEN** on the device. The GUI can switch targets without reopening the UART. A closed target must be selected again, and the host does not automatically redirect input to another application. Ordinary user permissions are recommended for both the target application and the Dashboard; elevated or GPU-rendered windows, minimized windows, and some Qt/OpenGL applications may still capture black frames or ignore input.

The current downloads include model-cost details, device model-name synchronization, Salary Cat calendar import, weekend and makeup-workday cats, and the Friday color fix. Upgrade both the EXE and firmware for the complete interface. The portable EXE uses Windows `%TEMP%` for extraction rather than a developer-specific drive path. For an existing installation, pause monitoring, stop the old background process, and explicitly install the downloaded update with `ESP32TouchDashboard.exe --install`; simply opening a new EXE may reconnect to the already installed control center. Existing device settings and custom prices are retained under the documented upgrade process.

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

`COM5` is only an example. Published packages are available for Windows x64 and the validated classic ESP32 board. Alternatively, build the companion in a Python 3.11 x64 environment, following the [development guide](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/DEVELOPMENT.md):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build_exe.ps1
```

| Available artifact as of November 1 | Version and feature coverage |
| --- | --- |
| [Windows companion EXE](https://github.com/mengqy2022/Esp32-touch/raw/refs/heads/main/dist/ESP32TouchDashboard.exe) | 2026.11.01.2, Windows x64, about 13 MiB; includes model-cost details, name synchronization, and calendar import; no separate Python installation needed |
| [Full-system firmware ZIP](https://github.com/mengqy2022/Esp32-touch/raw/refs/heads/main/dist/ESP32Touch-PC-SCREEN-firmware.zip) | November 1 classic ESP32 firmware; includes PC SCREEN, device model names, all eight Salary Cat animations, and the Friday fix |
| [Source and development guide](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/DEVELOPMENT.md) | Build and test the current firmware and companion yourself |

Check downloads against the published [SHA-256 file](https://github.com/mengqy2022/Esp32-touch/blob/main/dist/SHA256SUMS.txt). The firmware ZIP contains the bootloader, partition table, application, flash arguments, and internal checksums. Follow its [flashing guide](https://github.com/mengqy2022/Esp32-touch/blob/main/dist/PC_SCREEN_FIRMWARE_CN.md) using the actual COM port. With the supplied matching layout, flashing the listed segments preserves NVS settings; avoid a whole-chip erase. This package targets the validated ESP32-D0WD-V3 with 4 MB flash, ILI9341, and XPT2046, and cannot be used directly on an ESP32-S3.

The engineering repository contains the [Salary Cat guide](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/SALARY_CAT_CN.md), [home-screen guide](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/HOME_DASHBOARD_CN.md), complete [Chinese README](https://github.com/mengqy2022/Esp32-touch/blob/main/README_CN.md), [hardware notes](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/HARDWARE.md), [architecture notes](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/ARCHITECTURE.md), [serial protocol](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/PROTOCOL.md), and [validation record](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/VALIDATION.md). The packaged release also includes a [complete PC SCREEN firmware guide](https://github.com/mengqy2022/Esp32-touch/blob/main/dist/PC_SCREEN_FIRMWARE_CN.md).

## Validation and limits

The [engineering validation record](https://github.com/mengqy2022/Esp32-touch/blob/main/docs/VALIDATION.md) separates software checks, device communication, and visual acceptance. For the November 1 model-name release, it reports:

- **57 noninteractive host tests passed**, covering model attribution, provider isolation, context boundaries, price migration, and model-message validation. Actual LVGL home-page rendering checks cover name scrolling, provider switching, and stale/date/empty placeholders.
- **Firmware built and flashed**, with a 1,883,952-byte application and about 40% of the 3 MiB application partition free. Application write hashes and independent readback matched; NVS was preserved.
- **15 device serial checks passed**, including independent usage/name caches, invalid and oversized name rejection, cross-day hiding, selection preservation, and rejection of stale data reuse after restart. The real model list read back from the device matched the local logs.
- **Published packages checked**, with a 13,627,603-byte portable EXE and 1,110,374-byte firmware ZIP. The three bundled firmware binaries matched the verified build, and CRC and SHA-256 checks passed. The EXE's dedicated test window passed capture, click, drag, and scroll checks, including its minimized-window case; this does not establish compatibility with every application.

Salary Cat has separate dated evidence. The device owner confirmed normal display and continuous playback on October 21. Weekend selection and personal/calendar overrides were checked in native C and LVGL previews; the October 30 Friday fix was checked across the complete animation cycle, built, flashed, and read back. Earlier five-cycle page enter/exit checks returned to the same free-heap value, but do not establish long-term memory stability.

The November 1 home-screen layout and October 30 Friday fix have not received fresh physical-screen visual acceptance. Full touch-settings acceptance, Salary Cat restart persistence, every page over 24 hours, PC reboot/hot-plug/multiple-device behavior, and comparison against official billing remain open. Some minimized, elevated, or GPU-rendered Windows applications may still capture black frames or ignore input. The five game engines pass logic checks but still need per-game physical touch and visual acceptance. Screenshots and serial readback demonstrate their stated paths, not every aspect of the finished device.

This makes the device useful today while leaving its limits visible. The project covers a complete path from hardware interfaces, touch calibration, LVGL screens, and FreeRTOS tasks to Windows collection and a serial protocol, without presenting unmeasured laboratory results as product specifications.

## Closing thoughts

The project brings hardware interfaces, touch calibration, LVGL screens, FreeRTOS tasks, Windows collection, and a shared serial protocol into one desk device. Its division of responsibility is clear: the computer collects and captures, the link transports, and the ESP32 renders and interacts. Games, inventory, vocabulary, and Salary Cat give the device useful local behavior when the computer is away.

The result is a tool screen that can stay on the desk without interrupting the main workflow. A glance shows PC activity, today's AI usage, or progress through a scheduled workday. PC SCREEN adds a deliberately slow touch-controlled view of a selected application, while the local pages remain available for the next task.

::github{repo="mengqy2022/Esp32-touch"}
