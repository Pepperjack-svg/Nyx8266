/* This software is licensed under the MIT License: https://github.com/Pepperjack-svg/Nyx8266 */

#pragma once

#include "Arduino.h"
#include "Accesspoints.h"
#include "Stations.h"
#include "Names.h"
#include "SSIDs.h"
#include "language.h"
#include "SimpleList.h"

#define SCAN_MODE_OFF 0
#define SCAN_MODE_APS 1
#define SCAN_MODE_STATIONS 2
#define SCAN_MODE_ALL 3
#define SCAN_MODE_SNIFFER 4
#define SCAN_DEFAULT_TIME 15000
#define SCAN_DEFAULT_CONTINUE_TIME 10000
#define SCAN_PACKET_LIST_SIZE 64

extern Accesspoints accesspoints;
extern Stations     stations;
extern Names names;
extern SSIDs ssids;

extern uint8_t wifiMode;

extern void setWifiChannel(uint8_t ch, bool force);
extern bool appendFile(String path, String& buf);
extern bool writeFile(String path, String& buf);
extern void readFileToSerial(const String path);
extern String escape(String str);

class Scan {
    public:
        Scan();

        /* ICACHE_RAM_ATTR: this is invoked from the WiFi RX hardware interrupt.
           Any function called from interrupt context must reside in IRAM —
           if it's in flash (ICACHE), a cache miss during a busy radio period
           causes a fatal exception. */
        void ICACHE_RAM_ATTR sniffer(uint8_t* buf, uint16_t len);
        void start(uint8_t mode, uint32_t time, uint8_t nextmode, uint32_t continueTime, bool channelHop, uint8_t channel);
        void start(uint8_t mode);

        void setup();
        void update();
        void stop();
        void save(bool force);
        void save(bool force, String filePath);

        void selectAll();
        void deselectAll();
        void printAll();
        void printSelected();

        uint8_t getPercentage();
        uint32_t getPackets(int i);
        uint32_t countAll();
        uint32_t countSelected();
        bool isScanning();
        bool isSniffing();

        void nextChannel();
        void setChannel(uint8_t newChannel);

        String getMode();
        double getScaleFactor(uint8_t height);
        uint32_t getMaxPacket();
        uint32_t getPacketRate();
        String getEndSSID();
        int    getEndRSSI(); // returns dBm int — avoids String allocation per call

        /* volatile: written inside sniffer() which runs in the WiFi RX interrupt
           context. Without volatile the compiler may cache the value in a register
           and the main-loop read in update() would never see the increment. */
        volatile uint16_t deauths = 0;
        volatile uint16_t packets = 0;

    private:
        SimpleList<uint16_t>* list;                      // packet list

        uint32_t sniffTime          = SCAN_DEFAULT_TIME; // how long the scan runs
        uint32_t snifferStartTime   = 0;                 // when the scan started
        uint32_t snifferOutputTime  = 0;                 // last info output (every 3s)
        uint32_t snifferChannelTime = 0;                 // last time the channel was changed
        uint32_t snifferPacketTime  = 0;                 // last time the packet rate was reseted (every 1s)

        uint8_t scanMode = 0;

        uint8_t scan_continue_mode = 0;                          // restart mode after scan stopped
        uint32_t continueTime      = SCAN_DEFAULT_CONTINUE_TIME; // time in ms to wait until scan restarts
        uint32_t continueStartTime = 0;                          // when scan restarted

        bool channelHop              = true;
        volatile uint16_t tmpDeauths = 0; // written in RX interrupt, read in update()

        bool apWithChannel(uint8_t ch);
        int findAccesspoint(uint8_t* mac);

        String FILE_PATH = "/scan.json";
};