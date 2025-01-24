//
// Automatic support for board selection with Arduino IDE
//
// Board defines used by Arduino IDE as preprocessor flags when selecting boards
// Boards > M5Stack Arduino > M5StickC / M5StickCPlus / M5StickCPlus2
// M5StickC        ARDUINO_m5stack_stickc
// M5StickC-Plus   ARDUINO_m5stack_stickc_plus
// M5StickC-Plus2  ARDUINO_m5stack_stickc_plus2
//
#if defined(ARDUINO_m5stack_stickc)
#define STICK_C
#endif

#if defined(ARDUINO_m5stack_stickc_plus)
#define STICK_C_PLUS
#endif

#if defined(ARDUINO_m5stack_stickc_plus2)
#define STICK_C_PLUS2
#endif

//
// Uncomment the platform you're building for
// ==========================================
// If using an environment without support for the preprocessor flags uncomment
// the specifc board type.
//
// Uncommenting more than one at a time will result in errors
//
//#define STICK_C
//#define STICK_C_PLUS
//#define STICK_C_PLUS2

// The default is M5StickC if nothing is specified. This is also the only
// supported board type in the github builds.
#if !defined(STICK_C) && !defined(STICK_C_PLUS) && !defined(STICK_C_PLUS2)
#define STICK_C
#endif

//
// Guard againts multiple defines.
//
#if defined(STICK_C_PLUS2)
#include <M5StickCPlus2.h>
#if defined(STICK_C) || defined(STICK_C_PLUS)
#error "Multiple m5stick boards types defined"
#endif
#endif

#if defined(STICK_C_PLUS)
#include <M5StickCPlus.h>
#if defined(STICK_C) || defined(STICK_C_PLUS2)
#error "Multiple m5stick boards types defined"
#endif
#endif

#if defined(STICK_C)
#include <M5StickC.h>
#if defined(STICK_C_PLUS) || defined(STICK_C_PLUS2)
#error "Multiple m5stick boards types defined"
#endif
#endif

#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Arduino_JSON.h>
#include <PinButton.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include "Free_Fonts.h"

#define TRIGGER_PIN 0  //reset pin
#define GREY 0x0020    //   8  8  8
#define GREEN 0x0200   //   0 64  0
#define RED 0xF800     // 255  0  0
#define maxTextSize 5  //larger sourceName text
#define startBrightness 11
#define maxBrightness 100
// Name of the device - the 3 last bytes of the mac address will be appended to create a unique identifier for the server.
#if defined(STICK_C_PLUS2)
String listenerDeviceName = "m5StickC-plus2-";
String listenerDeviceHW = "M5StickC-Plus2";
#endif
#if defined(STICK_C_PLUS)
String listenerDeviceName = "m5StickC-plus-";
String listenerDeviceHW = "M5StickC-Plus";
#endif
#if defined(STICK_C)
String listenerDeviceName = "m5StickC-";
String listenerDeviceHW = "M5StickC";
#endif


/* USER CONFIG VARIABLES
    Change the following variables before compiling and sending the code to your device.
*/

bool LAST_MSG = false;  // true = show log on tally screen

//Tally Arbiter Server
char tallyarbiter_host[40] = "192.168.0.110";  //IP address of the Tally Arbiter Server
char tallyarbiter_port[6] = "4455";

/* END OF USER CONFIG */

//M5StickC variables
PinButton btnM5(37);      //the "M5" button on the device (Button A)
PinButton btnAction(39);  //the "Action" button on the device (Button B)
Preferences preferences;
uint8_t wasPressed();

#define TALLY_EXTRA_OUTPUT false

#if TALLY_EXTRA_OUTPUT
// M5STICKC_PLUS_2
// Program (Internal led): 19: LOW is off, HIGH is on
// Preview: 26
// Aux: 25
// M5STICKC_PLUS
// Program (Internal led): 10: Low is on, HIGH is off
// Preview: 26
// Aux: 25
// M5STICKC
// Program (Internal led): 10: Low is on, HIGH is off
// Preview: 26
// Aux: Not supported
#if defined(STICK_C_PLUS2)
const int led_program = 19;  //OPTIONAL Led for program on pin G19
#else
const int led_program = 10;  //OPTIONAL Led for program on pin G10
#endif
const int led_preview = 26;  //OPTIONAL Led for preview on pin G26
const int led_aux = 25;      //OPTIONAL Led for aux on pin G25
#endif

