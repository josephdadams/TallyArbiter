#include <Arduino.h>

#include <ArduinoJson.h>

#include <WebSocketsClient.h>
#include <SocketIOclient.h>

#include <DNSServer.h>
#include <WiFiManager.h>

#include <utils.h>
#include <user_config.h>

#ifdef PLATFORM_ARCH_ESP32
#include <ESPmDNS.h>
#endif
#ifdef PLATFORM_ARCH_ESP8266
#include <ESP8266mDNS.h>
#endif

#ifdef PLATFORM_ARCH_ESP32
#include <Preferences.h>
#endif
#ifdef PLATFORM_ARCH_ESP8266
#warning "ESP8266 EEPROM not supported yet. Can't save WiFi credentials."
//TODO: implement esp32 data saving
#endif

#ifdef ENABLE_ADAFRUIT_NEOPIXEL
#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(ADAFRUIT_NEOPIXEL_LED_COUNT, ADAFRUIT_NEOPIXEL_LED_PIN, ADAFRUIT_NEOPIXEL_TYPE);
#define ADAFRUIT_NEOPIXEL_WHITE strip.Color(255, 255, 255)
#define ADAFRUIT_NEOPIXEL_BLACK strip.Color(0, 0, 0)

void setAdafruitNeoPixelColor(uint32_t color) {
  for(int i=0; i<strip.numPixels(); i++) { // For each pixel in strip...
    strip.setPixelColor(i, color);         //  Set pixel's color (in RAM)
    strip.show();                          //  Update strip to match
  }
}
#endif

#ifdef PLATFORM_M5STICKC
#include <platform_M5StickC.h>
#endif

#ifdef MENU_BUTTON_PIN
#include <menu_navigation.h>
#endif

SocketIOclient socketIO;

WiFiManager wm;
#ifdef PLATFORM_ARCH_ESP32
Preferences preferences;
#endif
WiFiManagerParameter ta_host_param("host", "TallyArbiter server host", "", 60);
WiFiManagerParameter ta_port_param("port", "TallyArbiter port", "4455", 8);
char ta_host[60] = "";
char ta_port[8] = "4455";

String deviceCode;
String selectedDeviceId;

String bus_options;
String devices;
String last_bus_type;

void event_error(String error)
{
  Serial.println("Server reported an error: " + error);
}

void event_bus_options(DynamicJsonDocument new_bus_options)
{
  serializeJson(new_bus_options, bus_options);
  Serial.println("Bus options received");
}

void event_devices(DynamicJsonDocument new_devices)
{
  serializeJson(new_devices, devices);
  Serial.println("Devices received");
}

void event_device_states(DynamicJsonDocument device_states)
{
  JsonArray device_states_array = device_states.as<JsonArray>();
  Serial.println("New device states received");
  serializeJson(device_states, Serial); Serial.println();

  if(bus_options == "") {
    Serial.println("No bus options received yet, skipping tally update.");
    return;
  }

  int index = 0;

  bool state_changed = false;

  bool preview_led_output = false;
  bool program_led_output = false;
  bool aux_led_output = false;

  for (JsonObject state : device_states_array) {
    if(state["deviceId"].as<String>() == selectedDeviceId && state["sources"].as<JsonArray>().size() > 0) {
      JsonObject bus = getBusOptionById(state["busId"].as<String>());
      if(bus.isNull()) {
        Serial.println("No bus option found for device " + state["deviceId"].as<String>() + " busId: " + state["busId"].as<String>());
        continue;
      }

      String bus_type = bus["type"].as<String>();
      if(bus_type.equals(last_bus_type)) {
        Serial.println("Skipping tally update for device " + state["deviceId"].as<String>() + " busId: " + state["busId"].as<String>() + " because bus type is the same as last time.");
        continue;
      }

      int r, g, b;
      convertColorToRGB(bus["color"].as<String>(), r, g, b);

      Serial.print("Found bus option: " + bus["id"].as<String>() + " (type: " + bus_type + ") ");
      Serial.println(" color " + bus["color"].as<String>() + " (" + String(r) + ", " + String(g) + ", " + String(b) + ")");
      Serial.println(last_bus_type + " -> " + bus_type);

      state_changed = true;

      if(bus_type.equals("preview")) {
        preview_led_output = true;
      } else if(bus_type.equals("program")) {
        program_led_output = true;
      } else if(bus_type.equals("aux")) {
        aux_led_output = true;
      }
      
      #ifdef PREVIEW_TALLY_STATUS_PIN
      writeOutput(PREVIEW_TALLY_STATUS_PIN, preview_led_output);
      #endif
      #ifdef PROGRAM_TALLY_STATUS_PIN
      writeOutput(PROGRAM_TALLY_STATUS_PIN, program_led_output);
      #endif
      #ifdef AUX_TALLY_STATUS_PIN
      writeOutput(AUX_TALLY_STATUS_PIN, aux_led_output);
      #endif

      #ifdef ENABLE_ADAFRUIT_NEOPIXEL
      setAdafruitNeoPixelColor(strip.Color(r, g, b));
      #endif

      #ifdef PLATFORM_M5STICKC
      m5stickcEvaluateTally(bus_type, r, g, b);
      #endif

      last_bus_type = bus_type;
    }

    index++;
  }

  if(!state_changed) {
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
    setAdafruitNeoPixelColor(strip.Color(0, 0, 0));
    #endif

    last_bus_type = "";
  }
}

