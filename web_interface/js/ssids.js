/* Nyx8266 WebUI - ssids.js */
var ssidJson = { "random": false, "ssids": [] };

function load() {
  getFile("run?cmd=save ssids", function () {
    getFile("ssids.json", function (res) {
      try { ssidJson = JSON.parse(res); } catch (e) { return; }
      draw();
    });
  });
}

function draw() {
  var html = "<tr>"
    + "<th class='id'></th><th class='ssid'></th>"
    + "<th class='lock'></th><th class='save'></th><th class='remove'></th>"
    + "</tr>";

  for (var i = 0; i < ssidJson.ssids.length; i++) {
    html += "<tr>"
      + "<td class='id'>" + i + "</td>"
      + "<td class='ssid' contenteditable='true' id='ssid_" + i + "'>"
      + esc(ssidJson.ssids[i][0]) + "</td>"
      + "<td class='lock clickable' onclick='changeEnc(" + i + ")' id='enc_" + i + "'>"
      + (ssidJson.ssids[i][1] ? "&#x1f512;" : "-") + "</td>"
      + "<td class='save'><button class='success' onclick='save(" + i + ")'>" + (lang("save") || "Save") + "</button></td>"
      + "<td class='remove'><button class='danger' onclick='remove(" + i + ")'>✕</button></td>"
      + "</tr>";
  }

  getE("randomBtn").innerHTML = ssidJson.random ? (lang("disable_random") || "Disable Random") : (lang("enable_random") || "Enable Random");
  getE("ssidTable").innerHTML = html;
}

function remove(id) {
  ssidJson.ssids.splice(id, 1);
  getFile("run?cmd=remove ssid " + id);
  draw();
}

function add() {
  var ssidStr = getE("ssid").value;
  var wpa2    = getE("enc").checked;
  var clones  = parseInt(getE("ssidNum").value) || 1;
  var force   = getE("overwrite").checked;
  if (ssidStr.length === 0) return;

  var cmdStr = "add ssid \"" + ssidStr.replace(/\"/g, "") + "\""
    + (force ? " -f" : " ") + " -cl " + clones;
  if (wpa2) cmdStr += " -wpa2";

  getFile("run?cmd=" + cmdStr);

  for (var i = 0; i < clones; i++) {
    if (ssidJson.ssids.length >= 60) ssidJson.ssids.splice(0, 1);
    ssidJson.ssids.push([ssidStr, wpa2]);
  }
  draw();
}

function enableRandom() {
  if (ssidJson.random) {
    getFile("run?cmd=disable random", function () { load(); });
  } else {
    getFile("run?cmd=enable random " + parseInt(getE("interval").value), function () { load(); });
  }
}

function addSelected() {
  getFile("run?cmd=add ssid -s" + (getE("overwrite").checked ? " -f" : ""));
}

function changeEnc(id) {
  ssidJson.ssids[id][1] = !ssidJson.ssids[id][1];
  save(id);
  draw();
}

function removeAll() {
  ssidJson.ssids = [];
  getFile("run?cmd=remove ssids");
  draw();
}

function save(id) {
  /*
   * BUG FIX — innerHTML vs textContent.
   *
   * Old code used .innerHTML which returns HTML entities (&amp; &lt; etc.)
   * and embedded <br> tags when the user pressed Enter in the contenteditable.
   * The SSID sent to the device would contain literal "&amp;" instead of "&".
   *
   * Fix: .textContent gives the plain text the user typed.
   */
  var el = getE("ssid_" + id);
  if (!el) return;
  var name = el.textContent.replace(/\n/g, "").trim().substring(0, 32);
  var wpa2 = ssidJson.ssids[id][1];
  ssidJson.ssids[id] = [name, wpa2];

  getFile("run?cmd=replace ssid " + id + " -n \"" + name.replace(/\"/g, "") + "\" " + (wpa2 ? "-wpa2" : ""));
}
