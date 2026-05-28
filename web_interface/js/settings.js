/* Nyx8266 WebUI - settings.js */
var settingsJson = {};
var _retryTimer = null;
var _loadPending = false;

/*
 * Called when settings.json fetch fails (network error, timeout, or bad JSON).
 *
 * Old approach: relied on the 6-second heartbeat in site.js to probe
 * attack.json first, then waited up to 2s for a setInterval to detect
 * the status flip — worst-case 28s per retry cycle, which looks like a
 * permanently broken page.
 *
 * New approach: setTimeout retries load() directly after 3s.
 * No dependency on heartbeat, no className polling, no setInterval.
 * Cycle time: 3s delay + (5s timeout × 2 built-in retries) = ~13s max.
 */
function _onLoadFail() {
  _loadPending = false;
  showMessage("ERROR:settings");
  var list = getE("settingsList");
  if (list) list.innerHTML = "<p style='color:var(--warn)'>&#x21BA; Device offline &mdash; will retry&hellip;</p>";
  if (_retryTimer) return;
  _retryTimer = setTimeout(function () { _retryTimer = null; load(); }, 3000);
}

function load() {
  if (_loadPending) return;
  _loadPending = true;
  var list = getE("settingsList");
  if (list && !Object.keys(settingsJson).length)
    list.innerHTML = "<p style='color:var(--muted)'>Loading&hellip;</p>";
  getFile("settings.json", function (res) {
    _loadPending = false;
    try { settingsJson = JSON.parse(res); } catch (e) { _onLoadFail(); return; }
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    draw();
  }, 5000, "GET", _onLoadFail, _onLoadFail);
}

/* Fetch settings.json immediately on page load in parallel with the lang
   file — mirrors attack.js early-load pattern. Without this, settings had
   to wait for the full lang chain (~2s) before even starting. */
window.addEventListener("load", function () { load(); });

/*
 * BUG FIX 1 — key escape order.
 *
 * Old code: key = esc(key); if (settingsJson.hasOwnProperty(key))
 * If any key contained &, <, > or ", esc() would mangle it, making
 * hasOwnProperty() return false and silently skipping that setting.
 *
 * Fix: call hasOwnProperty() on the original key, then escape for HTML.
 *
 * BUG FIX 2 — HTML attribute injection via value='...'.
 *
 * Old code: value='" + settingsJson[key].toString() + "'
 * A setting value containing a single-quote would break the attribute
 * boundary. esc() now covers ' -> &#39; so this cannot happen.
 */
function draw() {
  var html = "";
  for (var rawKey in settingsJson) {
    if (!settingsJson.hasOwnProperty(rawKey)) continue;  /* check BEFORE escaping */
    var key = esc(rawKey);
    var val = settingsJson[rawKey];

    html += "<div class='row'>"
      + "<div class='col-6'><label class='settingName "
      + (typeof val === "boolean" ? "labelFix" : "")
      + "' for='" + key + "'>" + key + ":</label></div>"
      + "<div class='col-6'>";

    if (typeof val === "boolean") {
      html += "<label class='checkBoxContainer'>"
        + "<input type='checkbox' name='" + key + "' "
        + (val ? "checked" : "")
        + " onchange='save(\"" + key + "\",!settingsJson[\"" + key + "\"])'>"
        + "<span class='checkmark'></span></label>";
    } else if (typeof val === "number") {
      html += "<input type='number' name='" + key + "' value='"
        + esc(String(val))
        + "' onchange='save(\"" + key + "\",parseInt(this.value))'>";
    } else if (typeof val === "string") {
      html += "<input type='text' name='" + key + "' value='"
        + esc(val)          /* esc() encodes ' -> &#39; — no attribute break */
        + "' " + (rawKey === "version" ? "readonly" : "")
        + " onchange='save(\"" + key + "\",this.value)'>";
    }

    html += "</div></div>"
      + "<div class='row'><div class='col-12'>"
      + "<p>" + lang("setting_" + key) + "</p><hr>"
      + "</div></div>";
  }
  getE("settingsList").innerHTML = html;
}

/*
 * BUG FIX 3 — command injection via setting values.
 *
 * Old code built: run?cmd=set <key> "<value>"
 * A value containing \" or ; could close the quoted argument and append
 * arbitrary commands to the ESP8266 CLI.
 *
 * Fix: strip backslashes and double-quotes from value before embedding.
 * The ESP8266 CLI accepts unquoted values for simple strings/numbers.
 */
/*
 * doReset — sends "reset settings" then "save settings" in sequence.
 *
 * The old code used "reset;;save settings" as a single command string.
 * The CLI separates commands by newlines, not semicolons, so ";;save settings"
 * was treated as part of the reset argument and never ran. The save step
 * therefore never happened, leaving the EEPROM un-persisted after reset.
 *
 * Fix: chain two getFile() calls so save only runs after reset confirms OK.
 */
function doReset() {
  if (!confirm("Reset all settings to defaults? The device will reboot.")) return;
  getFile("run?cmd=reset settings", function () {
    getFile("run?cmd=save settings", function () {
      setTimeout(function () { location.reload(); }, 800);
    });
  });
}

function save(key, value) {
  if (key) {
    settingsJson[key] = value;
    var safeVal = String(value).replace(/[\\\"]/g, "");
    getFile("run?cmd=set " + key + " \"" + safeVal + "\"");
  } else {
    getFile("run?cmd=save settings", function () { load(); });
  }
}
