#ifdef PLATFORM_M5STICKC

extern String selectedDeviceId;
extern char ta_host[60];
extern char ta_port[8];

#ifdef M5STICKC_PLUS_VARIANT
#include <M5StickCPlus.h>
#else
#include <M5StickC.h>
#endif

#define M5STICKC_GREY  0x0020 //   8  8  8
#define M5STICKC_GREEN 0x0200 //   0 64  0
#define M5STICKC_RED   0xF800 // 255  0  0
#define M5STICKC_WHITE 0xFFFF // 255 255 255
#define M5STICKC_BLACK 0x0000 //   0  0  0

#define M5STICKC_TFT_BLACK 0x0000 //   0  0  0

void m5stickcUpdateBrightness(uint8_t brightness) {
  M5.Axp.ScreenBreath(brightness);
}

void m5stickcInitialize() {
    M5.begin();
    M5.Lcd.setRotation(3);
    M5.Lcd.setCursor(0, 20);
    m5stickcUpdateBrightness(M5STICKC_BRIGHTNESS);
    M5.Lcd.fillScreen(M5STICKC_TFT_BLACK);
    //M5.Lcd.setFreeFont(FSS9);
    //M5.Lcd.setTextSize(2);
    M5.Lcd.setTextColor(M5STICKC_WHITE, M5STICKC_BLACK);
    M5.Lcd.println("booting...");
}

void m5stickcEvaluateTally(String type, int r, int g, int b) {
    M5.Lcd.setCursor(4, 82);
    if (type != "") {
        M5.Lcd.setTextColor(M5STICKC_BLACK);
        M5.Lcd.fillScreen(M5.Lcd.color565(r, g, b));
        M5.Lcd.println(getDeviceNameById(selectedDeviceId));
    } else {
        M5.Lcd.setTextColor(M5STICKC_GREY, M5STICKC_BLACK);
        M5.Lcd.fillScreen(M5STICKC_TFT_BLACK);
        M5.Lcd.println(getDeviceNameById(selectedDeviceId));
    }
}

void m5stickcFillScreen(int r, int g, int b) {
    M5.Lcd.fillScreen(M5.Lcd.color565(r, g, b));
}

void m5stickcDisplaySettingsPage() {
    //displays the current network connection and Tally Arbiter server data
    M5.Lcd.setCursor(0, 20);
    M5.Lcd.fillScreen(M5STICKC_TFT_BLACK);
    //M5.Lcd.setFreeFont(FSS9);
    //M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(M5STICKC_WHITE, M5STICKC_BLACK);
    M5.Lcd.println("SSID: " + String(WiFi.SSID()));
    M5.Lcd.println("Network ip address: " + WiFi.localIP().toString());
    M5.Lcd.println();
    M5.Lcd.println("Settings mode enabled. Go to http://" + WiFi.localIP().toString() + " to configure or update \"Over The Air\" this device.");
    M5.Lcd.println();
    M5.Lcd.println("To disable this mode, press the menu button one time to go to the info page.");
}

void m5stickcDisplayInfoPage() {
    //displays the current network connection and Tally Arbiter server data
    M5.Lcd.setCursor(0, 20);
    M5.Lcd.fillScreen(M5STICKC_TFT_BLACK);
    //M5.Lcd.setFreeFont(FSS9);
    //M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(M5STICKC_WHITE, M5STICKC_BLACK);
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
}

#endif

