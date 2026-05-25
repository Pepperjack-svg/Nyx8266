# Nyx8266 — Evil Twin Captive Portals

Nyx8266 can serve a custom HTML page as a captive portal when the Evil Twin attack is active. When a victim connects to the cloned AP, every HTTP request is redirected to your custom page.

## How It Works

1. On the **FS Manager** page, upload your custom HTML file and set the Evil Twin path to point to it (e.g. `/myportal.html`).
2. Start the **Evil Twin** attack from the Attack page — select a target AP first on the Scan page.
3. The ESP8266 clones the target SSID and deauths its clients.
4. Any device connecting to the clone is served your custom HTML page.
5. If the page POSTs or GETs to `/submit?password=...`, the credential is captured and written to `/log.json`, visible in the FS Manager.

## Included Templates

| File | Description |
|---|---|
| `login.html` | Generic "Router Firmware Update" portal — prompts for WiFi password |

## Uploading a Custom Portal

Use **FS Manager → Upload** to push any HTML file to LittleFS, then enter the path in the Evil Twin path field and click Save.

## Legal Notice

Only use this against networks and devices you own or have explicit written permission to test.

---

Developed by [PepperJack](https://github.com/Pepperjack-svg)
