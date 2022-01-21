extern SocketIOclient socketIO;
extern WiFiManager wm;

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
