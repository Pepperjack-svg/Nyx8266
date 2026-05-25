/* Nyx8266 WebUI - site.js */
var langJson = {};

function getE(n) { return document.getElementById(n); }

function esc(s) {
  if (!s) return "";
  return s.toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function convertLineBreaks(s) { return s ? s.toString().replace(/(?:\r\n|\r|\n)/g,"<br>") : ""; }
function lang(k) { return convertLineBreaks(esc(langJson[k])) || ""; }

/* ── Status ── */
function showMessage(msg) {
  var el = getE("status");
  if (!el) return;
  if (msg.startsWith("ERROR")) {
    el.className = "err"; el.textContent = "✗ offline";
  } else if (msg.startsWith("LOAD")) {
    el.className = "loading"; el.textContent = "↺ …";
  } else {
    el.className = "ok"; el.textContent = "● live";
  }
}

/*
 * Serial request queue — ONE XHR in-flight to the ESP8266 at a time.
 *
 * WHY: The ESP8266 HTTP server is single-threaded. Firing parallel requests
 * causes it to silently drop or timeout subsequent ones, which the browser
 * interprets as "offline". Serialising every getFile() call eliminates
 * dropped connections and makes the "✗ offline" indicator accurate.
 *
 * Each item gets 1 automatic retry (push back to front of queue) before
 * the onTimeout/onError handlers fire.
 */
var _q = [], _busy = false;

function _next() {
  if (_busy || !_q.length) return;
  _busy = true;
  var t = _q.shift();
  var r = new XMLHttpRequest();
  r.open(t.method, encodeURI(t.adr), true);
  r.timeout = t.timeout;
  r.overrideMimeType("application/json");

  function release() { _busy = false; _next(); }

  r.ontimeout = function () {
    if (t.retries-- > 0) {
      _busy = false;
      _q.unshift(t);
      setTimeout(_next, 800);
    } else {
      t.onTimeout();
      release();
    }
  };

  r.onerror = function () {
    if (t.retries-- > 0) {
      _busy = false;
      _q.unshift(t);
      setTimeout(_next, 800);
    } else {
      t.onError();
      release();
    }
  };

  r.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    if (this.status === 200) {
      showMessage("OK");
      t.cb(this.responseText);
    } else if (this.status !== 0) {
      t.onError();
    }
    release();
  };

  showMessage("LOAD");
  r.send();
}

function getFile(adr, cb, timeout, method, onTimeout, onError) {
  if (!adr) return;
  _q.push({
    adr:       adr,
    cb:        cb        || function () {},
    timeout:   timeout   || 10000,
    method:    method    || "GET",
    onTimeout: onTimeout || function () { showMessage("ERROR:timeout " + adr); },
    onError:   onError   || function () { showMessage("ERROR:load "    + adr); },
    retries:   1
  });
  _next();
}

/*
 * Heartbeat / reconnect — every 6 s, if the queue is idle and the status
 * indicator shows "offline", probe the device with a lightweight request.
 * A successful response flips the indicator back to "● live".
 */
setInterval(function () {
  if (!_busy && !_q.length) {
    var el = getE("status");
    if (el && el.className === "err") {
      getFile("attack.json", function () {});
    }
  }
}, 6000);

/* ── Lang + active nav ── */
function parseLang(s) {
  langJson = JSON.parse(s);
  if (langJson.lang !== "en") {
    var els = document.querySelectorAll("[data-translate]");
    for (var i = 0; i < els.length; i++) {
      var e = els[i], k = e.getAttribute("data-translate"), v = lang(k);
      if (v) e.innerHTML = v;
    }
  }
  document.querySelector("html").setAttribute("lang", langJson.lang || "en");
  if (typeof load !== "undefined") load();
}

function loadLang() {
  getFile("lang/default.lang", parseLang, 2000, "GET",
    function () { getFile("lang/en.lang", parseLang); },
    function () { getFile("lang/en.lang", parseLang); }
  );
}

window.addEventListener("load", function () {
  var el = getE("status");
  if (el) { el.className = "ok"; el.textContent = "● live"; }
  var p = location.pathname.split("/").pop() || "index.html";
  var links = document.querySelectorAll("nav a");
  for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute("href") === p) links[i].classList.add("active");
  }
});
