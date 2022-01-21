extern SocketIOclient socketIO;
extern WiFiManager wm;
extern DynamicJsonDocument bus_options;

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

JsonObject getBusOptionById(String bus_id) {
  JsonArray bus_options_array = bus_options.as<JsonArray>();
  for (JsonObject bus : bus_options_array) {
    if (bus["id"].as<String>() == bus_id) {
      return bus;
    }
  }

  StaticJsonDocument<1> empty_doc;
  JsonObject empty_object = empty_doc.to<JsonObject>();
  return empty_object;
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
