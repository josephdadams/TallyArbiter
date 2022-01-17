#define C_PLUS 0 //CHANGE TO 1 IF YOU USE THE M5STICK-C PLUS

#if C_PLUS == 1
#include <M5StickCPlus.h>
#else
#include <M5StickC.h>
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


#define TRIGGER_PIN 0 //reset pin 
#define GREY  0x0020 //   8  8  8
#define GREEN 0x0200 //   0 64  0
#define RED   0xF800 // 255  0  0
#define maxTextSize 5 //larger sourceName text


String listenerDeviceName = "m5StickC-1";

/* USER CONFIG VARIABLES
 *  Change the following variables before compiling and sending the code to your device.
 */

bool LAST_MSG = false; // true = show log on tally screen<

//Tally Arbiter Server
char tallyarbiter_host[40] = "192.168.0.110"; //IP address of the Tally Arbiter Server
char tallyarbiter_port[6] = "4455";

/* END OF USER CONFIG */

//M5StickC variables
PinButton btnM5(37); //the "M5" button on the device
PinButton btnAction(39); //the "Action" button on the device
Preferences preferences;
uint8_t wasPressed();

#define TALLY_EXTRA_OUTPUT false

#if TALLY_EXTRA_OUTPUT
const int led_program = 10;
const int led_preview = 26; //OPTIONAL Led for preview on pin G26
const int led_aux = 36;     //OPTIONAL Led for aux on pin G36
#endif

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
String LastMessage = "";

//General Variables
bool networkConnected = false;
int currentScreen = 0; //0 = Tally Screen, 1 = Settings Screen
int currentBrightness = 11; //12 is Max level

WiFiManager wm; // global wm instance
bool portalRunning = false;

void setup() {
  pinMode(TRIGGER_PIN, INPUT_PULLUP);
  Serial.begin(115200);
  while (!Serial);

  // Initialize the M5StickC object
  logger("Initializing M5StickC+.", "info-quiet");

  setCpuFrequencyMhz(80);    //Save battery by turning down the CPU clock
  btStop();                 //Save battery by turning off BlueTooth

  uint64_t chipid = ESP.getEfuseMac();
  listenerDeviceName = "m5StickC-" + String((uint16_t)(chipid>>32)) + String((uint32_t)chipid);

  M5.begin();
  M5.Lcd.setRotation(3);
  M5.Lcd.setCursor(0, 20);
  M5.Lcd.fillScreen(TFT_BLACK);
  M5.Lcd.setFreeFont(FSS9);
  //M5.Lcd.setTextSize(2);
  M5.Lcd.setTextColor(WHITE, BLACK);
  M5.Lcd.println("booting...");
  logger("Tally Arbiter M5StickC+ Listener Client booting.", "info");
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
    logger("Setting TallyArbiter host as" + newHost, "info-quiet");
    newHost.toCharArray(tallyarbiter_host, 40);
  }
  if(preferences.getString("taPort").length() > 0){
    String newPort = preferences.getString("taPort");
    logger("Setting TallyArbiter port as" + newPort, "info-quiet");
    newPort.toCharArray(tallyarbiter_port, 6);
  }
 
  preferences.end();

  delay(100); //wait 100ms before moving on
  connectToNetwork(); //starts Wifi connection
  M5.Lcd.println("SSID: " + String(WiFi.SSID()));
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

  #if TALLY_EXTRA_OUTPUT
  // Enable interal led for program trigger
  pinMode(led_program, OUTPUT);
  digitalWrite(led_program, HIGH);
  pinMode(led_preview, OUTPUT);
  digitalWrite(led_preview, HIGH);
  pinMode(led_aux, OUTPUT);
  digitalWrite(led_aux, HIGH);
  #endif
  connectToServer();

}

