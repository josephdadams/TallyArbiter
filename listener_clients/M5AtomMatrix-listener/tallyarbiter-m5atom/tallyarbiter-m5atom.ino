#include <M5Atom.h>
#include <WiFi.h>
#include <SocketIoClient.h>
#include <Arduino_JSON.h>
#include <PinButton.h>
#include <stdint.h>
#include <Arduino.h>
#define DATA_PIN_LED 27

//General Variables
bool networkConnected = false;
int currentScreen;
uint8_t FSM = 0;

//M5StickC variables
PinButton btnAction(39); //the "Action" button on the device

/* USER CONFIG VARIABLES
    Change the following variables before compiling and sending the code to your device.
*/

//Wifi SSID and password
const char * networkSSID = "WifiSSID";
const char * networkPass = "WifiPassword";

//Tally Arbiter Server
const char * tallyarbiter_host = "TALLYARBITERSERVERIP";
const int tallyarbiter_port = 4455;

//Local Default Camera Number
int camNumber = 0;

//Tally Arbiter variables
SocketIoClient socket;
JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;
String DeviceId = "01";
String DeviceName = "M5AtomMatrix";
bool mode_preview = true;
bool mode_program = false;
// const byte led_program = 10;


// default color values
int GRB_COLOR_WHITE = 0xffffff;
int GRB_COLOR_BLACK = 0x000000;
int GRB_COLOR_RED = 0x00ff00;
int GRB_COLOR_ORANGE = 0xa5ff00;
int GRB_COLOR_YELLOW = 0xffff00;
int GRB_COLOR_GREEN = 0xff0000;
int GRB_COLOR_BLUE = 0x0000ff;
int GRB_COLOR_PURPLE = 0x008080;

int numbercolor = GRB_COLOR_ORANGE;

int programcolor[] = {GRB_COLOR_RED, numbercolor};
int previewcolor[] = {GRB_COLOR_GREEN, numbercolor};
int mixedcolor[] = {GRB_COLOR_YELLOW, numbercolor};
int flashcolor[] = {GRB_COLOR_WHITE, GRB_COLOR_WHITE};
int offcolor[] = {GRB_COLOR_BLACK, numbercolor};
int readycolour[] = {GRB_COLOR_BLUE, GRB_COLOR_BLUE};
int alloffcolor[] = {GRB_COLOR_BLACK, GRB_COLOR_BLACK};

int currentBrightness = 20;

//this is the array that stores the number layout
int number[18][25] = {{
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 1,
    1, 1, 1, 1, 1,
    0, 1, 0, 0, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 0, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 0, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    0, 0, 1, 0, 0,
    1, 1, 1, 0, 0,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 0, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0,
    1, 0, 1, 0, 0,
    1, 0, 0, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 0, 1,
    0, 0, 0, 0, 0
  },
  { 1, 1, 1, 1, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0
  },
  { 1, 1, 1, 0, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 0, 1, 0, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 1, 1, 1, 1,
    0, 0, 1, 0, 0,
    1, 1, 1, 0, 0,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 0, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 0, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0,
    1, 1, 1, 1, 1
  },
  { 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1
  },
};

//Logger
void logger(String strLog, String strType) {
  if (strType == "info") {
    Serial.println(strLog);
  }
  else {
    Serial.println(strLog);
  }
}

void setDeviceName()
{
  for (int i = 0; i < Devices.length(); i++) {
    if (JSON.stringify(Devices[i]["id"]) == "\"" + DeviceId + "\"") {
      String strDevice = JSON.stringify(Devices[i]["Type"]);
      DeviceName = strDevice.substring(1, strDevice.length() - 1);
      break;
    }
  }
}

void WiFiEvent(WiFiEvent_t event) {
  switch (event) {
    case SYSTEM_EVENT_STA_GOT_IP:
      logger("Network connected!", "info");
      logger(String(WiFi.localIP()), "info");
      networkConnected = true;
      break;
    case SYSTEM_EVENT_STA_DISCONNECTED:
      logger("Network connection lost!", "info");
      networkConnected = false;
      break;
  }
}

//---------------------------------------------------------------
//HERE IS THE MAIN LED DRAWING ROUTINE aka drawNumber
void drawNumber(int arr[], int colors[])
{
  for (int i = 0; i < 25; i++)
  {
    M5.dis.drawpix(i, colors[arr[i]]);
  }
}
//---------------------------------------------------------------

