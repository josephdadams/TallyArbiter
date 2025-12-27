#include <M5AtomS3.h>
#include <FastLED.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Arduino_JSON.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <Preferences.h>

// Note: Remove ESPmDNS include if not needed - it's only used in commented code
// #include <ESPmDNS.h>

String listenerDeviceName = "atomS3Lite-";

/* USER CONFIG VARIABLES
 *  Change the following variables before compiling and sending the code to your device.
 */
#define LED_PIN 35        // GPIO pin for RGB LED on AtomS3 Lite
#define LED_BRIGHTNESS 50 // Set BRIGHTNESS (0-255)
#define NUM_LEDS 1        // Single RGB LED

// Declare the LED array
CRGB leds[NUM_LEDS];

//Tally Arbiter Server
char tallyarbiter_host[40] = "192.168.1.2"; //IP address of the Tally Arbiter Server
char tallyarbiter_port[6] = "4455";

/* END OF USER CONFIG */

Preferences preferences;

String prevType = ""; // reduce display flicker by storing previous state

String actualType = "";
String actualColor = "";
int actualPriority = 0;

//Tally Arbiter variables
SocketIOclient socket;
JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;
String DeviceId = "unassigned";
String DeviceName = "Unassigned";

//General Variables
bool networkConnected = false;
bool portalRunning = false; // Track if configuration portal is running

WiFiManager wm; // global wm instance

void setup() {
  Serial.begin(115200);
  // Note: while(!Serial) removed to save code space and allow operation without USB connection

  // Initialize the M5AtomS3 object
  logger("Initializing M5AtomS3 Lite.", "info-quiet");
  
  // Initialize M5AtomS3
  auto cfg = M5.config();
  M5.begin(cfg);
  
  // Initialize FastLED for RGB LED control
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(LED_BRIGHTNESS);
  
  // Set initial LED color to blue (connecting)
  leds[0] = CRGB::Blue;
  FastLED.show();
  
  // Save battery by turning down the CPU clock (if supported)
  // setCpuFrequencyMhz(80);
  btStop(); // Save battery by turning off Bluetooth

  uint64_t chipid = ESP.getEfuseMac();
  listenerDeviceName = listenerDeviceName + String((uint16_t)(chipid>>32)) + String((uint32_t)chipid);
  
  logger("Listener device name: " + listenerDeviceName, "info");

  preferences.begin("tally-arbiter", false);

  // added to clear out corrupt prefs
  //preferences.clear();
  logger("Reading preferences", "info-quiet");
  if(preferences.getString("deviceid").length() > 0){
    DeviceId = preferences.getString("deviceid");
  }
  if(preferences.getString("devicename").length() > 0){
    DeviceName = preferences.getString("devicename");
  }
  if(preferences.getString("taHost").length() > 0){
    String newHost = preferences.getString("taHost");
    logger("Setting TallyArbiter host as " + newHost, "info-quiet");
    newHost.toCharArray(tallyarbiter_host, 40);
  }
  if(preferences.getString("taPort").length() > 0){
    String newPort = preferences.getString("taPort");
    logger("Setting TallyArbiter port as " + newPort, "info-quiet");
    newPort.toCharArray(tallyarbiter_port, 6);
  }
 
  preferences.end();

  delay(100); //wait 100ms before moving on
  connectToNetwork(); //starts Wifi connection
  while (!networkConnected) {
    delay(200);
  }

  ArduinoOTA.setHostname(listenerDeviceName.c_str());
  ArduinoOTA.setPassword("tallyarbiter");
  ArduinoOTA
    .onStart([]() {
      String type;
      if (ArduinoOTA.getCommand() == U_FLASH)
        type = "sketch";
      else // U_SPIFFS
        type = "filesystem";

      // NOTE: if updating SPIFFS this would be the place to unmount SPIFFS using SPIFFS.end()
      Serial.println("Start updating " + type);
    })
    .onEnd([]() {
      Serial.println("\nEnd");
    })
    .onProgress([](unsigned int progress, unsigned int total) {
      Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    })
    .onError([](ota_error_t error) {
      Serial.printf("Error[%u]: ", error);
      if (error == OTA_AUTH_ERROR) logger("Auth Failed", "error");
      else if (error == OTA_BEGIN_ERROR) logger("Begin Failed", "error");
      else if (error == OTA_CONNECT_ERROR) logger("Connect Failed", "error");
      else if (error == OTA_RECEIVE_ERROR) logger("Receive Failed", "error");
      else if (error == OTA_END_ERROR) logger("End Failed", "error");
    });

  ArduinoOTA.begin();

  connectToServer();

}