void loop() {
  if(portalRunning){
    wm.process();
  }
  
  checkReset(); //check for reset pin
  ArduinoOTA.handle();
  socket.loop();
  btnM5.update();
  btnAction.update();

  if (btnM5.isClick()) {
    switch (currentScreen) {
      case 0:
        showSettings();
        currentScreen = 1;
        break;
      case 1:
        showDeviceInfo();
        currentScreen = 0;
        break;
    }
  }

  if (btnAction.isClick()) {
    updateBrightness();
  }
}

void showSettings() {
  wm.startWebPortal();
  portalRunning = true;
  
  //displays the current network connection and Tally Arbiter server data
  M5.Lcd.setCursor(0, 20);
  M5.Lcd.fillScreen(TFT_BLACK);
  M5.Lcd.setFreeFont(FSS9);
  //M5.Lcd.setTextSize(1);
  M5.Lcd.setTextColor(WHITE, BLACK);
  M5.Lcd.println("SSID: " + String(WiFi.SSID()));
  M5.Lcd.println(WiFi.localIP());

  M5.Lcd.println("Tally Arbiter Server:");
  M5.Lcd.println(String(tallyarbiter_host) + ":" + String(tallyarbiter_port));
  M5.Lcd.println();
  M5.Lcd.print("Battery: ");
  int batteryLevel = floor(100.0 * (((M5.Axp.GetVbatData() * 1.1 / 1000) - 3.0) / (4.07 - 3.0)));
  batteryLevel = batteryLevel > 100 ? 100 : batteryLevel;
  if(batteryLevel >= 100){
    M5.Lcd.println("Charging...");   // show when M5 is plugged in
  } else {
    M5.Lcd.println(String(batteryLevel) + "%");
  }
}

void showDeviceInfo() {
  if(portalRunning) {
    wm.stopWebPortal();
    portalRunning = false;
  }
  
  M5.Lcd.setTextColor(GREY, BLACK);
  M5.Lcd.fillScreen(TFT_BLACK);
  M5.Lcd.println(DeviceName);

  //displays the currently assigned device and tally data
  evaluateMode();
}

