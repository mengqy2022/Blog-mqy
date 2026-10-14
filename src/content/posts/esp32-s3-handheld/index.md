---
title: "ESP32-S3 Handheld: Circuit Design, PCB Layout, and a Multimedia System"
published: 2026-10-13
updated: 2026-10-14
description: "A practical overview of an ESP32-S3 handheld console, including the JLCPCB schematic and PCB project, firmware architecture, features, and photos of the finished device."
image: "./front-menu.jpg"
tags: ["ESP32-S3", "Embedded Systems", "Game Console", "PCB Design", "LVGL"]
category: Hardware
draft: false
lang: en
---

This project is a small **ESP32-S3 handheld console and multimedia device**. It combines a custom PCB, a 320×240 color display, physical controls, an SD card, audio output, wireless connectivity, and a menu-driven firmware system.

The project is useful as both a working handheld and a complete embedded-systems study. The hardware design is available as a JLCPCB project archive, while the firmware is maintained in a separate public GitHub repository.

![The finished handheld showing the main menu](./front-menu.jpg)

## What the device can do

The firmware is built around ESP-IDF 5.5 and LVGL 9. From the main menu, the device provides:

- TXT ebook reading, including UTF-8, UTF-16, GBK, and GB2312 text;
- MP3 and WAV playback from the SD card;
- JPG/JPEG image browsing and wallpaper playback;
- NES game support through the nofrendo emulator core;
- Built-in Snake, Shooter, Tetris, Breakout, and Invader games;
- Wi-Fi scanning, connection management, saved passwords, and SNTP time synchronization;
- BLE advertising with a `XiaoMeng-SYS` device name and readable battery information;
- A WS2812B status light, system settings, button testing, and system information;
- Serial file transfer through the CH340 interface, so an SD card can be managed without removing it.

The software uses virtual lists for long music and ebook libraries. Large books are read in 4 KB streams with a page index instead of loading the entire file into memory. This keeps the user interface responsive and avoids treating the 8 MB PSRAM as an unlimited buffer.

## Hardware platform

The main controller is an **ESP32-S3-WROOM-1-N16R8** module with 16 MB Flash and 8 MB OPI PSRAM. The display is an ST7789 320×240 panel used in landscape orientation, with an 80 MHz SPI clock. A separate SPI bus is used for the FAT32 SD card.

| Subsystem | Part or interface | Purpose |
|---|---|---|
| MCU | ESP32-S3-WROOM-1-N16R8 | Application processor and wireless controller |
| Display | ST7789, 320×240 | Main graphical interface |
| UI | LVGL 9 | Menus, lists, settings, and applications |
| Storage | FAT32 microSD | Books, music, photos, wallpapers, and NES ROMs |
| Audio | MAX98357A over I2S | Speaker output for music and games |
| Status light | WS2812B | System and activity indication |
| Battery monitor | ADC voltage divider | Battery voltage estimation |

The firmware's board configuration is kept in [`main/board_config.h`](https://github.com/mengqy2022/ESP32-S3-XMMZ/blob/main/main/board_config.h). This file is the best reference when wiring, debugging, or adapting the board.

## Electrical architecture

The schematic is organized around a clear power and signal flow rather than one large, undifferentiated circuit.

![ESP32-S3 handheld schematic](./schematic.png)

### USB-C, charging, and power rails

The USB-C connector supplies VBUS and exposes the D+ and D- data lines. The 5.1 kΩ resistors on CC1 and CC2 identify the port as a sink. VBUS enters the IP5306 power-management section, which handles the single-cell battery path, power switching, charging status, and the VOUT rail. A dedicated slide switch controls the battery-powered system path.

Power flows from USB or the battery through the IP5306, then through the main switch to the `+5V` system bus. The TLV62568 buck converter steps this bus down to `3V3M`. The LCD has a separate supply branch through U6. A buck converter uses an inductor and switching action to reduce voltage efficiently; the LCD branch uses a linear regulator.

| Rail | Source or regulator | Main loads |
|---|---|---|
| `VBUS` | USB-C input | USB power and charging input |
| `BAT+` | Battery node from the power-management section | Battery sensing and boost input |
| `VOUT` | IP5306 output | Main switch input |
| `+5V` | Switched IP5306 output | TLV62568 input and MAX98357A supply |
| `3V3M` | U2, TLV62568 buck converter | ESP32-S3, SD card, microphone, status LED, and logic |
| `3V3LCD` | U6, ME6210A33M3G, fed from `3V3M` | LCD supply branch |

