#include <M5Atom.h>
#include <WiFi.h>
#include <SocketIoClient.h>
#include <Arduino_JSON.h>
#include <PinButton.h>

#include <stdint.h>

#include <Arduino.h>
#include <FastLED.h>

#define DATA_PIN_LED 27

/* USER CONFIG VARIABLES
 *  Change the following variables before compiling and sending the code to your device.
 */

//Wifi SSID and password
const char * networkSSID = "YourNetwork";
const char * networkPass = "YourPassword";

//Tally Arbiter Server
const char * tallyarbiter_host = "192.168.1.100";
const int tallyarbiter_port = 4455;

//Colors Colors
const CRGB preview_color = CRGB::Green;
const CRGB program_color = CRGB::Red;
const CRGB mixed_color = CRGB::Green;
const CRGB connected_color = CRGB::Green;
const CRGB flash_color = CRGB::Green;

// Numbers for matrix
const int pushButton = 39;
static CRGB leds[25];
static int cubestartpoint[] = {5,0,0};
static int state = 0;
static int camNumber = 8;
const int cube[11][25] ={{0,1,1,1,0,
                          0,1,0,1,0,
                          0,1,0,1,0,
                          0,1,0,1,0,
                          0,1,1,1,0},
                         {0,0,1,0,0,
                          0,1,1,0,0,
                          0,0,1,0,0,
                          0,0,1,0,0,
                          0,1,1,1,0},
                         {0,1,1,1,0,
                          0,0,0,1,0,
                          0,1,1,1,0,
                          0,1,0,0,0,
                          0,1,1,1,0},
                         {0,1,1,1,0,
                          0,0,0,1,0,
                          0,1,1,1,0,
                          0,0,0,1,0,
                          0,1,1,1,0},
                         {0,1,0,1,0,
                          0,1,0,1,0,
                          0,1,1,1,0,
                          0,0,0,1,0,
                          0,0,0,1,0},
                         {0,1,1,1,0,
                          0,1,0,0,0,
                          0,1,1,1,0,
                          0,0,0,1,0,
                          0,1,1,1,0},
                         {0,1,1,1,0,
                          0,1,0,0,0,
                          0,1,1,1,0,
                          0,1,0,1,0,
                          0,1,1,1,0},
                         {0,1,1,1,0,
                          0,0,0,1,0,
                          0,0,1,0,0,
                          0,1,0,0,0,
                          0,1,0,0,0},
                         {0,1,1,1,0,
                          0,1,0,1,0,
                          0,1,1,1,0,
                          0,1,0,1,0,
                          0,1,1,1,0},
                         {0,1,1,1,0,
                          0,1,0,1,0,
                          0,1,1,1,0,
                          0,0,0,1,0,
                          0,1,1,1,0},
                         {1,0,1,1,1,
                          1,0,1,0,1,
                          1,0,1,1,1,
                          1,0,1,0,1,
                          1,0,1,1,1},
                        };

//Tally Arbiter variables
SocketIoClient socket;
JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;
String DeviceId = "unassigned";
String DeviceName = "unassigned";
bool mode_preview = false;  
bool mode_program = false;
const byte led_program = 10;

//General Variables
bool networkConnected = false;

void setup() {
  Serial.begin(115200);
  while (!Serial);
  logger("Initializing M5StickC object.", "info-quiet");
  
  FastLED.addLeds < WS2812B, DATA_PIN_LED, GRB > (leds, 25);
  FastLED.setBrightness(20);

  delay(100); //wait 100ms before moving on
  connectToNetwork(); //starts Wifi connection
  while (!networkConnected) {
    delay(200);
  }
  // Flash screen blue if connected to wifi.

  // Enable interal led for program trigger
  pinMode(led_program, OUTPUT);
  digitalWrite(led_program, LOW);
  
  connectToServer();
}

void loop() {
  socket.loop();
  btnM5.update();
  
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
}
    /*if(Numbersprite){
        if(place < 25){
            int state = { cube[Numbersprite][place]};
            if(state){
                leds[place] = CRGB::White;
            };
            if(!state){
                leds[place] = CRGB::Black;
            };    
            place++;
        };
        if(place > 24){
            Numbersprite--;
            place = 0;
            delay(1000);
            FastLED.show();
            };
        };*/


void showSettings() {
  static int place = 0;
  if(place < 25){
    int state = { cube[camNumber][place]};
    if(state){
      leds[place] = CRGB::White;
    };
    if(!state){
      leds[place] = CRGB::Black;
    };    
    place++;
  };
  if(place > 24){
    Numbersprite--;
    place = 0;
    delay(1000);
    FastLED.show();
  };
 
}

void showDeviceInfo() {
  //displays the currently assigned device and tally data
  evaluateMode();
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

  WiFi.begin(networkSSID, networkPass);
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
  SetDeviceName();
}

void socket_DeviceId(const char * payload, size_t length) {
  DeviceId = String(payload);
  SetDeviceName();
}

void socket_DeviceStates(const char * payload, size_t length) {
  DeviceStates = JSON.parse(payload);
  processTallyData();
}

void socket_Flash(const char * payload, size_t length) {
  //flash the screen white 3 times
  // TODO
  
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

void socket_Reassign(const char * payload, size_t length) {
  String oldDeviceId = String(payload).substring(0,8);
  String newDeviceId = String(payload).substring(11);
  String reassignObj = "{\"oldDeviceId\": \"" + oldDeviceId + "\", \"newDeviceId\": \"" + newDeviceId + "\"}";
  char charReassignObj[1024];
  strcpy(charReassignObj, reassignObj.c_str());
  socket.emit("listener_reassign_object", charReassignObj);
  // Flash 2 times
  
  DeviceId = newDeviceId;
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

void setDeviceName() {
  for (int i = 0; i < Devices.length(); i++) {
    if (JSON.stringify(Devices[i]["id"]) == "\"" + DeviceId + "\"") {
      String strDevice = JSON.stringify(Devices[i]["name"]);
      DeviceName = strDevice.substring(1, strDevice.length() - 1);
      break;
    }
  }
}

void evaluateMode() {
  if (mode_preview && !mode_program) {
    logger("The device is in preview.", "info-quiet");
  }
  else if (!mode_preview && mode_program) {
    logger("The device is in program.", "info-quiet");
  }
  else if (mode_preview && mode_program) {
    logger("The device is in preview+program.", "info-quiet");
  }
  else {
    // Screen empty
  }
  }
}