void updateBrightness() {
  if(currentBrightness >= 12) {
    currentBrightness = 7;
  } else {
    currentBrightness++;
  }
  M5.Axp.ScreenBreath(currentBrightness);
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
    case SYSTEM_EVENT_STA_GOT_IP:
      logger("Network connected!", "info");
      logger(WiFi.localIP().toString(), "info");
      networkConnected = true;
      break;
    case SYSTEM_EVENT_STA_DISCONNECTED:
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

void socket_event(socketIOmessageType_t type, uint8_t * payload, size_t length) {
  String eventMsg = "";
  String eventType = "";
  String eventContent = "";

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
      eventMsg = (char*)payload;
      eventType = eventMsg.substring(2, eventMsg.indexOf("\"",2));
      eventContent = eventMsg.substring(eventType.length() + 4);
      eventContent.remove(eventContent.length() - 1);

      logger("Got event '" + eventType + "', data: " + eventContent, "info-quiet");

      if (eventType == "bus_options") BusOptions = JSON.parse(eventContent);
      if (eventType == "reassign") socket_Reassign(eventContent);
      if (eventType == "flash") socket_Flash();
      if (eventType == "messaging") socket_Messaging(eventContent);

      if (eventType == "deviceId") {
        DeviceId = eventContent.substring(1, eventContent.length()-1);
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

void socket_Connected(const char * payload, size_t length) {
  logger("Connected to Tally Arbiter server.", "info");
  logger("DeviceId: " + DeviceId, "info-quiet");
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\", \"listenerType\": \"" + listenerDeviceName.c_str() + "\", \"canBeReassigned\": true, \"canBeFlashed\": true, \"supportsChat\": true }";
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  ws_emit("listenerclient_connect", charDeviceObj);
}

void socket_Flash() {
  //flash the screen white 3 times
  M5.Lcd.fillScreen(WHITE);
  delay(500);
  M5.Lcd.fillScreen(TFT_BLACK);
  delay(500);
  M5.Lcd.fillScreen(WHITE);
  delay(500);
  M5.Lcd.fillScreen(TFT_BLACK);
  delay(500);
  M5.Lcd.fillScreen(WHITE);
  delay(500);
  M5.Lcd.fillScreen(TFT_BLACK);

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
  
  M5.Lcd.fillScreen(RED);
  delay(200);
  M5.Lcd.fillScreen(TFT_BLACK);
  delay(200);
  M5.Lcd.fillScreen(RED);
  delay(200);
  M5.Lcd.fillScreen(TFT_BLACK);
  
  logger("newDeviceId: " + newDeviceId, "info-quiet");
  DeviceId = newDeviceId;
  preferences.begin("tally-arbiter", false);
  preferences.putString("deviceid", newDeviceId);
  preferences.end();
  SetDeviceName();
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
  if(actualType != prevType) {
    M5.Lcd.setCursor(4, 82);
    M5.Lcd.setFreeFont(FSS24);
    //M5.Lcd.setTextSize(maxTextSize);
    actualColor.replace("#", "");
    String hexstring = actualColor;
    long number = (long) strtol( &hexstring[1], NULL, 16);
    int r = number >> 16;
    int g = number >> 8 & 0xFF;
    int b = number & 0xFF;
    if (actualType != "") {
      M5.Lcd.setTextColor(BLACK);
      M5.Lcd.fillScreen(M5.Lcd.color565(r, g, b));
      M5.Lcd.println(DeviceName);
    } else {
      M5.Lcd.setTextColor(GREY, BLACK);
      M5.Lcd.fillScreen(TFT_BLACK);
      M5.Lcd.println(DeviceName);
    }
    
    #if TALLY_EXTRA_OUTPUT
    if (actualType == "preview") {
      digitalWrite(led_program, HIGH);
      digitalWrite (led_preview, LOW);
      digitalWrite (led_aux, LOW);
    } else if (actualType == "preview") {
      digitalWrite(led_program, LOW);
      digitalWrite (led_preview, HIGH);
      digitalWrite (led_aux, LOW);
    } else if (actualType == "aux") {
      digitalWrite(led_program, LOW);
      digitalWrite (led_preview, LOW);
      digitalWrite (led_aux, HIGH);
    } else {
      digitalWrite(led_program, LOW);
      digitalWrite (led_preview, LOW);
      digitalWrite (led_aux, LOW);
    }
    #endif
    logger("Device is in " + actualType + " (color " + actualColor + " priority " + String(actualPriority) + ")", "info");
    Serial.print(" r: " + String(r) + " g: " + String(g) + " b: " + String(b));

    prevType = actualType;
  }
  
  if (LAST_MSG == true){
    M5.Lcd.println(LastMessage);
  }
}

void checkReset() {
  // check for button press
  if ( digitalRead(TRIGGER_PIN) == LOW ) {

    // poor mans debounce/press-hold, code not ideal for production
    delay(50);
    if ( digitalRead(TRIGGER_PIN) == LOW ) {
      M5.Lcd.setCursor(0, 40);
      M5.Lcd.fillScreen(TFT_BLACK);
      M5.Lcd.setFreeFont(FSS9);
      //M5.Lcd.setTextSize(1);
      M5.Lcd.setTextColor(WHITE, BLACK);
      M5.Lcd.println("Reset button pushed....");
      logger("Button Pressed", "info");
      // still holding button for 3000 ms, reset settings, code not ideal for production
      delay(3000); // reset delay hold
      if ( digitalRead(TRIGGER_PIN) == LOW ) {
        M5.Lcd.println("Erasing....");
        logger("Button Held", "info");
        logger("Erasing Config, restarting", "info");
        wm.resetSettings();
        ESP.restart();
      }

      M5.Lcd.println("Starting Portal...");
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