The main converter uses L2 = 2.2 µH and the R6/R9 feedback divider of 680 kΩ / 150 kΩ. With the TLV62568's nominal 0.6 V feedback reference, the intended output is approximately `0.6 × (1 + 680/150) = 3.32 V`. These resistors set the regulator output; they do not measure the battery. The IP5306 section uses L1 = 1 µH, and multiple 22 µF capacitors support the power rails.

Battery measurement uses **R3 = 100 kΩ and R8 = 100 kΩ**, connected from `BAT+` to ground with their midpoint on GPIO4. The ADC therefore sees half the battery voltage: a 4.2 V cell produces about 2.1 V at the input, before resistor tolerance and ADC calibration are considered.

There is a hardware/firmware discrepancy to resolve: the supplied firmware's `board_config.h` describes a 680 kΩ / 150 kΩ battery divider and defines `BAT_DIVIDER_RATIO` as `0.1807`. For the schematic shown here, the nominal ratio is `0.5`. The battery calculation needs to match the assembled resistor values before its voltage or percentage display can be trusted. This article documents the difference; it does not change the firmware repository.

U6 is a nominal 3.3 V linear regulator whose input is already `3V3M`. A linear regulator needs some voltage headroom, so the label `3V3LCD` alone does not establish that this node is a regulated 3.3 V under load. Its actual voltage should be checked on the assembled board. Battery capacity, charging current, and runtime also require confirmation from the battery and hardware measurements.

### ESP32-S3 and programming interface

The ESP32-S3-WROOM-1-N16R8 is the central controller. The schematic connects the CH340C USB-to-UART bridge to the serial pins and uses an automatic-download circuit built from the DTR/RTS signals and Q1. This allows the usual ESP-IDF flashing workflow without manually moving a boot jumper for every upload.

The BOOT and RESET buttons remain available for recovery. GPIO0 is also used as a front-panel control input during normal operation, so the firmware documents its dual role: it is a user button after boot, but it still has the standard ESP32-S3 ROM bootloader behavior during reset.

### Display, storage, and audio

The ST7789 interface is routed through a dedicated SPI connection. The schematic labels the display signals as `TFT_CS`, `TFT_CLK`, `TFT_MOSI`, `TFT_DC`, `TFT_RST`, and `TFT_BLK`; the firmware maps these to GPIO14, GPIO48, GPIO12, GPIO47, GPIO3, and GPIO39. Q2, an SS8050 transistor, switches the backlight current using the GPIO39 control signal, with R13 = 2.2 kΩ at its base and R14 = 10 kΩ to ground. This lets the firmware control brightness without driving the backlight current directly from a GPIO. The LCD logic supply is a separate branch; the diagram does not show firmware-controlled switching of that entire rail.

The microSD connections are used in SPI mode by the firmware rather than as a four-bit SDIO bus. `SD_CMD`, `SD_CLK`, and `SD_DATA` become MOSI on GPIO11, clock on GPIO13, and MISO on GPIO9. R16-R18 are 10 kΩ pull-ups, and R19 = 22 Ω is in series with the clock line. Series resistance can help reduce ringing on a fast clock connection.

The schematic's `SD_CD` label on GPIO10 connects to the card socket's `CD/DAT3` pin, which serves as chip select in SPI mode. Its name should not automatically be interpreted as a separate mechanical card-detect switch. The firmware lists GPIO10 as card detection and probes GPIO45/GPIO10 for chip select, so this connection deserves attention when bringing up an assembled board. The display and card otherwise use separate SPI2 and SPI3 buses in the firmware.

The MAX98357A receives I2S data, bit clock, and word select on GPIO40, GPIO41, and GPIO42. I2S carries digital audio to the amplifier, which converts it into a speaker-driving signal. U5 is supplied from `+5V`, and CN1 connects to its `OUTP` and `OUTN` outputs. The speaker is connected between these two outputs; neither terminal is a ground connection. C18 = 10 µF and C19 = 100 nF decouple the amplifier supply.

The microphone symbol is **ICS-43434**, with word select on GPIO1, serial clock on GPIO2, and audio data on GPIO21. The drawing explicitly notes that the physical build uses **ZTS6672**. This distinction matters when selecting a replacement: the symbol, footprint, and installed part should be checked together. The public firmware documentation does not advertise a recording application, so the microphone is documented as a hardware provision rather than a demonstrated software feature.

### User controls and indicators

The six panel buttons and four directional contacts of the five-way switch connect their GPIOs to ground when pressed. These are active-low inputs: a released input needs a pull-up, while a press reads low. The schematic labels them `KEY_MENU`, `KEY_OPTION`, `KEY_SELECT`, `KEY_START`, `KEY_A`, `KEY_B`, `KEY_LEFT`, `KEY_RIGHT`, `KEY_UP`, and `KEY_DOWN`. It explicitly shows a 10 kΩ pull-up on GPIO0; the other input pull-up configuration should be checked in the button driver. The switch's fifth contact is not connected in the drawing. A WS2812B-compatible status LED is driven from GPIO38.

