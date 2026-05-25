/* Nyx8266 WebUI - attack.js */
var attackJSON = [[false,0,0,0],[false,0,0,0],[false,0,0,0],[false,0,0,0],[false,"[Nothing]"],0];
var autoRefresh = null;
var _loadPending = false;

function setCard(id, running) {
  var c = document.getElementById("card-" + id);
  if (!c) return;
  if (running) c.classList.add("running"); else c.classList.remove("running");
}

function animCount(elId, val) {
  var el = getE(elId);
  if (!el) return;
  var cur = parseInt(el.textContent) || 0, tgt = parseInt(val) || 0;
  var step = Math.ceil(Math.abs(tgt - cur) / 8);
  if (cur === tgt) { el.textContent = val; return; }
  var t = setInterval(function () {
    if (Math.abs(cur - tgt) <= step) { cur = tgt; clearInterval(t); }
    else cur += cur < tgt ? step : -step;
    el.textContent = cur;
  }, 40);
}

function draw() {
  var names = ["deauth","beacon","probe","deauthAll","evilTwin"];
  for (var i = 0; i < names.length; i++) {
    var b = getE(names[i]);
    if (!b) continue;
    var run = attackJSON[i][0];
    b.textContent = run ? (lang("stop") || "STOP") : (lang("start") || "START");
    if (run) b.classList.add("running"); else b.classList.remove("running");
    setCard(names[i], run);
  }
  getE("deauthTargets").textContent    = attackJSON[0][1];
  getE("beaconTargets").textContent    = attackJSON[1][1];
  getE("probeTargets").textContent     = attackJSON[2][1];
  getE("deauthAllTargets").textContent = attackJSON[3][1];
  /* attackJSON[4] = [running, "SSID", rssiDdBm]
     Index [4][2] is the target AP's RSSI added in getStatusJSON().
     Undefined-safe: old firmware without the field shows nothing. */
  var etSSID = attackJSON[4][1] || "[Nothing]";
  var etRSSI = (typeof attackJSON[4][2] !== "undefined" && attackJSON[4][2] !== -100)
               ? " (" + attackJSON[4][2] + " dBm)" : "";
  getE("evilTwinTargets").textContent = etSSID + etRSSI;

  getE("deauthPkts").textContent    = attackJSON[0][2] + "/" + attackJSON[0][3];
  getE("beaconPkts").textContent    = attackJSON[1][2] + "/" + attackJSON[1][3];
  getE("probePkts").textContent     = attackJSON[2][2] + "/" + attackJSON[2][3];
  getE("deauthAllPkts").textContent = attackJSON[3][2] + "/" + attackJSON[3][3];

  /* attackJSON[5] is a plain number (packet rate), not an array */
  animCount("allpkts", attackJSON[5]);

  var anyRunning = attackJSON[0][0] || attackJSON[1][0] || attackJSON[2][0]
                || attackJSON[3][0] || attackJSON[4][0];
  if (anyRunning && !autoRefresh) {
    autoRefresh = setInterval(load, 3000);
  } else if (!anyRunning && autoRefresh) {
    clearInterval(autoRefresh);
    autoRefresh = null;
  }
}

function stopAll() {
  getFile("run?cmd=stop attack", function () { load(); });
}

/*
 * BUG FIX 1 — TypeError crash from .slice() on a number.
 *
 * Old code: attackJSON.map(function(a){ return a.slice(); })
 * attackJSON[5] is 0 (a number, the packet rate).
 * (0).slice() throws TypeError, killing the function silently before
 * getFile() is ever called — nothing is sent to the ESP8266.
 *
 * Fix: don't copy the array at all. Just read the current boolean state
 * of each attack index directly and compute the desired new state inline.
 *
 * BUG FIX 2 — Wrong command when toggling the last attack OFF.
 *
 * Old code built: "attack" with no flags when all are off.
 * The ESP8266 CLI interprets bare "attack" as "start attack with no modes",
 * which starts the attack loop but does nothing — it does NOT stop it.
 *
 * Fix: when the resulting state has no active flags, send "stop attack".
 */
function start(mode) {
  var idx = [0,1,2,3,4][mode];

  /* Compute desired state for each attack (only toggle the one clicked) */
  var d  = (idx === 0) ? !attackJSON[0][0] : !!attackJSON[0][0]; /* deauth    */
  var b  = (idx === 1) ? !attackJSON[1][0] : !!attackJSON[1][0]; /* beacon    */
  var p  = (idx === 2) ? !attackJSON[2][0] : !!attackJSON[2][0]; /* probe     */
  var da = (idx === 3) ? !attackJSON[3][0] : !!attackJSON[3][0]; /* deauthAll */
  var et = (idx === 4) ? !attackJSON[4][0] : !!attackJSON[4][0]; /* evilTwin  */

  /* If every attack would be off, use "stop attack" — not bare "attack" */
  if (!d && !b && !p && !da && !et) {
    getFile("run?cmd=stop attack", function () { setTimeout(load, 1000); });
    return;
  }

  var cmd = "attack"
    + (d  ? " -d"  : "")
    + (b  ? " -b"  : "")
    + (p  ? " -p"  : "")
    + (da ? " -da" : "")
    + (et ? " -et" : "");

  getFile("run?cmd=" + cmd, function () { setTimeout(load, 1800); });
}

function load() {
  if (_loadPending) return;
  _loadPending = true;
  getFile("attack.json", function (r) {
    _loadPending = false;
    try { attackJSON = JSON.parse(r); } catch (e) { return; }
    showMessage("OK");
    draw();
  });
}

/* Fetch attack state immediately on page load — don't wait for the lang file.
   parseLang() will call load() a second time once lang is ready, which is fine:
   the queue serialises the requests and the second draw() just adds translated
   button text. Without this early call the buttons flash "START" for 2-4 s
   while the lang→attack.json chain completes, even when attacks are running. */
window.addEventListener("load", function () { load(); });

window.addEventListener("pagehide", function () {
  if (autoRefresh) { clearInterval(autoRefresh); autoRefresh = null; }
});