String prevType = "";  // reduce display flicker by storing previous state

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
String LastMessage = "";

//General Variables
bool networkConnected = false;
int currentScreen = 0;                    //0 = Tally Screen, 1 = Settings Screen
int currentBrightness = startBrightness;  //12 is Max level on m5stickC but 100 on m5stickC-Plus, unknown on m5stickC-Plus2

WiFiManager wm;  // global wm instance
bool portalRunning = false;

// Lcd size
// m5stickC: 80x160
// m5StickC Plus: 135x240
// m5StickC Plus2: 135x240

void setup() {
  pinMode(TRIGGER_PIN, INPUT_PULLUP);
  Serial.begin(115200);
  while (!Serial)
    ;

  // Initialize the M5StickC object
  logger("Initializing " + listenerDeviceHW + ".", "info-quiet");

  setCpuFrequencyMhz(80);  //Save battery by turning down the CPU clock
  btStop();                //Save battery by turning off BlueTooth

  // Append last three pairs of MAC to listenerDeviceName to make it some what unique
  byte mac[6];  // the MAC address of your Wifi shield
  WiFi.macAddress(mac);
  listenerDeviceName = listenerDeviceName + String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);

  // Set WiFi hostname
  wm.setHostname((const char *)listenerDeviceName.c_str());

  m5_begin();
  m5_setRotation(3);
  m5_fillScreen(TFT_BLACK);

  m5_configInitialScreen();

  m5_setTextColor(WHITE, BLACK);
  m5_println("booting...");

  logger("Tally Arbiter " + listenerDeviceHW + " Listener Client booting.", "info");
  logger("Listener device name: " + listenerDeviceName, "info");

  preferences.begin("tally-arbiter", false);

  // added to clear out corrupt prefs
  //preferences.clear();
  logger("Reading preferences", "info-quiet");
  if (preferences.getString("deviceid").length() > 0) {
    DeviceId = preferences.getString("deviceid");
  }
  if (preferences.getString("devicename").length() > 0) {
    DeviceName = preferences.getString("devicename");
  }
  if (preferences.getString("taHost").length() > 0) {
    String newHost = preferences.getString("taHost");
    logger("Setting TallyArbiter host as " + newHost, "info-quiet");
    newHost.toCharArray(tallyarbiter_host, 40);
  }
  if (preferences.getString("taPort").length() > 0) {
    String newPort = preferences.getString("taPort");
    logger("Setting TallyArbiter port as " + newPort, "info-quiet");
    newPort.toCharArray(tallyarbiter_port, 6);
  }

  preferences.end();

  delay(100);          //wait 100ms before moving on
  connectToNetwork();  //starts Wifi connection
  //  M5.Lcd.println("SSID: " + String(WiFi.SSID()));
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
      else  // U_SPIFFS
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

#if TALLY_EXTRA_OUTPUT
  // Enable internal led for program trigger
  pinMode(led_program, OUTPUT);
#if defined(STICK_C_PLUS2)
  digitalWrite(led_program, LOW);
#else
  digitalWrite(led_program, HIGH);
#endif
  pinMode(led_preview, OUTPUT);
  digitalWrite(led_preview, LOW);
  pinMode(led_aux, OUTPUT);
  digitalWrite(led_aux, LOW);
#endif
  connectToServer();

  // Load ShowSettings screen since network has been configured
  showSettings();
}

void loop() {
  if (portalRunning) {
    wm.process();
  }

  checkReset();  //check for reset pin
  ArduinoOTA.handle();
  socket.loop();
  btnM5.update();
  btnAction.update();
  M5.update();

  // Is WiFi reset triggered?
  if (m5_BtnA_pressedFor(5000)) {
    logger("resetSettings()", "info");
    wm.resetSettings();
    ESP.restart();
  }

  // Is screen changed?
  if (btnM5.isClick()) {
    switch (currentScreen) {
      case 0:
        showSettings();
        break;
      case 1:
        showDeviceInfo();
        break;
    }
  }

  // Is screen brightness changed?
  if (btnAction.isClick()) {
    updateBrightness();
  }
}