void loop() {
  // Process WiFiManager portal if it's running
  if (portalRunning) {
    wm.process();
    // Keep purple LED on while portal is running (refresh periodically in case it gets overwritten)
    static unsigned long lastPortalLEDUpdate = 0;
    if (millis() - lastPortalLEDUpdate > 1000) { // Refresh every second
      leds[0] = CRGB::Purple;
      FastLED.show();
      lastPortalLEDUpdate = millis();
    }
  }
  
  ArduinoOTA.handle();
  socket.loop();
  M5.update();
  
  // Check if button is pressed (toggle configuration portal)
  if (M5.BtnA.wasPressed()) {
    logger("Button pressed", "info");
    toggleConfigPortal();
  }
  
  // Hold button for 5 seconds to reset WiFi
  if (M5.BtnA.pressedFor(5000)) {
    logger("Resetting WiFi settings", "info");
    wm.resetSettings();
    ESP.restart();
  }
}

void showDeviceInfo() {
  //displays the currently assigned device and tally data
  evaluateMode();
}

void toggleConfigPortal() {
  if (portalRunning) {
    // Stop the portal
    logger("Stopping configuration portal", "info");
    wm.stopWebPortal();
    portalRunning = false;
    // Return LED to normal state
    evaluateMode();
  } else {
    // Start the portal
    logger("Starting configuration portal", "info");
    logger("Access portal at: http://" + WiFi.localIP().toString(), "info");
    
    // Disable portal timeout so it stays open until manually closed
    wm.setConfigPortalTimeout(0); // 0 = no timeout
    
    wm.startWebPortal();
    portalRunning = true;
    // Indicate portal is running with purple LED
    leds[0] = CRGB::Purple;
    FastLED.show();
  }
}

void logger(String strLog, String strType) {
  Serial.println(strLog);
  /*
  if (strType == "info") {
    Serial.println(strLog);
  } else {
    Serial.println(strLog);
  }
  */
}

void connectToNetwork() {
  WiFi.mode(WIFI_STA); // explicitly set mode, esp defaults to STA+AP

  logger("Connecting to SSID: " + String(WiFi.SSID()), "info");

  //reset settings - wipe credentials for testing
  //wm.resetSettings();

  WiFiManagerParameter custom_taServer("taHostIP", "Tally Arbiter Server", tallyarbiter_host, 40);
  WiFiManagerParameter custom_taPort("taHostPort", "Port", tallyarbiter_port, 6);

  wm.addParameter(&custom_taServer);
  wm.addParameter(&custom_taPort);
  
  wm.setSaveParamsCallback(saveParamCallback);

  // custom menu via array or vector
  std::vector<const char *> menu = {"wifi","param","info","sep","restart","exit"};
  wm.setMenu(menu);

  // set dark theme
  wm.setClass("invert");

  wm.setConfigPortalTimeout(120); // auto close configportal after n seconds

  bool res;

  res = wm.autoConnect(listenerDeviceName.c_str()); // AP name for setup

  if (!res) {
    logger("Failed to connect", "error");
    // Show red LED for connection failure
    leds[0] = CRGB::Red;
    FastLED.show();
    // ESP.restart();
    portalRunning = false; // Portal closed after timeout
  } else {
    //if you get here you have connected to the WiFi
    logger("connected...yay :)", "info");
    networkConnected = true;
    
    // Show green LED briefly to indicate successful connection
    leds[0] = CRGB::Green;
    FastLED.show();
    delay(500);
    leds[0] = CRGB::Black;
    FastLED.show();
    
    // Note: Portal is automatically closed after successful connection
    // User can press button to re-open it anytime
    portalRunning = false;

    //TODO: fix MDNS discovery
    /*
    int nrOfServices = MDNS.queryService("tally-arbiter", "tcp");

    if (nrOfServices == 0) {
      logger("No server found.", "error");
    } else {
      logger("Number of servers found: ", "info");
      Serial.print(nrOfServices);
     
      for (int i = 0; i < nrOfServices; i=i+1) {
 
        Serial.println("---------------");
       
        Serial.print("Hostname: ");
        Serial.println(MDNS.hostname(i));

        Serial.print("IP address: ");
        Serial.println(MDNS.IP(i));

        Serial.print("Port: ");
        Serial.println(MDNS.port(i));

        Serial.println("---------------");
      }
    }
    */
  }
}

String getParam(String name) {
  //read parameter from server, for customhmtl input
  String value;
  if (wm.server->hasArg(name)) {
    value = wm.server->arg(name);
  }
  return value;
}


