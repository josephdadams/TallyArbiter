#ifdef PLATFORM_M5STICKC

extern String selectedDeviceId;

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

void m5stickFillScreen(int r, int g, int b) {
    M5.Lcd.fillScreen(M5.Lcd.color565(r, g, b));
}

#endif