//
void showSettings() {
  currentScreen = 1;
  logger("showSettings()", "info-quiet");

  wm.startWebPortal();
  portalRunning = true;

  //displays the current network connection and Tally Arbiter server data
  m5_fillScreen(TFT_BLACK);
  m5_configSettingsScreen();

  m5_setTextColor(WHITE, BLACK);
  m5_println("SSID: " + String(WiFi.SSID()));
  m5_println(WiFi.localIP().toString());

  m5_println("Tally Arbiter Server:");
  m5_println(String(tallyarbiter_host) + ":" + String(tallyarbiter_port));
  m5_println();
  m5_print("Battery: ");

#if defined(STICK_C_PLUS2)
  // TODO: The battery voltage code is flawed
  int batteryLevel = floor(100.0 * ((1.01 * StickCP2.Power.getBatteryVoltage() / 1000) / 4));
  batteryLevel = batteryLevel > 100 ? 100 : batteryLevel;
  if (StickCP2.Power.getBatteryCurrent() > 0) {
    StickCP2.Display.println("Charging...");  // show when M5 is plugged in
  } else {
    StickCP2.Display.println(String(batteryLevel) + "%");
  }
#else
  // TODO: The battery voltage code is flawed
  int batteryLevel = floor(100.0 * (((M5.Axp.GetBatVoltage()) - 3.0) / (4.07 - 3.0)));
  batteryLevel = batteryLevel > 100 ? 100 : batteryLevel;
  if (batteryLevel >= 100) {
    M5.Lcd.println("Charging...");  // show when M5 is plugged in
  } else {
    M5.Lcd.println(String(batteryLevel) + "%");
  }
#endif
}

void showDeviceInfo() {
  currentScreen = 0;
  logger("showDeviceInfo()", "info-quiet");

  if (portalRunning) {
    wm.stopWebPortal();
    portalRunning = false;
  }

  m5_fillScreen(TFT_BLACK);
  configureDisplayToShowDeviceInfo();

  m5_setTextColor(DARKGREY, BLACK);
  m5_println(DeviceName);

  //displays the currently assigned device and tally data
  evaluateMode();
}

void updateBrightness() {
  if (currentBrightness >= maxBrightness) {
    currentBrightness = startBrightness;
  } else {
    currentBrightness = currentBrightness + 10;
  }

  logger("Set brightness: " + String(currentBrightness), "info-quiet");
#if !defined(STICK_C_PLUS2)
  // TODO: Add call for brightness on Plus2
  M5.Axp.ScreenBreath(currentBrightness);
#endif
}

void logger(String strLog, String strType) {
  Serial.println(strLog);
  /*
    if (strType == "info") {
    Serial.println(strLog);
    //M5.Lcd.println(strLog);
    } else {
    Serial.println(strLog);
    }
  */
}

WiFiManagerParameter *custom_taServer;
WiFiManagerParameter *custom_taPort;

