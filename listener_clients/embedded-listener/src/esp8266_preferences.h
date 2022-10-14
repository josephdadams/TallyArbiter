#ifndef esp8266Preferences_h
#define esp8266Preferences_h

#include <Arduino.h>
#include <ArduinoJson.h>

#include <LittleFS.h>

class Preferences
{
  public:
    Preferences() {
        Serial.print("Preferences() loaded");
    }
    void begin(const char *name) {
        Serial.println("begin: " + String(name));
        LittleFS.begin();
    }
    void putString(const char *key, String value) {
        Serial.println("putString: " + String(key) + " " + String(value));
        File file = LittleFS.open("/"+String(key)+".txt", "w");
        file.print(value);
        delay(1);
        file.close();
    }
    String getString(const char *key, String defaultValue = "12345") {
        Serial.println("getString: " + String(key) + " " + String(defaultValue));
        File file = LittleFS.open("/"+String(key)+".txt", "r");
        delay(1);
        String content = file.readString();
        delay(1);
        file.close();
        return content;
    }
    void end() {
        Serial.println("end");
    }
    void clear() {
        Serial.println("clear");
        LittleFS.format();
    }
};

#endif