void saveParamCallback() {
  logger("[CALLBACK] saveParamCallback fired", "info-quiet");
  logger("PARAM tally Arbiter Server = " + getParam("taHostIP"), "info-quiet");
  String str_taHost = getParam("taHostIP");
  String str_taPort = getParam("taHostPort");

  logger("Saving new TallyArbiter host", "info-quiet");
  logger(str_taHost, "info-quiet");
  
  // Check if settings changed
  bool needsReconnect = (String(tallyarbiter_host) != str_taHost || String(tallyarbiter_port) != str_taPort);
  
  preferences.begin("tally-arbiter", false);
  preferences.putString("taHost", str_taHost);
  preferences.putString("taPort", str_taPort);
  preferences.end();
  
  // Update current values
  str_taHost.toCharArray(tallyarbiter_host, 40);
  str_taPort.toCharArray(tallyarbiter_port, 6);
  
  // Reconnect to server if settings changed
  if (needsReconnect && networkConnected) {
    logger("Tally Arbiter server settings changed, reconnecting...", "info");
    // Disconnect from old server
    socket.disconnect();
    delay(500);
    // Connect to new server
    connectToServer();
  }
}

void WiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case IP_EVENT_STA_GOT_IP:
      logger("Network connected!", "info");
      logger(WiFi.localIP().toString(), "info");
      networkConnected = true;
      break;
    case WIFI_EVENT_STA_DISCONNECTED:
      logger("Network connection lost!", "info");
      networkConnected = false;
      // Show red LED when disconnected
      leds[0] = CRGB::Red;
      FastLED.show();
      break;
    default:
      break;
  }
}

void ws_emit(String event, const char *payload = NULL) {
  if (payload) {
    String msg = "[\"" + event + "\"," + payload + "]";
    //Serial.println(msg);
    socket.sendEVENT(msg);
  } else {
    String msg = "[\"" + event + "\"]";
    //Serial.println(msg);
    socket.sendEVENT(msg);
  }
}

void connectToServer() {
  logger("Connecting to Tally Arbiter host: " + String(tallyarbiter_host), "info");
  socket.onEvent(socket_event);
  socket.begin(tallyarbiter_host, atol(tallyarbiter_port));
}

void socket_event(socketIOmessageType_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case sIOtype_CONNECT:
      socket_Connected((char*)payload, length);
      break;

    case sIOtype_DISCONNECT:
    case sIOtype_ACK:
    case sIOtype_ERROR:
    case sIOtype_BINARY_EVENT:
    case sIOtype_BINARY_ACK:
      // Not handled
      break;

    case sIOtype_EVENT:
      String msg = (char*)payload;
      String type = msg.substring(2, msg.indexOf("\"",2));
      String content = msg.substring(type.length() + 4);
      content.remove(content.length() - 1);

      logger("Got event '" + type + "', data: " + content, "info-quiet");

      if (type == "bus_options") BusOptions = JSON.parse(content);
      if (type == "reassign") socket_Reassign(content);
      if (type == "flash") socket_Flash();

      if (type == "deviceId") {
        DeviceId = content.substring(1, content.length()-1);
        SetDeviceName();
        showDeviceInfo();
      }

      if (type == "devices") {
        Devices = JSON.parse(content);
        SetDeviceName();
      }

      if (type == "device_states") {
        DeviceStates = JSON.parse(content);
        processTallyData();
      }

      break;
  }
}

void socket_Connected(const char * payload, size_t length) {
  logger("Connected to Tally Arbiter server.", "info");
  logger("DeviceId: " + DeviceId, "info-quiet");
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\", \"listenerType\": \"" + listenerDeviceName.c_str() + "\", \"canBeReassigned\": true, \"canBeFlashed\": true, \"supportsChat\": true }";
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  ws_emit("listenerclient_connect", charDeviceObj);
}

void socket_Flash() {
  //flash the LED white 3 times
  FastLED.setBrightness(255);
  for (int i = 0; i < 3; i++) {
    leds[0] = CRGB::White;
    FastLED.show();
    delay(500);
    leds[0] = CRGB::Black;
    FastLED.show();
    delay(500);
  }
  FastLED.setBrightness(LED_BRIGHTNESS);

  showDeviceInfo();
}

void setColor(uint32_t color) {
  // Convert 0xRRGGBB format to CRGB
  uint8_t r = (color >> 16) & 0xFF;
  uint8_t g = (color >> 8) & 0xFF;
  uint8_t b = color & 0xFF;
  leds[0] = CRGB(r, g, b);
  FastLED.show();
}

