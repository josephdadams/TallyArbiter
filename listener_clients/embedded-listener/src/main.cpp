#include <Arduino.h>

#include <ArduinoJson.h>

#include <WebSocketsClient.h>
#include <SocketIOclient.h>

#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WiFiManager.h>
#include <Preferences.h>

#include <utils.h>
#include <user_config.h>

SocketIOclient socketIO;

WiFiManager wm;
Preferences preferences;
WiFiManagerParameter ta_host_param("host", "TallyArbiter server host", "", 60);
WiFiManagerParameter ta_port_param("port", "TallyArbiter port", "4455", 8);
char ta_host[60] = "";
char ta_port[8] = "4455";

String deviceCode;
String selectedDeviceId;

DynamicJsonDocument bus_options(800);
DynamicJsonDocument devices(2048);
DynamicJsonDocument device_states(1024);

void event_error(String error)
{
  Serial.println("Server reported an error: " + error);
}

void event_bus_options(DynamicJsonDocument new_bus_options)
{
  bus_options = new_bus_options;
  JsonArray bus_options_array = bus_options.as<JsonArray>();
  Serial.println("Bus options received");
  serializeJson(bus_options, Serial);

  int index = 0;
  for (JsonObject bus : bus_options_array) {
    int r, g, b;
    convertColorToRGB(bus["color"].as<String>(), r, g, b);
    Serial.println("Bus " + String(index) + ": " + bus["id"].as<String>() + " r: " + String(r) + " g: " + String(g) + " b: " + String(b));

    index++;
  }
}

void event_devices(DynamicJsonDocument new_devices)
{
  devices = new_devices;
  Serial.println("Devices received");
}

void event_device_states(DynamicJsonDocument new_device_states)
{
  device_states = new_device_states;
  Serial.println("New device states received");
}

void event_reassign(String old_device, String new_device)
{
  Serial.println("Reassign device");
  selectedDeviceId = new_device;

  preferences.begin("tally-arbiter");
  preferences.putString("ta_deviceId", new_device);
  preferences.end();
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
      listenerClientConnect["deviceId"] = selectedDeviceId;
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

void saveParamCallback() {
  String str_taHost = getSettingsPageParam("host");
  String str_taPort = getSettingsPageParam("port");

  Serial.println("Saving new TallyArbiter host");
  
  preferences.begin("tally-arbiter");
  preferences.putString("ta_host", str_taHost);
  preferences.putString("ta_port", str_taPort);
  preferences.end();

  str_taHost.toCharArray(ta_host, 60);
  str_taPort.toCharArray(ta_port, 8);
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

  preferences.begin("tally-arbiter");
  Serial.println("Reading preferences");
  if(preferences.getString("ta_host").length() > 0){
    String newHost = preferences.getString("ta_host");
    newHost.toCharArray(ta_host, 60);
  }
  if(preferences.getString("ta_port").length() > 0){
    String newPort = preferences.getString("ta_port");
    newPort.toCharArray(ta_port, 8);
  }
  if(preferences.getString("ta_deviceId").length() > 0){
    selectedDeviceId = preferences.getString("ta_deviceId");
  }
  preferences.end();

  Serial.println();
  Serial.println();
  Serial.println();

  wm.addParameter(&ta_host_param);
  wm.addParameter(&ta_port_param);

  wm.setSaveParamsCallback(saveParamCallback);

  bool res;
  res = wm.autoConnect();

#if USE_STATIC_IP
  wm.setSTAStaticIPConfig(STATIC_IP_ADDR, GATEWAY_IP_ADDR, SUBNET_ADDR, DNS_ADDR); // optional DNS 4th argument
#endif

  if (!res) {
    Serial.println("Failed to connect");
  } else {
    Serial.println("Connected to the WiFi... yeey :)");
  }

  //TODO: automatic TA server discovery via MDNS (actually, doesn't working in setup, works only in loop, and doesn't report the server ip and port)
  // server address, port and URL
  Serial.println("Connecting to " + String(ta_host) + ":" + String(ta_port));
  socketIO.begin(ta_host, atol(ta_port));

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
