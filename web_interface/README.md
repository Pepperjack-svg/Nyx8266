# Nyx8266 Web Interface

Source files for the Nyx8266 WebUI, served directly from the ESP8266 as gzip-compressed PROGMEM byte arrays.

## Editing

Edit any file in this directory, then regenerate the embedded header:

```bash
python ../tools/build_webfiles.py
```

Then recompile and flash the firmware.

## File Map

| File | Purpose |
|---|---|
| `index.html` | Splash screen, auto-redirects to scan after 5 s |
| `scan.html` | AP and station scanner |
| `attack.html` | Deauth / beacon / probe / evil twin controls |
| `ssids.html` | SSID list manager |
| `fsmanager.html` | LittleFS file browser, evil twin portal config |
| `settings.html` | Device settings |
| `info.html` | Credits and license |
| `connecting.html` | Shown while connecting to an upstream AP |
| `login.html` | Evil Twin captive portal page |
| `style.css` | Shared dark theme, mobile-first |
| `js/site.js` | Serial request queue, heartbeat, lang loader |
| `js/scan.js` | Scan table rendering |
| `js/attack.js` | Attack card state and start/stop logic |
| `js/ssids.js` | SSID list CRUD |
| `js/settings.js` | Settings form rendering |
| `js/fs.js` | File manager |
| `lang/*.lang` | Language JSON files (21 languages) |

## Developer

[PepperJack](https://github.com/Pepperjack-svg)
