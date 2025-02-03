/*
#########################################################################################
include libs:
Websockets
Arduino_JSON
TFT_eSPI
MultiButton

Modify User_Setup_Select.h in libraryY TFT_eSPI
  //#include <User_Setup.h>
  #include <User_Setups/Setup25_TTGO_T_Display.h>
#########################################################################################
*/
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <WiFiManager.h>
#include <TFT_eSPI.h>
#include <Arduino_JSON.h>
#include <PinButton.h>
#include <SPI.h>
#include <Arduino.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include "esp_adc_cal.h"
#include "TallyArbiterLogo.h"

#define ADC_EN  14  //ADC_EN is the ADC detection enable port
#define ADC_PIN 34

float battery_voltage;
String voltage;
int vref = 1100;
int batteryLevel = 100;
int barLevel = 0;
int LevelColor = TFT_WHITE;
bool backlight = true;
PinButton btntop(35); //top button, switch screen.
PinButton btnbottom(0); //bottom button, screen on/off
Preferences preferences;

//Tally Arbiter Server
char tallyarbiter_host[40] = "192.168.1.2"; //IP address of the Tally Arbiter Server
char tallyarbiter_port[6] = "4455";

TFT_eSPI tft = TFT_eSPI();  // Invoke library, pins defined in User_Setup.h

bool LAST_MSG = true; // true = show messages on tally screen

#define TALLY_EXTRA_OUTPUT false

#if TALLY_EXTRA_OUTPUT
const int led_program = 10;
const int led_preview = 26; //OPTIONAL Led for preview on pin G26
const int led_aux = 36;     //OPTIONAL Led for aux on pin G36
#endif
const int led_blue = 26;     //blue led  connected with 270ohm resistor

#define TFT_DISPOFF 0x28
#define TFT_SLPIN   0x10
#define TFT_BL      4        // Display backlight control pin

WiFiManager wm; // global wm instance
WiFiManagerParameter custom_field; // global param ( for non blocking w params )
bool portalRunning = false;

//Tally Arbiter variables
SocketIOclient socket;
JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;
String DeviceId = "unassigned";
String DeviceName = "Unassigned";
String LastMessage = "";
String listenerDeviceName = "TTGO_T-1";

String prevType = ""; // reduce display flicker by storing previous state

String actualType = "";
String actualColor = "";
int actualPriority = 0;

//General Variables
bool networkConnected = false;
int currentScreen = 0;        //0 = Tally Screen, 1 = Settings Screen

void espDelay(int ms) {
  esp_sleep_enable_timer_wakeup(ms * 1000);
  esp_sleep_pd_config(ESP_PD_DOMAIN_RTC_PERIPH, ESP_PD_OPTION_ON);
  esp_light_sleep_start();
}

void showVoltage() {
    static uint64_t timeStamp = 0;
    if (millis() - timeStamp > 5000) {
        timeStamp = millis();
        uint16_t v = analogRead(ADC_PIN);
        battery_voltage = ((float)v / 4095.0) * 2.0 * 3.3 * (vref / 1000.0);
        voltage = "Voltage :" + String(battery_voltage) + "V";
        batteryLevel = floor(100.0 * (((battery_voltage * 1.1) - 3.0) / (4.07 - 3.0))); //100%=3.7V, Vmin = 2.8V
        batteryLevel = batteryLevel > 100 ? 100 : batteryLevel;
        barLevel = 133 - (batteryLevel * 133/100);
        if (battery_voltage >= 3){
          LevelColor = TFT_WHITE;
        }
        else {
          LevelColor = TFT_RED;
        }
        if (currentScreen == 0){
          tft.fillRect(232, 0, 8, 135, LevelColor);
          tft.fillRect(233, 1, 6, barLevel, TFT_BLACK);
        }
        if (battery_voltage < 2.8){ //go into sleep,awake with top button
          tft.setRotation(1);
          tft.setCursor(0, 0);
          tft.fillScreen(TFT_BLACK);
          tft.setTextColor(TFT_WHITE);
          tft.setTextSize(2);
          tft.println("Battery level low");
          tft.println("Going into sleepmode");
          espDelay(5000);
          tft.writecommand(TFT_DISPOFF);
          tft.writecommand(TFT_SLPIN);
          //After using light sleep, you need to disable timer wake, because here use external IO port to wake up
          esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_TIMER);
          // esp_sleep_enable_ext1_wakeup(GPIO_SEL_35, ESP_EXT1_WAKEUP_ALL_LOW);
          esp_sleep_enable_ext0_wakeup(GPIO_NUM_35, 0);
          delay(200);
          esp_deep_sleep_start();
        }
    }
}