void connectToNetwork() {
  WiFi.mode(WIFI_STA);  // explicitly set mode, esp defaults to STA+AP
  logger("Connecting to SSID: " + String(WiFi.SSID()), "info");

  //reset settings - wipe credentials for testing
  //wm.resetSettings();

  //add TA fields
  custom_taServer = new WiFiManagerParameter("taHostIP", "Tally Arbiter Server", tallyarbiter_host, 40);
  custom_taPort = new WiFiManagerParameter("taHostPort", "Port", tallyarbiter_port, 6);

  wm.addParameter(custom_taServer);
  wm.addParameter(custom_taPort);

  // If no saved WiFi we assume that configuration is needed via the captive portal
  if (wm.getWiFiIsSaved()) {
    m5_println("connecting...");
  } else {
    m5_println("Configure on");
    m5_println("SSID: " + listenerDeviceName);
  }

  wm.setSaveParamsCallback(saveParamCallback);

  // custom menu via array or vector
  std::vector<const char *> menu = { "wifi", "param", "info", "sep", "restart", "exit" };
  wm.setMenu(menu);

  // set dark theme
  wm.setClass("invert");

  wm.setConfigPortalTimeout(120);  // auto close configportal after n seconds

  bool res;
  res = wm.autoConnect(listenerDeviceName.c_str());  // AP name for setup

  if (!res) {
    logger("Failed to connect", "error");
    m5_println("Configuration timeout");
    m5_println("Restart device to configure");

    // ESP.restart();
  } else {
    //if you get here you have connected to the WiFi
    logger("connected...yay :)", "info");
    networkConnected = true;

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

  //str_taHost.toCharArray(tallyarbiter_host, 40);
  //saveEEPROM();
  logger("Saving new TallyArbiter host", "info-quiet");
  logger(str_taHost, "info-quiet");
  preferences.begin("tally-arbiter", false);
  preferences.putString("taHost", str_taHost);
  preferences.putString("taPort", str_taPort);
  preferences.end();
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

void socket_event(socketIOmessageType_t type, uint8_t *payload, size_t length) {
  String eventMsg = "";
  String eventType = "";
  String eventContent = "";

  switch (type) {
    case sIOtype_CONNECT:
      socket_Connected((char *)payload, length);
      break;

    case sIOtype_DISCONNECT:
    case sIOtype_ACK:
    case sIOtype_ERROR:
    case sIOtype_BINARY_EVENT:
    case sIOtype_BINARY_ACK:
      // Not handled
      break;

    case sIOtype_EVENT:
      eventMsg = (char *)payload;
      eventType = eventMsg.substring(2, eventMsg.indexOf("\"", 2));
      eventContent = eventMsg.substring(eventType.length() + 4);
      eventContent.remove(eventContent.length() - 1);

      logger("Got event '" + eventType + "', data: " + eventContent, "info-quiet");

      if (eventType == "bus_options") BusOptions = JSON.parse(eventContent);
      if (eventType == "reassign") socket_Reassign(eventContent);
      if (eventType == "flash") socket_Flash();
      if (eventType == "messaging") socket_Messaging(eventContent);

      if (eventType == "deviceId") {
        DeviceId = eventContent.substring(1, eventContent.length() - 1);
        SetDeviceName();
        showDeviceInfo();
        currentScreen = 0;
      }

      if (eventType == "devices") {
        Devices = JSON.parse(eventContent);
        SetDeviceName();
      }

      if (eventType == "device_states") {
        DeviceStates = JSON.parse(eventContent);
        processTallyData();
      }

      break;

    default:
      break;
  }
}

void socket_Connected(const char *payload, size_t length) {
  logger("Connected to Tally Arbiter server.", "info");
  logger("DeviceId: " + DeviceId, "info-quiet");
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\", \"listenerType\": \"" + listenerDeviceName.c_str() + "\", \"canBeReassigned\": true, \"canBeFlashed\": true, \"supportsChat\": true }";
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  ws_emit("listenerclient_connect", charDeviceObj);
}

void socket_Flash() {
  //flash the screen white 3 times
  m5_fillScreen(WHITE);
  delay(500);
  m5_fillScreen(TFT_BLACK);
  delay(500);
  m5_fillScreen(WHITE);
  delay(500);
  m5_fillScreen(TFT_BLACK);
  delay(500);
  m5_fillScreen(WHITE);
  delay(500);
  m5_fillScreen(TFT_BLACK);
  //then resume normal operation
  switch (currentScreen) {
    case 0:
      showDeviceInfo();
      break;
    case 1:
      showSettings();
      break;
  }
}

String strip_quot(String str) {
  if (str[0] == '"') {
    str.remove(0, 1);
  }
  if (str.endsWith("\"")) {
    str.remove(str.length() - 1, 1);
  }
  return str;
}

void socket_Reassign(String payload) {
  logger("socket_Reassign()", "info-quiet");
  String oldDeviceId = payload.substring(0, payload.indexOf(','));
  String newDeviceId = payload.substring(oldDeviceId.length() + 1);
  newDeviceId = newDeviceId.substring(0, newDeviceId.indexOf(','));
  oldDeviceId = strip_quot(oldDeviceId);
  newDeviceId = strip_quot(newDeviceId);

  String reassignObj = "{\"oldDeviceId\": \"" + oldDeviceId + "\", \"newDeviceId\": \"" + newDeviceId + "\"}";
  char charReassignObj[1024];
  strcpy(charReassignObj, reassignObj.c_str());
  ws_emit("listener_reassign_object", charReassignObj);
  ws_emit("devices");

  m5_fillScreen(RED);
  delay(200);
  m5_fillScreen(TFT_BLACK);
  delay(200);
  m5_fillScreen(RED);
  delay(200);
  m5_fillScreen(TFT_BLACK);

  logger("newDeviceId: " + newDeviceId, "info-quiet");
  DeviceId = newDeviceId;
  preferences.begin("tally-arbiter", false);
  preferences.putString("deviceid", newDeviceId);
  preferences.end();
  SetDeviceName();

  switch (currentScreen) {
    case 0:
      showDeviceInfo();
      break;
    case 1:
      showSettings();
      break;
  }
}

void socket_Messaging(String payload) {
  String strPayload = String(payload);
  int typeQuoteIndex = strPayload.indexOf(',');
  String messageType = strPayload.substring(0, typeQuoteIndex);
  messageType.replace("\"", "");
  int messageQuoteIndex = strPayload.lastIndexOf(',');
  String message = strPayload.substring(messageQuoteIndex + 1);
  message.replace("\"", "");
  LastMessage = messageType + ": " + message;
  evaluateMode();
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

  if (!typeChanged) {
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
      return (int)JSON.stringify(BusOptions[i]["priority"]).toInt();
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
  logger("DeviceName: " + DeviceName, "info");
}

void evaluateMode() {
  if (actualType != prevType) {
    configureDisplayToEvaluateMode();
    actualColor.replace("#", "");
    String hexstring = actualColor;
    long number = (long)strtol(&hexstring[1], NULL, 16);
    int r = number >> 16;
    int g = number >> 8 & 0xFF;
    int b = number & 0xFF;

    if (actualType != "") {
      m5_setTextColor(BLACK);
      m5_fillScreen(M5.Lcd.color565(r, g, b));
      m5_println(DeviceName);

    } else {
      m5_setTextColor(DARKGREY, BLACK);
      m5_fillScreen(TFT_BLACK);
      m5_println(DeviceName);
    }

#if TALLY_EXTRA_OUTPUT
    if (actualType == "\"program\"") {
#if defined(STICK_C_PLUS2)
      digitalWrite(led_program, HIGH);
#else
      digitalWrite(led_program, LOW);
#endif
      digitalWrite(led_preview, LOW);
      digitalWrite(led_aux, LOW);
    } else if (actualType == "\"preview\"") {
#if defined(STICK_C_PLUS2)
      digitalWrite(led_program, LOW);
#else
      digitalWrite(led_program, HIGH);
#endif
      digitalWrite(led_preview, HIGH);
      digitalWrite(led_aux, LOW);
    } else if (actualType == "\"aux\"") {
#if defined(STICK_C_PLUS2)
      digitalWrite(led_program, LOW);
#else
      digitalWrite(led_program, HIGH);
#endif
      digitalWrite(led_preview, LOW);
      digitalWrite(led_aux, HIGH);
    } else {
#if defined(STICK_C_PLUS2)
      digitalWrite(led_program, LOW);
#else
      digitalWrite(led_program, HIGH);
#endif
      digitalWrite(led_preview, LOW);
      digitalWrite(led_aux, LOW);
    }
#endif

    logger("Device is in " + actualType + " (color " + actualColor + " priority " + String(actualPriority) + ")", "info");
    Serial.println(" r: " + String(r) + " g: " + String(g) + " b: " + String(b));

    prevType = actualType;
  }

  if (LAST_MSG == true) {
    m5_println(LastMessage);
  }
}

void checkReset() {
  // check for button press
  if (digitalRead(TRIGGER_PIN) == LOW) {

    // poor mans debounce/press-hold, code not ideal for production
    delay(50);
    if (digitalRead(TRIGGER_PIN) == LOW) {
      m5_fillScreen(TFT_BLACK);
      configureDisplayToCheckReset();

      m5_setTextColor(WHITE, BLACK);
      m5_println("Reset button pushed....");
      logger("Button Pressed", "info");

      // still holding button for 3000 ms, reset settings, code not ideal for production
      delay(3000);  // reset delay hold
      if (digitalRead(TRIGGER_PIN) == LOW) {
        m5_println("Erasing....");
        logger("Button Held", "info");
        logger("Erasing Config, restarting", "info");
        wm.resetSettings();
        ESP.restart();
      }

      m5_println("Starting Portal...");

      // start portal w delay
      logger("Starting config portal", "info");
      wm.setConfigPortalTimeout(120);

      if (!wm.startConfigPortal(listenerDeviceName.c_str())) {
        logger("failed to connect or hit timeout", "error");
        delay(3000);
        // ESP.restart();
      } else {
        //if you get here you have connected to the WiFi
        logger("connected...yeey :)", "info");
      }
    }
  }
}


//
// Hiding differences between hw variants to increased readability of common source code.
//

void m5_println(void) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.println();
#else
  M5.Lcd.println();
#endif
}

void m5_println(const String &s) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.println(s);
#else
  M5.Lcd.println(s);
#endif
}

void m5_println(const char c[]) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.println(c);
#else
  M5.Lcd.println(c);
#endif
}

