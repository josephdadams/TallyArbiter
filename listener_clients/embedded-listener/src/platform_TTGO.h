#ifdef PLATFORM_TTGO

extern String selectedDeviceId;
extern char ta_host[60];
extern char ta_port[8];

#include <TFT_eSPI.h> // Graphics and font library for ST7735 driver chip
#include <SPI.h>

#include "TFT_TallyArbiter_logo.h"

TFT_eSPI tft = TFT_eSPI();

void TTGOInitialize() {
    tft.init();
    tft.setRotation(TTGO_SCREEN_ROTATION);
    tft.setCursor(0, 0);
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(TFT_WHITE);
    tft.setTextSize(2);
    tft.setSwapBytes(TTGO_SWAP_BYTES);
    tft.pushImage(0, 0,  240, 135, TallyArbiterLogo);
}

void TTGOEvaluateTally(String type, int r, int g, int b) {
    tft.setTextSize(1);
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

void TTGODisplaySettingsPage() {
    /*
    //displays the current network connection and Tally Arbiter server data
    M5.Lcd.setCursor(0, 20);
    M5.Lcd.fillScreen(TFT_BLACK);
    //M5.Lcd.setFreeFont(FSS9);
    //M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(WHITE, BLACK);
    M5.Lcd.println("SSID: " + String(WiFi.SSID()));
    M5.Lcd.println("Network ip address: " + WiFi.localIP().toString());
    M5.Lcd.println();
    M5.Lcd.println("Settings mode enabled. Go to http://" + WiFi.localIP().toString() + " to configure or update \"Over The Air\" this device.");
    M5.Lcd.println();
    M5.Lcd.println("To disable this mode, press the menu button one time to go to the info page.");
    */
}

void TTGODisplayInfoPage() {
    /*
    //displays the current network connection and Tally Arbiter server data
    M5.Lcd.setCursor(0, 20);
    M5.Lcd.fillScreen(TFT_BLACK);
    //M5.Lcd.setFreeFont(FSS9);
    //M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(WHITE, BLACK);
    M5.Lcd.println("SSID: " + String(WiFi.SSID()));
    M5.Lcd.println("Network ip address: " + WiFi.localIP().toString());

    M5.Lcd.println("Tally Arbiter Server:");
    M5.Lcd.println(String(ta_host) + ":" + String(ta_port));
    M5.Lcd.println();
    M5.Lcd.print("Battery: ");
    int batteryLevel = floor(100.0 * (((M5.Axp.GetVbatData() * 1.1 / 1000) - 3.0) / (4.07 - 3.0)));
    batteryLevel = batteryLevel > 100 ? 100 : batteryLevel;
    if(batteryLevel >= 100){
        M5.Lcd.println("Charging...");   // show when M5 is plugged in
    } else {
        M5.Lcd.println(String(batteryLevel) + "%");
    }
    */
}

#endif