void showSettings() {
  wm.startWebPortal();
  portalRunning = true;
  //displays the current network connection and Tally Arbiter server data
  tft.setCursor(0, 0);
  tft.fillScreen(TFT_BLACK);
  tft.setTextSize(2);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.println("SSID: " + String(WiFi.SSID()));
  tft.println(WiFi.localIP());
  tft.println();
  tft.println("TallyArbiter Server:");
  tft.println(String(tallyarbiter_host) + ":" + String(tallyarbiter_port));
  tft.println();
  Serial.println(voltage);
  if(battery_voltage >= 4.2){
    tft.println("Battery charging...");   // show when TTGO is plugged in
  } else if (battery_voltage < 3) {
    tft.println("Battery empty. Recharge!!");
  } else {
    tft.println("Battery:" + String(batteryLevel) + "%");
  }
}

void showDeviceInfo() {
  if(portalRunning) {
    wm.stopWebPortal();
    portalRunning = false;
  }
  tft.setCursor(0, 0);
  tft.fillScreen(TFT_BLACK);
  evaluateMode();
}

void logger(String strLog, String strType) {
  if (strType == "info") {
    Serial.println(strLog);
    int x = strLog.length();
    for (int i=0; i < x; i=i+19) {
      tft.println(strLog.substring(0,19));
      strLog = strLog.substring(19);
    }
  }
  else {
    Serial.println(strLog);
  }
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
  
  //wm.addParameter(&custom_field);
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
    case IP_EVENT_STA_GOT_IP:
      logger("Network connected!", "info");
      logger(WiFi.localIP().toString(), "info");
      networkConnected = true;
      break;
    case WIFI_EVENT_STA_DISCONNECTED:
      tft.setCursor(0, 0);
      tft.fillScreen(TFT_BLACK);
      tft.setTextSize(2);
      logger("Network connection lost!", "info");
      digitalWrite(led_blue, HIGH);
      networkConnected = false;
      delay(1000);
      connectToNetwork();
      break;
    default:
      break;
  }
}

void ws_emit(String event, const char *payload = NULL) {
  if (payload) {
    String msg = "[\"" + event + "\"," + payload + "]";
    socket.sendEVENT(msg);
  } else {
    String msg = "[\"" + event + "\"]";
    socket.sendEVENT(msg);
  }
}

