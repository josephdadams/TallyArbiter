#ifdef PLATFORM_TTGO

extern String selectedDeviceId;
extern char ta_host[60];
extern char ta_port[8];
extern void initializeSleepMode();

#include <TFT_eSPI.h> // Graphics and font library for ST7735 driver chip
#include <SPI.h>

#include "TFT_TallyArbiter_logo.h"
#include "TFT_Alert_logo.h"
#include "TFT_Info_logo.h"

TFT_eSPI tft = TFT_eSPI();

void TTGOInitialize() {
    tft.init();
    tft.setRotation(TTGO_SCREEN_ROTATION);
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(TFT_WHITE);
    tft.setSwapBytes(TTGO_SWAP_BYTES);
    tft.pushImage(0, 0, TallyArbiterLogoWidth, TallyArbiterLogoHeight, TallyArbiterLogo);
}

float battery_voltage;
int batteryLevel = 100;
int barLevel = 0;
bool charingDevice = false; // true if we are the device is powered via cable (ex. via USB)

void TTGOCheckBatteryLevel() {
    uint16_t v = analogRead(TTGO_ADC_PIN);
    battery_voltage = ((float)v / 4095.0) * 2.0 * 3.3 * (TTGO_BATTERY_VREF / 1000.0);
    if(battery_voltage < 4.5) {
        charingDevice = false;

        batteryLevel = floor(100.0 * (((battery_voltage * 1.1) - TTGO_BATTERY_MIN_VOLTAGE) / (TTGO_BATTERY_MAX_VOLTAGE - TTGO_BATTERY_MIN_VOLTAGE))); //100%=3.7V, Vmin = 2.8V
        batteryLevel = batteryLevel > 100 ? 100 : batteryLevel;
        barLevel = tft.height() - (batteryLevel * tft.height()/100);

        if(TTGO_ENABLE_BATTERY_INDICATOR) {
            int LevelColor = TTGO_BATTERY_INDICATOR_COLOR;
            if (battery_voltage < 3){
                LevelColor = TTGO_BATTERY_LOW_INDICATOR_COLOR;
            }
            tft.fillRect(232, 0, 8, 135, LevelColor);
            tft.fillRect(233, 1, 6, barLevel, TFT_BLACK);
        }

        if (battery_voltage < (TTGO_BATTERY_MIN_VOLTAGE - 0.2)){
            tft.setCursor(0, 0);
            tft.fillScreen(TFT_BLACK);
            tft.setTextColor(TFT_WHITE);
            tft.setTextSize(2);
            tft.println("Battery level low");
            tft.println("Going into sleepmode");
            delay(5000);
            tft.writecommand(TFT_DISPOFF);
            tft.writecommand(TFT_SLPIN);
            initializeSleepMode();
        }
    } else {
        charingDevice = true;
    }
}

void TTGOEvaluateTally(String type, int r, int g, int b) {
    tft.setTextSize(2);
    tft.setCursor(0, 0);
    if (type != "") {
        tft.setTextColor(TFT_WHITE, TFT_BLACK);
        tft.fillScreen(tft.color565(r, g, b));
        tft.drawString(getDeviceNameById(selectedDeviceId).c_str(), 0, 0, 2);
    } else {
        tft.setTextColor(TFT_WHITE, TFT_BLACK);
        tft.fillScreen(TFT_BLACK);
        tft.drawString(getDeviceNameById(selectedDeviceId).c_str(), 0, 0, 2);
    }
}

void TTGOFillScreen(int r, int g, int b) {
    tft.fillScreen(tft.color565(r, g, b));
}

void TTGODisplaySettingsPage() {
    //displays the current network connection and Tally Arbiter server data
    tft.setCursor(0, 0);
    tft.setTextSize(2);
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.setTextSize(1);
    tft.setTextSize(1);
    tft.println("SSID: " + WiFi.SSID()); tft.println();
    tft.print("IP Addr: "); tft.setTextSize(2); tft.println(WiFi.localIP().toString()); tft.println(); tft.setTextSize(1);
    tft.println("Settings mode enabled.");
    tft.println();
    tft.println("To disable this mode, press the menu");
    tft.println("button one time to go to the info page.");
}

void TTGODisplayInfoPage() {
    //displays the current network connection and Tally Arbiter server data
    tft.setCursor(0, 0);
    tft.setTextSize(2);
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.setTextSize(1);
    tft.println("SSID: " + WiFi.SSID()); tft.println();
    tft.print("IP Addr: "); tft.setTextSize(2); tft.println(WiFi.localIP().toString()); tft.println(); tft.setTextSize(1);
    tft.print("TA Server:"); tft.setTextSize(2); tft.println(String(ta_host)); tft.println(); tft.setTextSize(1);
    tft.print("Battery: "); tft.setTextSize(2); tft.print(String(batteryLevel) + "% - " + String(battery_voltage, 2) + "V"); tft.println(); tft.setTextSize(1);
    if(charingDevice) {
        tft.print("Device powered via cable");
    }
}

void TTGODisplayMessage(String message, String type="info") {
    tft.setCursor(0, 0);
    tft.fillScreen(TFT_BLACK);
    if(message.length() <= 18) {
        tft.setTextSize(2);
    } else {
        tft.setTextSize(1);
    }
    if(type == "info") {
        tft.pushImage((tft.width()-InfoLogoWidth)/2, 20, InfoLogoWidth, InfoLogoHeight, InfoLogo);
        tft.setCursor(0, InfoLogoHeight + 50);
    } else if(type == "alert") {
        tft.pushImage((tft.width()-AlertLogoWidth)/2, 20, AlertLogoWidth, AlertLogoHeight, AlertLogo);
        tft.setCursor(0, AlertLogoHeight + 50);
    }
    tft.print(message.c_str());
}

#endif
