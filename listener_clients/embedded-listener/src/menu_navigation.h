#include <PinButton.h>

PinButton menuButton(MENU_BUTTON_PIN);
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
}

void menuLoop() {
    if(portalRunning){
        wm.process();
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
        } else if(millis() - resetRequestedClickTime < 10000) {
            resetDevice();
        } else {
            resetRequestedClickTime = 0;
            Serial.println("Reset cancelled");
        }
    }
}