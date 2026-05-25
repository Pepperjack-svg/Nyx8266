#include "EvilTwin.h"
#include "ESP8266WiFi.h"
#include "DNSServer.h"
#include "ESP8266WebServer.h"
#include "settings.h"

#include "wifi.h"
#include "language.h"

String EvilTwin::ssidT    = "";
String EvilTwin::pass     = "";
String EvilTwin::passTesting = "";
bool   EvilTwin::_running = false;

void EvilTwin::start(const char* ap) {
    EvilTwin::ssidT = ap;
    EvilTwin::pass  = "";
    wifi::stopAP();
    wifi::startEvilTwin(ap);
    EvilTwin::_running = true;
    Serial.println(F("[EvilTwin] Starting..."));
}

void EvilTwin::stop() {
    EvilTwin::_running = false;
    EvilTwin::ssidT    = "";
    wifi::stopAP();
    wifi::startAP();
    Serial.println(F("[EvilTwin] Stopped"));
}

String EvilTwin::getpass() {
    return EvilTwin::pass;
}

bool EvilTwin::isRunning() {
    /* Fast path: avoids WiFi.softAPSSID() heap allocation on every loop.
       Defensive fallback: if the SDK AP silently died, clear the flag. */
    if (!_running) return false;
    if (ssidT.isEmpty()) { _running = false; return false; }
    return true;
}

void EvilTwin::update() {
}
