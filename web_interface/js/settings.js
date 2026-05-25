/* Nyx8266 WebUI - settings.js */
var settingsJson = {};
var _retryTimer = null;

/*
 * Called when settings.json fetch fails (network error, timeout, or bad JSON).
 * Shows a status message in the list and starts a 2 s poller that retries
 * load() automatically once the heartbeat in site.js brings the device back
 * online (status element's className flips to "ok").
 */
function _onLoadFail() {
  /* Push status to "err" so site.js heartbeat fires and eventually flips it
     to "ok", which unblocks the retry timer below. Without this the status
     stays stuck at "loading" and neither the heartbeat nor the retry ever run. */
  showMessage("ERROR:settings");
  var list = getE("settingsList");
  if (list) list.innerHTML = "<p style='color:var(--warn)'>&#x21BA; Device offline &mdash; will retry&hellip;</p>";
  if (_retryTimer) return;
  _retryTimer = setInterval(function () {
    var s = getE("status");
    if (s && s.className === "ok") {
      clearInterval(_retryTimer);
      _retryTimer = null;
      load();
    }
  }, 2000);
}

function load() {
  /* Show a placeholder only on the very first load (list still empty) */
  var list = getE("settingsList");
  if (list && !Object.keys(settingsJson).length)
    list.innerHTML = "<p style='color:var(--muted)'>Loading&hellip;</p>";

  getFile("settings.json", function (res) {
    try { settingsJson = JSON.parse(res); } catch (e) { _onLoadFail(); return; }
    if (_retryTimer) { clearInterval(_retryTimer); _retryTimer = null; }
    draw();
  }, 10000, "GET", _onLoadFail, _onLoadFail);
}

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
