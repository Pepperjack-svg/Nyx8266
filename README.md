# Nyx8266

> ESP8266-based WiFi security testing tool with a modern web interface.  
> Developed by **[PepperJack](https://github.com/Pepperjack-svg)**

---

## Overview

Nyx8266 is an ESP8266 firmware for authorized WiFi security research and testing. It exposes a mobile-friendly web interface over its own access point, letting you scan nearby networks, manage SSID lists, run deauth/beacon/probe attacks, and run an Evil Twin captive portal — all from a browser with no app required.

> **Legal notice:** Use this tool only on networks and devices you own or have explicit written permission to test. Unauthorized use is illegal in most jurisdictions.

---

## Features

- **Scan** — detect nearby APs and client stations
- **Deauth** — send 802.11 deauthentication frames to selected targets
- **Deauth All** — deauth every visible device simultaneously
- **Beacon flood** — broadcast a custom SSID list as fake access points
- **Probe flood** — send probe requests for known SSIDs
- **Evil Twin** — clone an AP and capture credentials via captive portal
- **Mobile WebUI** — dark-themed, touch-friendly interface served directly from the ESP8266
- **Multi-language** — 21 language files included

---

## Hardware

Any ESP8266 board works. Tested on:

| Board | Notes |
|---|---|
| NodeMCU v2 | Recommended for beginners |
| NodeMCU v3 | Works, slightly larger |
| Wemos D1 Mini | Compact option |
| Custom boards with OLED + buttons | Configure via `A_config.h` |

---

## Connecting to the WebUI

1. Flash the firmware (see below)
2. Power on the ESP8266
3. Connect your phone or laptop to WiFi:
   - **SSID:** `Nyx8266`
   - **Password:** `PepperJack`
4. Open `http://192.168.4.1` in a browser  
   *(or `http://nyx8266.local` if your device supports mDNS)*

---

## Flashing

### Arduino IDE

1. Add the board manager URL in **File → Preferences → Additional Boards Manager URLs**:
   ```
   https://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
2. Install **esp8266 by ESP8266 Community** via **Tools → Board → Boards Manager**
3. Open `Nyx8266/Nyx8266.ino`
4. Select your board under **Tools → Board → ESP8266 Boards**
5. Click **Upload**

### arduino-cli

```powershell
$cli = "$env:LOCALAPPDATA\arduino-cli\arduino-cli.exe"
& $cli compile --fqbn esp8266:esp8266:nodemcuv2 Nyx8266
& $cli upload  --fqbn esp8266:esp8266:nodemcuv2 --port COM5 Nyx8266
```

---

## Rebuilding the WebUI

After editing any file in `web_interface/`, regenerate the embedded PROGMEM assets:

```bash
python tools/build_webfiles.py
```

Then recompile and flash.

---

## Serial CLI

Connect at **115200 baud**. Key commands:

```
scan aps -ch all
scan stations -t 15s -ch all
select ap <id>
attack -b               # beacon flood
attack -d               # deauth selected
attack -da              # deauth all
attack -p               # probe flood
stop attack
sysinfo
help
```

Full command reference: [`serialcommands.md`](serialcommands.md)

---

## Project Structure

```
Nyx8266/            Arduino sketch + all firmware source
web_interface/      HTML, CSS, JS source files
tools/              build_webfiles.py — regenerates webfiles.h
EvilTwin/           Example captive portal HTML templates
```

---

## License

This project is a fork of [esp8266_deauther](https://github.com/spacehuhntech/esp8266_deauther) by Spacehuhn Technologies, licensed under the MIT License.

Nyx8266 modifications © 2026 [PepperJack](https://github.com/Pepperjack-svg) — also MIT licensed.

See [`LICENSE.txt`](LICENSE.txt) for the full text.