String strip_quot(String str) {
  if (str[0] == '"') {
    str.remove(0, 1);
  }
  if (str.endsWith("\"")) {
    str.remove(str.length()-1, 1);
  }
  return str;
}

void socket_Reassign(String payload) {
  String oldDeviceId = payload.substring(0, payload.indexOf(','));
  String newDeviceId = payload.substring(oldDeviceId.length()+1);
  newDeviceId = newDeviceId.substring(0, newDeviceId.indexOf(','));
  oldDeviceId = strip_quot(oldDeviceId);
  newDeviceId = strip_quot(newDeviceId);

  String reassignObj = "{\"oldDeviceId\": \"" + oldDeviceId + "\", \"newDeviceId\": \"" + newDeviceId + "\"}";
  char charReassignObj[1024];
  strcpy(charReassignObj, reassignObj.c_str());
  ws_emit("listener_reassign_object", charReassignObj);
  ws_emit("devices");
  
  // Flash white twice to indicate reassignment
  for (int i = 0; i < 2; i++) {
    leds[0] = CRGB::White;
    FastLED.show();
    delay(200);
    leds[0] = CRGB::Black;
    FastLED.show();
    delay(200);
  }
  
  logger("newDeviceId: " + newDeviceId, "info-quiet");
  DeviceId = newDeviceId;
  preferences.begin("tally-arbiter", false);
  preferences.putString("deviceid", newDeviceId);
  preferences.end();
  SetDeviceName();
}

void processTallyData() {
  bool typeChanged = false;
  for (int i = 0; i < DeviceStates.length(); i++) {
    if (DeviceStates[i]["sources"].length() > 0) {
      typeChanged = true;
      actualType = getBusTypeById(JSON.stringify(DeviceStates[i]["busId"]));
      actualColor = getBusColorById(JSON.stringify(DeviceStates[i]["busId"]));
      actualPriority = getBusPriorityById(JSON.stringify(DeviceStates[i]["busId"]));
    }
  }
  if(!typeChanged) {
    actualType = "";
    actualColor = "";
    actualPriority = 0;
  }
  evaluateMode();
}

String getBusTypeById(String busId) {
  for (int i = 0; i < BusOptions.length(); i++) {
    if (JSON.stringify(BusOptions[i]["id"]) == busId) {
      return JSON.stringify(BusOptions[i]["type"]);
    }
  }

  return "invalid";
}

String getBusColorById(String busId) {
  for (int i = 0; i < BusOptions.length(); i++) {
    if (JSON.stringify(BusOptions[i]["id"]) == busId) {
      return JSON.stringify(BusOptions[i]["color"]);
    }
  }

  return "invalid";
}

int getBusPriorityById(String busId) {
  for (int i = 0; i < BusOptions.length(); i++) {
    if (JSON.stringify(BusOptions[i]["id"]) == busId) {
      return (int) JSON.stringify(BusOptions[i]["priority"]).toInt();
    }
  }

  return 0;
}

void SetDeviceName() {
  for (int i = 0; i < Devices.length(); i++) {
    if (JSON.stringify(Devices[i]["id"]) == "\"" + DeviceId + "\"") {
      String strDevice = JSON.stringify(Devices[i]["name"]);
      DeviceName = strDevice.substring(1, strDevice.length() - 1);
      break;
    }
  }
  preferences.begin("tally-arbiter", false);
  preferences.putString("devicename", DeviceName);
  preferences.end();
  evaluateMode();
}

void evaluateMode() {
  // Don't update LED if configuration portal is running
  if (portalRunning) {
    return;
  }
  
  if(actualType != prevType) {
    // Remove quotes if present (from JSON.stringify) and # symbol
    String hexstring = actualColor;
    hexstring.replace("\"", "");
    hexstring.replace("#", "");
    
    // Parse hex string to RGB values
    long number = (long) strtol(hexstring.c_str(), NULL, 16);
    int r = (number >> 16) & 0xFF;
    int g = (number >> 8) & 0xFF;
    int b = number & 0xFF;
    
    if (actualType != "") {
      // Convert RGB to integer color value (0xRRGGBB format)
      uint32_t color = (r << 16) | (g << 8) | b;
      setColor(color);
    } else {
      setColor(0x000000); // Black/off as integer
    }

    logger("Device is in " + actualType + " (color " + actualColor + " r: " + String(r) + " g: " + String(g) + " b: " + String(b) + " - priority " + String(actualPriority) + ")", "info");

    prevType = actualType;
  }
}
