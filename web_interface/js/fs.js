/* Nyx8266 WebUI - fs.js */
var _fileList = [];

function load() {
  filelist();
  getFile("eviltwin.txt", function (res) {
    document.getElementById("eviltwinpath").value = res;
  });
  /*
   * BUG FIX — XSS in credential log.
   *
   * Old code: logDiv.innerHTML += "<td>" + array[i].ssid + "</td>"
   * An attacker who named their AP  <img src=x onerror=alert(1)>  would
   * execute arbitrary JS in the browser when the log was viewed.
   * All log values must pass through esc() before being written to innerHTML.
   */
  getFile("log.json", function (res) {
    try { var array = JSON.parse(res); } catch (e) { return; }
    var logDiv = document.getElementById("log");
    var html = "<tr><th>SSID</th><th>Password</th></tr>";
    for (var i = 0; i < array.length; i++) {
      html += "<tr><td>" + esc(array[i].ssid) + "</td><td>" + esc(array[i].pass) + "</td></tr>";
    }
    logDiv.innerHTML = html;
  });
  getFile("fsinfo", function (res) {
    /* textContent — fsinfo is plain text, not HTML */
    document.getElementById("fsinfo").textContent = res;
  });
}

function format() {
  if (!confirm("Format filesystem? All data will be lost.")) return;
  getFile("format", function (res) {
    alert(res === "OK" ? "Format successful. Restarting..." : "Format failed!");
  });
}

/*
 * BUG FIX — XSS in file list + innerHTML accumulation bug.
 *
 * Old code:
 *   listView.innerHTML += "<td>" + array[i].name + "</td>"
 *   (1) File names from SPIFFS were raw HTML — a crafted file name could inject scripts.
 *   (2) innerHTML += rebuilt the entire DOM subtree on every append, and calling
 *       filelist() twice would duplicate every row instead of replacing them.
 *
 * Fix: store raw names in _fileList[], reference by index in onclick,
 * build the full HTML string first and assign once (single DOM write).
 */
function filelist() {
  getFile("filecli?cmd=listfile", function (res) {
    try { _fileList = JSON.parse(res); } catch (e) { return; }
    var listView = document.getElementById("fileList");
    var html = "<tr><th>File Name</th><th>Size</th><th></th></tr>";
    for (var i = 0; i < _fileList.length; i++) {
      html += "<tr>"
        + "<td>" + esc(_fileList[i].name) + "</td>"
        + "<td>" + esc(String(_fileList[i].size)) + "</td>"
        + "<td><button onclick='deleteFile(" + i + ")' class='danger' "
        + "style='height:24px;padding:0 6px;font-size:.72rem'>DELETE</button></td>"
        + "</tr>";
    }
    listView.innerHTML = html;
  });
}

function deleteFile(idx) {
  var entry = _fileList[idx];
  if (!entry) return;
  if (!confirm("Delete " + entry.name + "?")) return;
  /* encodeURIComponent — never concatenate raw paths into a query string */
  getFile("filecli?cmd=" + encodeURIComponent(entry.name), function (res) {
    if (res === "OK") {
      _fileList.splice(idx, 1);
      filelist();
    } else {
      alert("Failed to delete file");
    }
  });
}
