#define C_PLUS 1 //CHANGE TO 1 IF YOU USE THE M5STICK-C PLUS

#if C_PLUS == 1
#include <M5StickCPlus.h>
#else
#include <M5StickC.h>
#endif

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Arduino_JSON.h>
#include <PinButton.h>
#include <Preferences.h>

#define GRAY  0x0020 //   8  8  8
#define GREEN 0x0200 //   0 64  0
#define RED   0xF800 // 255  0  0

/* USER CONFIG VARIABLES
 *  Change the following variables before compiling and sending the code to your device.
 */

bool CUT_BUS = true; // true = Programm + Preview = Red Tally; false = Programm + Preview = Yellow Tally
bool LAST_MSG = false; // true = show log on tally screen

//Wifi SSID and password
const char * networkSSID = "NetworkSSID";
const char * networkPass = "NetworkPass";

//For static IP Configuration, change USE_STATIC to true and define your IP address settings below
bool USE_STATIC = false; // true = use static, false = use DHCP

IPAddress clientIp(192, 168, 2, 5); // Static IP
IPAddress subnet(255, 255, 255, 0); // Subnet Mask
IPAddress gateway(192, 168, 2, 1); // Gateway

//Tally Arbiter Server
const char * tallyarbiter_host = "192.168.0.137"; //IP address of the Tally Arbiter Server
const int tallyarbiter_port = 4455;

/* END OF USER CONFIG */

//M5StickC variables
PinButton btnM5(37); //the "M5" button on the device
PinButton btnAction(39); //the "Action" button on the device
Preferences preferences;
uint8_t wasPressed();
const byte led_program = 10;
const int led_preview = 26;   //OPTIONAL Led for preview on pin G26

//Tally Arbiter variables
SocketIOclient socket;
JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;
String DeviceId = "unassigned";
String DeviceName = "Unassigned";
String ListenerType = "m5-stickc";
bool mode_preview = false;
bool mode_program = false;
String LastMessage = "";

//General Variables
int currentScreen = 0; //0 = Tally Screen, 1 = Settings Screen
int currentBrightness = 11; //12 is Max level

void setup() {
  pinMode (led_preview, OUTPUT);
  Serial.begin(115200);
  while (!Serial);

  // Initialize the M5StickC object
  logger("Initializing M5StickC+.", "info-quiet");
  M5.begin();
  setCpuFrequencyMhz(80);    //Save battery by turning down the CPU clock
  btStop();                 //Save battery by turning off BlueTooth
  M5.Lcd.setRotation(3);
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.fillScreen(TFT_BLACK);
  M5.Lcd.setTextSize(1);
  logger("Tally Arbiter M5StickC+ Listener Client booting.", "info");

  
  // Enable interal led for program trigger
  pinMode(led_program, OUTPUT);
  digitalWrite(led_program, HIGH);

  preferences.begin("tally-arbiter", false);
  if(preferences.getString("deviceid").length() > 0){
    DeviceId = preferences.getString("deviceid");
  }
  if(preferences.getString("devicename").length() > 0){
    DeviceName = preferences.getString("devicename");
  }
  preferences.end();
  
  delay(100); //wait 100ms before moving on
  
  connectToNetwork(); //starts Wifi connection
}

void loop() {
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
  //displays the current network connection and Tally Arbiter server data
  M5.Lcd.setCursor(0, 0);
  M5.Lcd.fillScreen(TFT_BLACK);
  M5.Lcd.setTextSize(1);
  M5.Lcd.setTextColor(WHITE, BLACK);
  M5.Lcd.println("SSID: " + String(networkSSID));
  M5.Lcd.println(WiFi.localIP());
  M5.Lcd.println();
  M5.Lcd.println("Tally Arbiter Server:");
  M5.Lcd.println(String(tallyarbiter_host) + ":" + String(tallyarbiter_port));
  M5.Lcd.println();
  M5.Lcd.println("Battery:");
  int batteryLevel = floor(100.0 * (((M5.Axp.GetVbatData() * 1.1 / 1000) - 3.0) / (4.07 - 3.0)));
  batteryLevel = batteryLevel > 100 ? 100 : batteryLevel;
   if(batteryLevel >= 100){
  M5.Lcd.println("Battery charging...");   // show when M5 is plugged in
  }
  else {
    M5.Lcd.println("Battery:" + String(batteryLevel) + "%");
    }
}

void showDeviceInfo() {
  //displays the currently assigned device and tally data
  evaluateMode();
}

void updateBrightness() {
  if(currentBrightness >= 12) {
    currentBrightness = 7;
  }
  else {
    currentBrightness++;
  }
  M5.Axp.ScreenBreath(currentBrightness);
}

