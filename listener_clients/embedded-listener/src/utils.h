extern SocketIOclient socketIO;
extern WiFiManager wm;
extern String bus_options;

void convertColorToRGB(String hexstring, int & r, int & g, int & b)
{
  hexstring.replace("#", "");
  long number = (long) strtol( &hexstring[1], NULL, 16);

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

void writeOutput(int pin, bool value) {
  #ifdef INVERT_OUTPUT_LOGIC
    #if INVERT_OUTPUT_LOGIC
      value = !value;
    #endif
  #endif
  Serial.println("writeOutput " + String(value) + " to pin " + String(pin));
  digitalWrite(pin, value);
}

void flashLed(int r, int g, int b, int iterations, int delay_ms = 500, bool change_brightness = false) {
  #ifdef ENABLE_ADAFRUIT_NEOPIXEL
  if(change_brightness) {
    strip.setBrightness(255);
  }
  #endif
  
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

    delay(delay_ms);
  }

  #ifdef ENABLE_ADAFRUIT_NEOPIXEL
  if(change_brightness) {
    strip.setBrightness(ADAFRUIT_NEOPIXEL_BRIGHTNESS);
  }
  #endif
}