void event_reassign(String old_device, String new_device)
{
  Serial.println("Reassign device");
  selectedDeviceId = new_device;

  #ifdef PLATFORM_ARCH_ESP32
  preferences.begin("tally-arbiter");
  preferences.putString("ta_deviceId", new_device);
  preferences.end();
  #endif

  flashLed(255, 255, 255, 2, 200);
}

void event_flash()
{
  Serial.println("Flashing device");
  flashLed(255, 255, 255, 3, 500, true);
  
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
      flashLed(255, 0, 0, -1, 3000);
      break;
    case sIOtype_CONNECT:{
      Serial.printf("[IOc] Connected to url: %s\n", payload);
      // join default namespace (no auto join in Socket.IO V3)
      socketIO.send(sIOtype_CONNECT, "/");

      DynamicJsonDocument listenerClientConnect(1024);
      listenerClientConnect["deviceId"] = selectedDeviceId;
      listenerClientConnect["listenerType"] = String(PLATFORM_NAME)+"-"+deviceCode;
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
  
  #ifdef PLATFORM_ARCH_ESP32
  preferences.begin("tally-arbiter");
  preferences.putString("ta_host", str_taHost);
  preferences.putString("ta_port", str_taPort);
  preferences.end();
  #endif

  str_taHost.toCharArray(ta_host, 60);
  str_taPort.toCharArray(ta_port, 8);
}

void resetDevice() {
  Serial.println("Resetting device");
  wm.resetSettings();
  #ifdef PLATFORM_ARCH_ESP32
  preferences.clear();
  #endif
  flashLed(128, 0, 0, 3, 200, true);
  ESP.restart();
}

void setup()
{
  Serial.begin(115200);
  while (!Serial);

#ifdef PLATFORM_ESP32
  // Save battery by turning off BlueTooth
  btStop();
#endif


#ifdef PROGRAM_TALLY_STATUS_PIN
  pinMode(PROGRAM_TALLY_STATUS_PIN, OUTPUT);
  writeOutput(PROGRAM_TALLY_STATUS_PIN, LOW);
#endif
#ifdef PREVIEW_TALLY_STATUS_PIN
  pinMode(PREVIEW_TALLY_STATUS_PIN, OUTPUT);
  writeOutput(PREVIEW_TALLY_STATUS_PIN, LOW);
#endif
#ifdef AUX_TALLY_STATUS_PIN
  pinMode(AUX_TALLY_STATUS_PIN, OUTPUT);
  writeOutput(AUX_TALLY_STATUS_PIN, LOW);
#endif

#ifdef ENABLE_ADAFRUIT_NEOPIXEL
  strip.begin();           // INITIALIZE NeoPixel strip object (REQUIRED)
  strip.show();            // Turn OFF all pixels ASAP
  strip.setBrightness(ADAFRUIT_NEOPIXEL_BRIGHTNESS);
  setAdafruitNeoPixelColor(strip.Color(0, 0, 255));
#endif

#ifdef PLATFORM_M5STICKC
  m5stickcInitialize();
#endif

  byte mac[6];
  WiFi.macAddress(mac);

  deviceCode = String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
  Serial.println("Device code: " + deviceCode);

  Serial.println("Initializing...");
  Serial.setDebugOutput(true);

  #ifdef PLATFORM_ARCH_ESP32
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
  #endif

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
    flashLed(255, 0, 0, -1, 300);
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

  #ifdef MENU_BUTTON_PIN
  menuLoop();
  #endif
}