void connectToServer() {
  logger("Connecting to Tally Arbiter host: " + String(tallyarbiter_host) + " " + tallyarbiter_port, "info");
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
      if (type == "messaging") socket_Messaging(content);

      if (type == "deviceId") {
        DeviceId = content.substring(1, content.length()-1);
        SetDeviceName();
        showDeviceInfo();
        currentScreen = 0;
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

void socket_Disconnected() {
  digitalWrite(led_blue, HIGH);
  tft.setCursor(0, 0);
  tft.fillScreen(TFT_BLACK);
  tft.setTextSize(2);
  logger("Disconnected from   TallyArbiter!", "info");
}

void socket_Connected(const char * payload, size_t length) {
  logger("Connected to Tally Arbiter server.", "info");
  logger("DeviceId: " + DeviceId, "info-quiet");
  digitalWrite(led_blue, LOW);
  tft.fillScreen(TFT_BLACK);
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\", \"listenerType\": \"" + listenerDeviceName.c_str() + "\", \"canBeReassigned\": true, \"canBeFlashed\": true, \"supportsChat\": true }";
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  ws_emit("listenerclient_connect", charDeviceObj);
}

void socket_Flash() {
  //flash the screen white 3 times
  tft.fillScreen(TFT_WHITE);
  digitalWrite(led_blue, HIGH);
  delay(500);
  tft.fillScreen(TFT_BLACK);
  digitalWrite(led_blue, LOW);
  delay(500);
  tft.fillScreen(TFT_WHITE);
  digitalWrite(led_blue, HIGH);
  delay(500);
  tft.fillScreen(TFT_BLACK);
  digitalWrite(led_blue, LOW);
  delay(500);
  tft.fillScreen(TFT_WHITE);
  digitalWrite(led_blue, HIGH);
  delay(500);
  tft.fillScreen(TFT_BLACK);
  digitalWrite(led_blue, LOW);
  
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
  //socket.emit("listener_reassign_object", charReassignObj);
  ws_emit("listener_reassign_object", charReassignObj);
  ws_emit("devices");
  tft.fillScreen(TFT_WHITE);
  digitalWrite(led_blue, HIGH);
  delay(200);
  tft.fillScreen(TFT_BLACK);
  digitalWrite(led_blue, LOW);
  delay(200);
  tft.fillScreen(TFT_WHITE);
  digitalWrite(led_blue, HIGH);
  delay(200);
  tft.fillScreen(TFT_BLACK);
  digitalWrite(led_blue, LOW);
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
  //Only messages from producer and clients.
  if (messageType != "server") {
    int messageQuoteIndex = strPayload.lastIndexOf(',');
    String message = strPayload.substring(messageQuoteIndex + 1);
    message.replace("\"", "");
    LastMessage = messageType + ": " + message;
    evaluateMode();
  }
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
  if(currentScreen == 1) {
    return;
  }
  tft.setCursor(0, 0);
  tft.setTextSize(2);
  if(actualType != prevType) {
    actualColor.replace("#", "");
    String hexstring = actualColor;
    long number = (long) strtol( &hexstring[1], NULL, 16);
    int r = number >> 16;
    int g = number >> 8 & 0xFF;
    int b = number & 0xFF;
    if (actualType != "") {
      tft.setTextColor(TFT_BLACK);
      tft.fillScreen(tft.color565(r, g, b));
    } else {
      tft.setTextColor(TFT_WHITE);
      tft.fillScreen(TFT_BLACK);
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
    logger("Device is in " + actualType + " (color " + actualColor + " priority " + String(actualPriority) + ")", "info-quiet");
    Serial.print(" r: " + String(r) + " g: " + String(g) + " b: " + String(b));

    prevType = actualType;
  }
  String device_status_line = DeviceName;
  if (actualType != "") {
    device_status_line += " (" + strip_quot(actualType) + ")";
  }
  tft.println(device_status_line);
  tft.println("-------------------");
  if (LAST_MSG == true) {
    logger(LastMessage, "info");
  }
  tft.fillRect(232, 0, 8, 135, LevelColor);
  tft.fillRect(233, 1, 6, barLevel, TFT_BLACK);
}

void setup(void) {
  Serial.begin(115200);
  while (!Serial);
/*
  ADC_EN is the ADC detection enable port
  If the USB port is used for power supply, it is turned on by default.
  If it is powered by battery, it needs to be set to high level
  */
  pinMode(ADC_EN, OUTPUT);
  digitalWrite(ADC_EN, HIGH);

  // Initialize the TTGO object
  logger("Initializing TTGO.", "info-quiet");

  setCpuFrequencyMhz(80);    //Save battery by turning down the CPU clock
  btStop();                  //Save battery by turning off BlueTooth
  
  uint64_t chipid = ESP.getEfuseMac();
  listenerDeviceName = "TTGO_T-" + String((uint16_t)(chipid>>32)) + String((uint32_t)chipid);

  tft.init();
  tft.setRotation(1);
  tft.setCursor(0, 0);
  tft.fillScreen(TFT_BLACK);
  tft.setTextColor(TFT_WHITE);
  tft.setTextSize(2);
  tft.setSwapBytes(true);
  tft.pushImage(0, 0,  240, 135, TallyArbiterLogo);
  
  espDelay(5000);
  logger("Tally Arbiter TTGO Listener Client booting.", "info");
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
  
  pinMode(led_blue, OUTPUT);
  digitalWrite(led_blue, HIGH);
  Serial.println("Blue LED ON.");

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
  ArduinoOTA.handle();
  socket.loop();
  btntop.update();
  btnbottom.update();
  showVoltage();
  if (btntop.isClick()) {
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
  if (btnbottom.isClick()) {
    if (backlight == true) {
      digitalWrite(TFT_BL, LOW);
      backlight = false;
    } else {
      digitalWrite(TFT_BL, HIGH);
      backlight = true;
    }
  }
}