## PCB structure and placement

The PCB project is a compact handheld-shaped board with rounded corners, four mounting holes, a central ESP32-S3 module area, and connector and control positions arranged around the enclosure.

![PCB top copper and component placement](./pcb-top.png)

The top view places the major functional blocks so that the board can connect directly to the enclosure: the USB-C connector is at the lower edge, the SD-card and audio sections occupy the lower-left region, the main power section is on the right, and the ESP32-S3 module is near the center. The ST7789 flex connector, LCD regulator, and backlight transistor sit to the right of the module. The button footprints and mounting holes follow the handheld front-panel geometry.

| Area in the top view | References | What to look for |
|---|---|---|
| Upper center | U4 | ESP32-S3 module and antenna at the board edge |
| Upper right | U1, L1, H1, SW1 | Battery connection, power management, and main switch |
| Right of U4 | U2, L2, U6, FPC1, Q2 | Main buck converter and display support |
| Lower right of center | U3, Q1 | USB-to-UART bridge and automatic download circuit |
| Lower edge, center | USB1, R1, R2 | USB-C power/data connector and CC resistors |
| Lower left | CARD1, U5, CN1 | microSD storage, audio amplifier, and speaker connector |
| Upper left | U7 | Digital microphone and its local supply capacitors |

The module antenna sits at the upper edge, and the export shows a gap in the surrounding copper near this region. This is useful to notice when fitting the enclosure: nearby metal, a battery, or added copper can affect Wi-Fi/BLE performance. The drawing alone does not establish RF performance.

![PCB bottom routing and panel markings](./pcb-bottom.png)

The bottom view carries long control and display routes around the large screen opening and marks the user-facing controls in the silkscreen. It also includes the project name, the ESP32-S3 module identifier, and labels for the speaker, battery, and LCD locations. These markings make the board easier to assemble and help align the PCB with the enclosure before soldering.

The EDA archive provides more detail than the grayscale PDF. The primary board is `PCB1_1`, which is the PCB linked to `Board1`; the archive also holds a second document called `PCB1_2`. These are two PCB documents, not the two sides of a board. The supplied PDF shows the two sides of `PCB1_1`.

| Property from `PCB1_1` | Design-file value |
|---|---|
| Board outline | Approximately 130 × 60 mm, with 10 mm corner radius |
| Copper stack | Top copper and bottom copper, with an FR4 core |
| Nominal stack thickness | Approximately 1.6 mm based on stored layer thicknesses |
| Copper thickness | Approximately 35 µm on each side in the stored stack |
| Placed component records | 77, including mechanical mounting items |
| Net records | 58, including generated names for local connections |
| Routed line segments | 500: 369 on top and 131 on bottom |
| Stored track widths | 0.254 mm and 0.508 mm |
| Vias | 80, with approximately 0.305 mm drill and 0.610 mm outer diameter |
| Ground pours | One `GND` pour definition on each copper side |

Dimensions and widths are converted from the archive's mil-based geometry (`1 mil = 0.0254 mm`). These values describe this saved design, rather than an inspected fabricated board or a completed DRC result. The many unused inner-layer definitions in the file are editor layer entries; the physical stack contains two copper layers.

The two copper sides let signals cross through vias while the ground pours provide return paths. The compact placement of the power devices and their inductors reduces the distance between associated components. Actual noise, heating, and voltage drop still depend on the assembled board and operating load.

The PCB export shows the routed result, while the `.epro` archive remains the authoritative editable source. For a board revision, open the archive in JLCPCB EDA and inspect the net classes, clearances, footprints, and copper pours there rather than editing the exported picture.

## Display and control signals

The ST7789 display uses SPI2. Its key signals are clock on GPIO48, MOSI on GPIO12, chip select on GPIO14, data/command on GPIO47, reset on GPIO3, and PWM backlight control on GPIO39. The display is write-only, so no MISO line is required.

The SD card uses a separate SPI3 bus: clock on GPIO13, MOSI on GPIO11, and MISO on GPIO9. GPIO10 is labeled `SD_CD` in the drawing but connects to the socket's `CD/DAT3` contact; its chip-select role is explained above. The audio amplifier receives I2S clock, word-select, and data on GPIO41, GPIO42, and GPIO40.

