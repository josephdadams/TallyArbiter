extern SocketIOclient socketIO;
extern WiFiManager wm;
extern String bus_options;
extern String devices;

#ifdef PLATFORM_M5STICKC
extern void m5stickcFillScreen(int r, int g, int b);
extern void m5stickcUpdateBrightness(uint8_t brightness);

#ifndef M5STICKC_BRIGHTNESS
#define M5STICKC_BRIGHTNESS 11
#endif
#endif
#ifdef PLATFORM_TTGO
extern void TTGOFillScreen(int r, int g, int b);
#endif

void convertColorToRGB(String hexstring, int & r, int & g, int & b)
{
  hexstring.replace("#", "");
  long number = (long) strtol( &hexstring[0], NULL, 16);

  r = number >> 16;
  g = number >> 8 & 0xFF;
  b = number & 0xFF;
}

void sendSocketEvent(String event_name, DynamicJsonDocument params)
{
  // create JSON message for Socket.IO (event)
  DynamicJsonDocument doc(1024);
  JsonArray array = doc.to<JsonArray>();

  array.add(event_name);
  array.add(params);

  // JSON to String (serializion)
  String output;
  serializeJson(doc, output);

  // Send event
  socketIO.sendEVENT(output);

  // Print JSON for debugging
  Serial.println(output);
}

String getSettingsPageParam(String name) {
  String value;
  if (wm.server->hasArg(name)) {
    value = wm.server->arg(name);
  }
  return value;
}

JsonObject getBusOptionById(String busId) {
  DynamicJsonDocument bus(1024);
  deserializeJson(bus, bus_options);

  JsonArray bus_options_array = bus.as<JsonArray>();

  for (JsonObject bus_option : bus_options_array) {
    if(bus_option["id"].as<String>() == busId) {
      return bus_option;
    }
  }

  return JsonObject();
}

String getDeviceNameById(String deviceId) {
  DynamicJsonDocument devices_parsed(1024);
  deserializeJson(devices_parsed, devices);

  JsonArray devices_options_array = devices_parsed.as<JsonArray>();

  for (JsonObject device_option : devices_options_array) {
    if(device_option["id"].as<String>() == deviceId) {
      return device_option["name"].as<String>();
    }
  }

  return "";
}

void writeOutput(int pin, bool value) {
  #ifdef INVERT_OUTPUT_LOGIC
    #if INVERT_OUTPUT_LOGIC
      value = !value;
    #endif
  #endif
  Serial.println("writeOutput " + String(value) + " to pin " + String(pin));
  digitalWrite(pin, value);
}

void flashLed(int r, int g, int b, int iterations, int delay_ms = 500, bool change_brightness = false, bool skip_if_has_screen = false) {
  if(change_brightness) {
    #ifdef ENABLE_ADAFRUIT_NEOPIXEL
    strip.setBrightness(255);
    #endif
    #ifdef PLATFORM_M5STICKC
    if(!skip_if_has_screen) {
      m5stickcUpdateBrightness(12);
    }
    #endif
  }
  
  for(int i=0; i<iterations || iterations == -1; i++) {
    #ifdef PREVIEW_TALLY_STATUS_PIN
    writeOutput(PREVIEW_TALLY_STATUS_PIN, HIGH);
    #endif
    #ifdef PROGRAM_TALLY_STATUS_PIN
    writeOutput(PROGRAM_TALLY_STATUS_PIN, HIGH);
    #endif
    #ifdef AUX_TALLY_STATUS_PIN
    writeOutput(AUX_TALLY_STATUS_PIN, HIGH);
    #endif
    #ifdef ENABLE_ADAFRUIT_NEOPIXEL
    setAdafruitNeoPixelColor(strip.Color(r, g, b));
    #endif
    #ifdef PLATFORM_M5STICKC
    if(!skip_if_has_screen) {
      m5stickcFillScreen(r, g, b);
    }
    #endif
    #ifdef PLATFORM_TTGO
    if(!skip_if_has_screen) {
      TTGOFillScreen(r, g, b);
    }
    #endif

    delay(delay_ms);

    #ifdef PREVIEW_TALLY_STATUS_PIN
    writeOutput(PREVIEW_TALLY_STATUS_PIN, LOW);
    #endif
    #ifdef PROGRAM_TALLY_STATUS_PIN
    writeOutput(PROGRAM_TALLY_STATUS_PIN, LOW);
    #endif
    #ifdef AUX_TALLY_STATUS_PIN
    writeOutput(AUX_TALLY_STATUS_PIN, LOW);
    #endif
    #ifdef ENABLE_ADAFRUIT_NEOPIXEL
    setAdafruitNeoPixelColor(ADAFRUIT_NEOPIXEL_BLACK);
    #endif
    #ifdef PLATFORM_M5STICKC
    if(!skip_if_has_screen) {
      m5stickcFillScreen(0, 0, 0);
    }
    #endif
    #ifdef PLATFORM_TTGO
    if(!skip_if_has_screen) {
      TTGOFillScreen(0, 0, 0);
    }
    #endif

    delay(delay_ms);
  }

  if(change_brightness) {
    #ifdef ENABLE_ADAFRUIT_NEOPIXEL
    strip.setBrightness(ADAFRUIT_NEOPIXEL_BRIGHTNESS);
    #endif
    #ifdef PLATFORM_M5STICKC
    if(!skip_if_has_screen) {
      m5stickcUpdateBrightness(M5STICKC_BRIGHTNESS);
    }
    #endif
  }
}
