/* Nyx8266 WebUI - settings.js */
var settingsJson = {};

function load() {
  getFile("settings.json", function (res) {
    try { settingsJson = JSON.parse(res); } catch (e) { return; }
    draw();
  });
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
function save(key, value) {
  if (key) {
    settingsJson[key] = value;
    var safeVal = String(value).replace(/[\\\"]/g, "");
    getFile("run?cmd=set " + key + " \"" + safeVal + "\"");
  } else {
    getFile("run?cmd=save settings", function () { load(); });
  }
}