The control panel has a five-way directional switch and several independent buttons. The main mappings include GPIO18 for Menu/Home, GPIO8 for Option, GPIO16 for Select/Back, GPIO17 for Start/Confirm, GPIO15 for A, GPIO5 for B, and GPIO19, GPIO6, GPIO7, and GPIO20 for Left, Right, Up, and Down. GPIO0 is used by the firmware as a normal shortcut button, although its bootloader behavior is still controlled by the ESP32-S3 ROM during reset.

![The front panel running a game](./front-game.jpg)

## A restrained interface for a small screen

The user interface uses a dark “starry night” visual language designed for a 320×240 screen. The background is near-black, application pages are built from layered cards, and cyan-blue is reserved for focus states and important status information. Short fade transitions and compact lists keep the interface readable without putting unnecessary rendering work on the microcontroller.

The firmware also includes a screensaver. When the main screen has been idle for about 30 seconds, it can rotate wallpapers from the SD card and wake when a button is pressed.

![The NES emulator running on the handheld](./front-nes.jpg)

## JLCPCB schematic and PCB project

The complete hardware design is provided as a JLCPCB project archive:

**[Download the ESP32-S3 handheld JLCPCB project](/downloads/esp32-s3-handheld-jlcpcb-project.epro)**

The figures above were rendered from the supplied schematic and PCB PDF exports. Click the schematic or either PCB image to inspect it with the site's image viewer. English explanations accompany the original drawings, whose source labels remain unchanged.

The archive is intended to be opened in the JLCPCB EDA environment. It contains the project metadata, schematic sheet, PCB data, symbols, footprints, and related design resources. This is the appropriate file for inspecting the circuit, checking connectivity, reviewing the board layout, or continuing hardware development.

The archive is shared as an engineering reference. Before manufacturing a modified board, check the schematic, footprints, component availability, assembly rules, and the actual revision of the physical hardware. The firmware pin definitions and the EDA project should be read together because they describe different sides of the same system: the EDA project describes the electrical design, while `board_config.h` describes how the firmware uses those connections.

![Rear view of the handheld enclosure](./back-view.jpg)

## Firmware repository

The complete device software is available here:

**[ESP32-S3-XMMZ on GitHub](https://github.com/mengqy2022/ESP32-S3-XMMZ)**

The repository contains the ESP-IDF application, LVGL integration, display and audio drivers, button handling, SD-card services, Wi-Fi and BLE services, the NES core, built-in games, tools, and example storage data. It is released under the MIT License. The MP3 decoder and NES emulator include their own third-party license files, which should be preserved when redistributing the firmware.

## Building and flashing the firmware

The project targets ESP32-S3 only. A typical build environment uses ESP-IDF 5.5.x:

```bash
idf.py set-target esp32s3
idf.py reconfigure
idf.py build
```

To flash and monitor the device on Windows, replace `COM7` with the actual serial port:

```bash
idf.py -p COM7 flash monitor
```

If the build reports classic-ESP32 toolchain errors or missing ESP32-S3 GPIO definitions, clear the old target configuration and select `esp32s3` again. The repository README contains the complete recovery procedure and the dependency information required by ESP-IDF Component Manager.

## SD card layout

The firmware expects a FAT32 card with directories like these:

```text
/sdcard/
├── books/       # .txt ebooks
├── music/       # .mp3 and .wav files
├── games/       # .nes ROM files
├── gallery/     # .jpg and .jpeg images
├── Pictures/    # compatible image directory
├── DCIM/        # compatible image directory
└── wallpaper/   # screensaver images
```

Long file names and UTF-8 file names are enabled, so Chinese book and game names can be used directly on the card.

![The display turned off during testing](./display-off.jpg)

## Design notes and possible next steps

The project now documents the circuit, two-layer PCB, connector placement, firmware, and physical prototype together. The next practical checks are to reconcile the battery-divider constant with R3/R8, verify the LCD rail under load, confirm the SD chip-select mapping, and record the installed battery specification. The schematic also notes that USB1 uses LCSC part C49261586 and that connector height matters when choosing a replacement.

Other natural extensions include a dedicated wiring diagram, a pinout illustration for the front-panel controls, benchmark measurements for battery life and frame rate, and a release package containing a reproducible firmware binary. Keeping those items in the firmware repository would make the project easier for other builders to reproduce.

## Conclusion

This ESP32-S3 handheld is more than a game console. It is a compact example of how a custom PCB, an RTOS-based firmware stack, a graphical interface, file-based storage, audio, wireless services, and emulation can be integrated into one portable device. The public firmware and JLCPCB project make the design inspectable, reusable, and ready for further hardware and software improvements.

::github{repo="mengqy2022/ESP32-S3-XMMZ"}