// This is the main status checking part of the code, weird name but eh.
void evaluateMode() {
  if (mode_preview && !mode_program) {
    logger("The device is in preview.", "info-quiet");
    M5.dis.clear();
    drawNumber(number[camNumber], previewcolor);
  }
  else if (!mode_preview && mode_program) {
    logger("The device is in program.", "info-quiet");
    M5.dis.clear();
    drawNumber(number[camNumber], programcolor);
  }
  else if (mode_preview && mode_program) {
    M5.dis.clear();
    drawNumber(number[camNumber], mixedcolor);
  }
  else {
    M5.dis.clear();
    drawNumber(number[camNumber], offcolor);
  }
}

void showDeviceInfo() {
  //displays the currently assigned device and tally data
  evaluateMode();
}


void socket_Flash(const char * payload, size_t length) {
  //flash the screen white 3 times
  // TODO
  drawNumber(number[17], alloffcolor);
  delay(100);
  drawNumber(number[17], flashcolor);
  delay(100);
  drawNumber(number[17], alloffcolor);
  delay(100);
  drawNumber(number[17], flashcolor);
  delay(100);
  drawNumber(number[17], alloffcolor);
  delay(100);
  drawNumber(number[17], flashcolor);
  delay(100);
  drawNumber(number[17], alloffcolor);
  delay(100);
  //then resume normal operation
  switch (currentScreen) {
    case 0:
      showDeviceInfo();
      break;
    case 1:
      //  showSettings();
      break;
  }
}


void socket_Reassign(const char * payload, size_t length) {
  String oldDeviceId = String(payload).substring(0, 8);
  String newDeviceId = String(payload).substring(11);
  String reassignObj = "{\"oldDeviceId\": \"" + oldDeviceId + "\", \"newDeviceId\": \"" + newDeviceId + "\"}";
  char charReassignObj[1024];
  strcpy(charReassignObj, reassignObj.c_str());
  socket.emit("listener_reassign_object", charReassignObj);
  // Flash 2 times

  DeviceId = newDeviceId;
  setDeviceName();
}

void connectToServer() {
  logger("Connecting to Tally Arbiter host: " + String(tallyarbiter_host), "info");
  socket.on("connect", socket_Connected);
  socket.on("bus_options", socket_BusOptions);
  socket.on("deviceId", socket_DeviceId);
  socket.on("devices", socket_Devices);
  socket.on("device_states", socket_DeviceStates);
  socket.on("flash", socket_Flash);
  socket.on("reassign", socket_Reassign);
  socket.begin(tallyarbiter_host, tallyarbiter_port);
}

void socket_Connected(const char * payload, size_t length) {
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\"}";
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  socket.emit("bus_options");
  socket.emit("device_listen_m5stick", charDeviceObj);
}

void socket_BusOptions(const char * payload, size_t length) {
  BusOptions = JSON.parse(payload);
}

void socket_Devices(const char * payload, size_t length) {
  Devices = JSON.parse(payload);
  setDeviceName();
}

void socket_DeviceId(const char * payload, size_t length) {
  DeviceId = String(payload);
  setDeviceName();
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


void socket_DeviceStates(const char * payload, size_t length) {
  DeviceStates = JSON.parse(payload);
  processTallyData();
}


void connectToNetwork() {
  logger("Connecting to SSID: " + String(networkSSID), "info");

  WiFi.disconnect(true);
  WiFi.onEvent(WiFiEvent);

  WiFi.mode(WIFI_STA); //station
  WiFi.setSleep(false);

  WiFi.begin(networkSSID, networkPass);
}


void setup() {
  Serial.begin(115200);
  while (!Serial);
  logger("Initializing M5StickC object.", "info-quiet");

  M5.begin(true, false, true);
  delay(50);
  M5.dis.drawpix(0, 0xf00000);

  drawNumber(number[17], alloffcolor);
  delay(100); //wait 100ms before moving on

  connectToNetwork(); //starts Wifi connection
  while (!networkConnected) {
    delay(200);
  }
  // Flash screen if connected to wifi.
  drawNumber(number[17], alloffcolor);
  delay(100);
  drawNumber(number[17], readycolour);
  delay(300);
  drawNumber(number[17], alloffcolor);
  delay(100);

  // Enable interal led for program trigger
  // pinMode(led_program, OUTPUT);
  // digitalWrite(led_program, HIGH);

  connectToServer();
  delay (100);
}

void loop()
{
  socket.loop();
  if (M5.Btn.wasPressed())
  {
    if (FSM < 17)
    {
      camNumber = FSM;
      drawNumber(number[FSM], offcolor);
    }
    FSM++;
    if (FSM > 16)
    {
      FSM = 0;  
    }
  }

  delay(50);
  M5.update();
}