void m5_print(const char str[]) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.print(str);
#else
  M5.Lcd.print(str);
#endif
}

void m5_setTextColor(uint16_t color) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setTextColor(color);
#else
  M5.Lcd.setTextColor(color);
#endif
}

void m5_setTextColor(uint16_t fgcolor, uint16_t bgcolor) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setTextColor(fgcolor, bgcolor);
#else
  M5.Lcd.setTextColor(fgcolor, bgcolor);
#endif
}

void m5_fillScreen(uint32_t color) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.fillScreen(color);
#else
  M5.Lcd.fillScreen(color);
#endif
}

uint8_t m5_BtnA_pressedFor(uint32_t ms) {
#if defined(STICK_C_PLUS2)
  return StickCP2.BtnA.pressedFor(ms);
#else
  return M5.BtnA.pressedFor(ms);
#endif
}

void configureDisplayToEvaluateMode() {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setCursor(4, 50);
  StickCP2.Display.setFreeFont(FSS24);
#endif
#if defined(STICK_C_PLUS)
  M5.Lcd.setCursor(4, 82);
  M5.Lcd.setFreeFont(FSS24);
#endif
#if defined(STICK_C)
  M5.Lcd.setCursor(4, 30);
  M5.Lcd.setTextSize(2);
#endif
}

