#include <PinButton.h>

PinButton menuButton(MENU_BUTTON_PIN);
#ifdef SLEEP_BUTTON_PIN
PinButton sleepButton(SLEEP_BUTTON_PIN);
#endif
extern WiFiManager wm;

extern void resetDevice();

String currentScreen = "";
bool portalRunning = false;
unsigned long resetRequestedClickTime;

void showSettingsScreen() {
    Serial.println("Activated screen 'settings'");
    Serial.println("SSID: " + String(WiFi.SSID()));
    Serial.println("Network ip address: " + WiFi.localIP().toString());
    wm.startWebPortal();

    portalRunning = true;
    currentScreen = "settings";

    #ifdef PLATFORM_M5STICKC
    m5stickcDisplaySettingsPage();
    #endif

    #ifdef PLATFORM_TTGO
    TTGODisplaySettingsPage();
    #endif
}

void showInfoScreen() {
    Serial.println("Activated screen 'info'");
    if(currentScreen = "settings") {
        wm.stopWebPortal();
        portalRunning = false;
    }

    currentScreen = "info";

    #ifdef PLATFORM_M5STICKC
    m5stickcDisplayInfoPage();
    #endif

    #ifdef PLATFORM_TTGO
    TTGODisplayInfoPage();
    #endif
}

void initializeSleepMode() {
    #ifdef SLEEP_BUTTON_PIN
    Serial.println("Activating sleep mode...");
    esp_sleep_enable_ext0_wakeup((gpio_num_t)SLEEP_BUTTON_PIN, 0);
    delay(200);
    esp_deep_sleep_start();
    #else
    Serial.println("No sleep button pin defined, so we can't go in sleep mode");
    #endif
}

void menuLoop() {
    if(portalRunning){
        wm.process();
    }

    if(resetRequestedClickTime > 0 && millis() - resetRequestedClickTime > 10000) {
        resetRequestedClickTime = 0;
        Serial.println("Reset confirm timeout expired. Please long-press the button again to reset.");
        #ifdef PLATFORM_TTGO
        tft.setCursor(0, 0);
        tft.fillScreen(TFT_BLACK);
        tft.setTextColor(TFT_WHITE);
        tft.setTextSize(2); tft.println("Confirm timeout exp.");
        tft.setTextSize(1); tft.println("Please long-press the button again to reset.");
        #endif
        delay(5000);
        showInfoScreen();
    }

    menuButton.update();

    if (menuButton.isSingleClick()) {
        showInfoScreen();
    } else if (menuButton.isDoubleClick()) {
        showSettingsScreen();
    } else if (menuButton.isLongClick()) {
        if(resetRequestedClickTime == 0) {
            resetRequestedClickTime = millis();
            Serial.println("Long press the button again to confirm (you have 10 seconds to confirm)");
            #ifdef PLATFORM_TTGO
            tft.setCursor(0, 0);
            tft.fillScreen(TFT_BLACK);
            tft.setTextColor(TFT_WHITE);
            tft.setTextSize(2); tft.println("Longpress to confirm");
            tft.setTextSize(1); tft.println("(you have 10 seconds to confirm)");
            #endif
        } else if(millis() - resetRequestedClickTime < 10000) {
            resetDevice();
        }
    }

    #ifdef SLEEP_BUTTON_PIN
    sleepButton.update();

    if (sleepButton.isSingleClick()) {
        initializeSleepMode();
    } else if (sleepButton.isLongClick()) {
        Serial.println("Restarting...");
        ESP.restart();
    }
    #endif
}
