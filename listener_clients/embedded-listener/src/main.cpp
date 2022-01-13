#include <Arduino.h>

#include <ArduinoJson.h>

#include <WebSocketsClient.h>
#include <SocketIOclient.h>

#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WiFiManager.h>

SocketIOclient socketIO;
WiFiManager wm;

String deviceCode;

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

void event_error(String error)
{
  Serial.println("Server reported an error: " + error);
}

void event_bus_options(DynamicJsonDocument bus_options)
{
  Serial.println("Bus options received");
}

void event_devices(DynamicJsonDocument devices)
{
  Serial.println("Devices received");
}

void event_device_states(DynamicJsonDocument device_states)
{
  Serial.println("New device states received");
}

void event_reassign(String old_device, String new_device)
{
  Serial.println("Reassign device");
}

void event_flash()
{
  Serial.println("Flashing device");
}

void event_messaging(String type, String socketId, String message)
{
  Serial.println("Received new message (type " + type + ", socketId " + socketId+ "): " + message);
}

void socketIOEvent(String event_name, DynamicJsonDocument payload)
{
  Serial.print("Event: ");
  Serial.println(event_name);

  if(event_name == "bus_options") event_bus_options(payload[1]);
  if(event_name == "devices") event_devices(payload[1]);
  if(event_name == "device_states") event_device_states(payload[1]);
  if(event_name == "reassign") event_reassign(payload[1], payload[2]);
  if(event_name == "flash") event_flash();
  if(event_name == "messaging") event_messaging(payload[1], payload[2], payload[3]);
  if(event_name == "error") event_error(payload[1]);

}

void socketIOConnEvent(socketIOmessageType_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
    case sIOtype_DISCONNECT:
      Serial.printf("[IOc] Disconnected!\n");
      break;
    case sIOtype_CONNECT:{
      Serial.printf("[IOc] Connected to url: %s\n", payload);
      // join default namespace (no auto join in Socket.IO V3)
      socketIO.send(sIOtype_CONNECT, "/");

      DynamicJsonDocument listenerClientConnect(1024);
      listenerClientConnect["deviceId"] = "test"; //TODO: read from WiFiManager settings (so its saved with connection params and can be erased easily)
      listenerClientConnect["listenerType"] = "embedded listener_"+deviceCode; //TODO: read device type from build envs;
      listenerClientConnect["canBeReassigned"] = true;
      listenerClientConnect["canBeFlashed"] = true;
      listenerClientConnect["supportsChat"] = true;

      sendSocketEvent("listenerclient_connect", listenerClientConnect);
    }break;
    case sIOtype_EVENT:{
      Serial.printf("[IOc] get event: %s\n", payload);
      DynamicJsonDocument event(1024);
      deserializeJson(event, payload);
      socketIOEvent(event[0], event);
    }break;
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
    default:
      break;
  }
}

void setup()
{
  Serial.begin(115200);
  while (!Serial);

#ifdef PLATFORM_ESP32
  // Save battery by turning off BlueTooth
  btStop();
#endif

  byte mac[6];
  WiFi.macAddress(mac);

  deviceCode = String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
  Serial.println("Device code: " + deviceCode);

  Serial.println("Initializing...");
  Serial.setDebugOutput(true);

  Serial.println();
  Serial.println();
  Serial.println();

  bool res;
  res = wm.autoConnect();

  if (!res) {
    Serial.println("Failed to connect");
  } else {
    Serial.println("Connected to the WiFi... yeey :)");
  }

  //TODO: replace hard-coded credentials for connecting to my dev-env with reading WifiManager settings
  //TODO: automatic TA server discovery via MDNS (actually, doesn't working in setup, works only in loop, and doesn't report the server ip and port)
  // server address, port and URL
  socketIO.begin("192.168.1.133", 4455);

  // event handler
  socketIO.onEvent(socketIOConnEvent);

  String MDNS_name = "ta_listener_" + deviceCode;
  if (!MDNS.begin(MDNS_name.c_str())) {
    Serial.println("Error setting up MDNS responder!");
    while(1){
      delay(1000);
    }
  }
}

void loop()
{
  socketIO.loop();
}