void configureDisplayToShowDeviceInfo() {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setCursor(4, 50);
  StickCP2.Display.setFreeFont(FSS24);
#endif
#if defined(STICK_C_PLUS)
  M5.Lcd.setCursor(4, 82);
  M5.Lcd.setFreeFont(FSS24);
#endif
#if defined(STICK_C)
  M5.Lcd.setCursor(4, 30);
  M5.Lcd.setTextSize(2);
#endif
}


void configureDisplayToCheckReset() {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setCursor(0, 40);
  StickCP2.Display.setFreeFont(FSS9);
#endif
#if defined(STICK_C_PLUS)
  M5.Lcd.setCursor(0, 40);
  M5.Lcd.setFreeFont(FSS9);
#endif
#if defined(STICK_C)
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.setTextSize(1);
#endif
}

void m5_begin() {
#if defined(STICK_C_PLUS2)
  auto cfg = M5.config();
  StickCP2.begin(cfg);
#else
  M5.begin();
#endif
}


void m5_configInitialScreen() {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setCursor(0, 0);
  StickCP2.Display.setFreeFont(FSS9);
#endif
#if defined(STICK_C_PLUS)
  M5.Lcd.setCursor(0, 20);
  M5.Lcd.setFreeFont(FSS9);
#endif
#if defined(STICK_C)
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.setTextSize(1);
#endif
}


void m5_configSettingsScreen() {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setCursor(0, 0);
  StickCP2.Display.setFreeFont(FSS9);
#endif
#if defined(STICK_C_PLUS)
  M5.Lcd.setCursor(0, 20);
  M5.Lcd.setFreeFont(FSS9);
#endif
#if defined(STICK_C)
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.setTextSize(1);
#endif
}


void m5_setRotation(uint_fast8_t rotation) {
#if defined(STICK_C_PLUS2)
  StickCP2.Display.setRotation(rotation);
#else
  M5.Lcd.setRotation(rotation);
#endif
}