void logger(String strLog, String strType) {
  if (strType == "info") {
    Serial.println(strLog);
    M5.Lcd.println(strLog);
  }
  else {
    Serial.println(strLog);
  }
}

void connectToNetwork() {
  logger("Connecting to SSID: " + String(networkSSID), "info");

  WiFi.disconnect(true);
  WiFi.onEvent(WiFiEvent);

  WiFi.mode(WIFI_STA); //station
  WiFi.setSleep(false);

  if(USE_STATIC == true) {
    WiFi.config(clientIp, gateway, subnet);
  }

  WiFi.begin(networkSSID, networkPass);
  
  delay(1000); //Delay is needed to actually figure out, if connection is established
}

void WiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case SYSTEM_EVENT_STA_GOT_IP:
      logger("Network connected!", "info");
      logger(WiFi.localIP().toString(), "info");
      connectToServer(); //if connection to wifi is established, actually start to connect the socket
      break;
    case SYSTEM_EVENT_STA_DISCONNECTED:
      logger("Network connection lost!", "info");
      logger("WiFi: Trying to reconnect", "info");
      WiFi.reconnect(); //if the connection to WiFi is lost (for whatever reason, try to reconnect
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
  logger("Connecting to Tally Arbiter host: " + String(tallyarbiter_host), "info");
  socket.onEvent(socket_event);
  socket.begin(tallyarbiter_host, tallyarbiter_port);
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

void socket_Connected(const char * payload, size_t length) {
  logger("Connected to Tally Arbiter server.", "info");
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\", \"listenerType\": \"" + ListenerType + "\"}";
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  ws_emit("bus_options");
  ws_emit("device_listen_m5", charDeviceObj);
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
  oldDeviceId = strip_quot(oldDeviceId);
  newDeviceId = strip_quot(newDeviceId);

  String reassignObj = "{\"oldDeviceId\": \"" + oldDeviceId + "\", \"newDeviceId\": \"" + newDeviceId + "\"}";
  char charReassignObj[1024];
  strcpy(charReassignObj, reassignObj.c_str());
  ws_emit("listener_reassign_object", charReassignObj);
  ws_emit("devices");
  M5.Lcd.fillScreen(WHITE);
  delay(200);
  M5.Lcd.fillScreen(TFT_BLACK);
  delay(200);
  M5.Lcd.fillScreen(WHITE);
  delay(200);
  M5.Lcd.fillScreen(TFT_BLACK);
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
  for (int i = 0; i < DeviceStates.length(); i++) {
    if (getBusTypeById(JSON.stringify(DeviceStates[i]["busId"])) == "\"preview\"") {
      if (DeviceStates[i]["sources"].length() > 0) {
        mode_preview = true;
      }
      else {
        mode_preview = false;
      }
    }
    if (getBusTypeById(JSON.stringify(DeviceStates[i]["busId"])) == "\"program\"") {
      if (DeviceStates[i]["sources"].length() > 0) {
        mode_program = true;
      }
      else {
        mode_program = false;
      }
    }
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
  M5.Lcd.setCursor(0, 30);
  M5.Lcd.setTextSize(2);

  if (mode_preview && !mode_program) {
    logger("The device is in preview.", "info-quiet");
    M5.Lcd.setTextColor(BLACK);
    M5.Lcd.fillScreen(GREEN);
    digitalWrite(led_program, HIGH);
    digitalWrite (led_preview, HIGH);
  }
  else if (!mode_preview && mode_program) {
    logger("The device is in program.", "info-quiet");
    M5.Lcd.setTextColor(BLACK);
    M5.Lcd.fillScreen(RED);
    digitalWrite(led_program, LOW);
    digitalWrite(led_preview, LOW);
  }
  else if (mode_preview && mode_program) {
    logger("The device is in preview+program.", "info-quiet");
    M5.Lcd.setTextColor(BLACK);
    if (CUT_BUS == true) {
      M5.Lcd.fillScreen(RED);
    }
    else {
      M5.Lcd.fillScreen(YELLOW);
    }
    digitalWrite(led_program, LOW);
    digitalWrite (led_preview, HIGH);
  }
  else {
    digitalWrite(led_program, HIGH);
    digitalWrite(led_preview, LOW);
    M5.Lcd.setTextColor(GRAY);
    M5.Lcd.fillScreen(TFT_BLACK);
  }
  M5.Lcd.println(DeviceName);
   if (LAST_MSG == true){
    M5.Lcd.println(LastMessage);
  }
}