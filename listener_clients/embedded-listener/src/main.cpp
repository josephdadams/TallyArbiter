#include <Arduino.h>

#include <ArduinoJson.h>

#include <WebSocketsClient.h>
#include <SocketIOclient.h>

#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WiFiManager.h>

SocketIOclient socketIO;
WiFiManager wm; // global wm instance

void logger(String message, String logLevel)
{
  Serial.println(message);
}

void socketIOEvent(socketIOmessageType_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case sIOtype_DISCONNECT:
    Serial.printf("[IOc] Disconnected!\n");
    break;
  case sIOtype_CONNECT:
    Serial.printf("[IOc] Connected to url: %s\n", payload);

    // join default namespace (no auto join in Socket.IO V3)
    socketIO.send(sIOtype_CONNECT, "/");
    break;
  case sIOtype_EVENT:
    Serial.printf("[IOc] get event: %s\n", payload);
    break;
  case sIOtype_ACK:
    Serial.printf("[IOc] get ack: %u\n", length);
    break;
  case sIOtype_ERROR:
    Serial.printf("[IOc] get error: %u\n", length);
    break;
  case sIOtype_BINARY_EVENT:
    Serial.printf("[IOc] get binary: %u\n", length);
    break;
  case sIOtype_BINARY_ACK:
    Serial.printf("[IOc] get binary ack: %u\n", length);
    break;
  }
}

void browseService(const char * service, const char * proto){
  Serial.printf("Browsing for service _%s._%s.local. ... ", service, proto);
  int n = MDNS.queryService(service, proto);
  if (n == 0) {
    Serial.println("no services found");
  } else {
    Serial.print(n);
    Serial.println(" service(s) found");
    for (int i = 0; i < n; ++i) {
      // Print details for each service found
      Serial.print("  ");
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(MDNS.hostname(i));
      Serial.print(" (");
      Serial.print(MDNS.IP(i));
      Serial.print(":");
      Serial.print(MDNS.port(i));
      Serial.println(")");
    }
  }
  Serial.println();
}

void setup()
{
  Serial.begin(115200);
  while (!Serial);

#ifdef PLATFORM_ESP32
  // Save battery by turning off BlueTooth
  btStop();
#endif

  Serial.println("Initializing...");
  Serial.setDebugOutput(true);

  Serial.println();
  Serial.println();
  Serial.println();

  bool res;
  res = wm.autoConnect();

  if (!res) {
    Serial.println("Failed to connect");
    // ESP.restart();
  } else {
    // if you get here you have connected to the WiFi
    Serial.println("connected...yeey :)");
  }

  // server address, port and URL
  socketIO.begin("192.168.1.133", 4455);

  // event handler
  socketIO.onEvent(socketIOEvent);

  //TODO: extract device uid from flash
  if (!MDNS.begin("ESP32_Browser")) {
    Serial.println("Error setting up MDNS responder!");
    while(1){
      delay(1000);
    }
  }
}

//unsigned long messageTimestamp = 0;
void loop()
{
  /*
  browseService("http", "tcp");
  browseService("smb", "tcp");
  browseService("tally-arbiter", "tcp");
  */

  socketIO.loop();
  
  /*
  uint64_t now = millis();


  if (now - messageTimestamp > 2000)
  {
    messageTimestamp = now;

    // creat JSON message for Socket.IO (event)
    DynamicJsonDocument doc(1024);
    JsonArray array = doc.to<JsonArray>();

    // add event name
    // Hint: socket.on('event_name', ....
    array.add("event_name");

    // add payload (parameters) for the event
    JsonObject param1 = array.createNestedObject();
    param1["now"] = (uint32_t)now;

    // JSON to String (serializion)
    String output;
    serializeJson(doc, output);

    // Send event
    socketIO.sendEVENT(output);

    // Print JSON for debugging
    Serial.println(output);
  }
  */
}