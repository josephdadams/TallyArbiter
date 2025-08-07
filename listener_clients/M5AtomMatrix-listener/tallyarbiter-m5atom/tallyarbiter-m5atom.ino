#include <M5Atom.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Arduino_JSON.h>
#include <PinButton.h>
#include <stdint.h>
#include <Arduino.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#define DATA_PIN_LED 27 // NeoPixelArray


// Set to true if you want to compile with the ability to show camera number during pvw and pgm
#define SHOW_CAMERA_NUMBER_DURING_PVW_AND_PGM false

// Enables the GPIO pinout
#define TALLY_EXTRA_OUTPUT true

//M5 variables
PinButton btnAction(39); //the "Action" button on the device - aka the front screen button for reset - push the front of the led display - ITS A BUTTON!
Preferences preferences;

/* USER CONFIG VARIABLES
    Change the following variables before compiling and sending the code to your device.
*/

//Tally Arbiter Server
char tallyarbiter_host[40] = "TALLYARBITERSERVERIPADDRESS";
char tallyarbiter_port[6] = "4455";

//Set staticIP to 1 if you want the client to use a static IP address. Default is DHCP.
//Note that addresses entered here will need to be confirmed when WiFi Manager runs on client.
//
//local static IP config:
#define staticIP 0
#if staticIP == 1
IPAddress stationIP = IPAddress(192, 168, 1, 195);
IPAddress stationGW = IPAddress(192, 168, 1, 1);
IPAddress stationMask = IPAddress(255, 255, 255, 0);
#endif

//Local Default Camera Number. Used for local display only - does not impact function. Zero results in a single dot displayed.
int camNumber = 0;

// Name of the device - the 3 last bytes of the mac address will be appended to create a unique identifier for the server.
String listenerDeviceName = "m5Atom-";

//M5atom Access Point Password
//minimum of 8 characters
//leave empty for open Access Point
const char* AP_password ="";

// Global array to hold rotated numbers
int rotatedNumber[25];

/* END OF USER VARIABLES
 *  
 */

//Tally Arbiter variables
SocketIOclient socket;
WiFiManager WiFiManager; // global WiFiManager instance

JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;
String DeviceId = "unassigned";
String DeviceName = "unassigned";
//String ListenerType = "m5";
const unsigned long reconnectInterval = 5000;
unsigned long currentReconnectTime = 0;
bool isReconnecting = false;

//General Variables
bool networkConnected = false;

#if TALLY_EXTRA_OUTPUT
const int led_program = 33; //Led for program on pin G33 - if TALLY_EXTRA_OUTPUT set to true at top of file
const int led_preview = 23; //Led for preview on pin G23 - if TALLY_EXTRA_OUTPUT set to true at top of file
const int led_aux = 19;     //Led for aux on pin G19 - if TALLY_EXTRA_OUTPUT set to true at top of file
#endif

String prevType = ""; // reduce display flicker by storing previous state
String actualType = "";
String actualColor = "";
int actualPriority = 0;
long colorNumber = 0;

// default color values
int RGB_COLOR_WHITE = 0xffffff;
int RGB_COLOR_DIMWHITE = 0x555555;
int RGB_COLOR_WARMWHITE = 0xFFEBC8;
int RGB_COLOR_DIMWARMWHITE = 0x877D5F;
int RGB_COLOR_BLACK = 0x000000;
int RGB_COLOR_RED = 0xff0000;
int RGB_COLOR_ORANGE = 0xa5ff00;
int RGB_COLOR_YELLOW = 0xffff00;
int RGB_COLOR_DIMYELLOW = 0x555500;
int RGB_COLOR_GREEN = 0x008800; // toning this down as the green is way brighter than the other colours
int RGB_COLOR_BLUE = 0x0000ff;
int RGB_COLOR_PURPLE = 0x008080;

int numbercolor = RGB_COLOR_WARMWHITE;

int flashcolor[] = {RGB_COLOR_WHITE, RGB_COLOR_WHITE};
int offcolor[] = {RGB_COLOR_BLACK, numbercolor};
int badcolor[] = {RGB_COLOR_BLACK, RGB_COLOR_RED};
int readycolor[] = {RGB_COLOR_BLACK, RGB_COLOR_GREEN};
int alloffcolor[] = {RGB_COLOR_BLACK, RGB_COLOR_BLACK};
int wificolor[] = {RGB_COLOR_BLACK, RGB_COLOR_BLUE};
int infocolor[] = {RGB_COLOR_BLACK, RGB_COLOR_ORANGE};

//this is the array that stores the number layout
int number[17][25] = {{
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 1,
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
};

// this array stores all the icons for the display
int icons[13][25] = {
  { 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1,
    1, 1, 1, 1, 1
  }, // full blank
  { 0, 0, 1, 1, 1,
    0, 1, 0, 0, 0,
    1, 0, 0, 1, 1,
    1, 0, 1, 0, 0,
    1, 0, 1, 0, 1
  }, // wifi 3 rings
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 1, 1,
    0, 0, 1, 0, 0,
    0, 0, 1, 0, 1
  }, // wifi 2 rings
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 1
  }, // wifi 1 ring
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  }, // reassign 1
  { 0, 0, 0, 0, 0,
    0, 1, 1, 1, 0,
    0, 1, 0, 1, 0,
    0, 1, 1, 1, 0,
    0, 0, 0, 0, 0
  }, // reassign 2
  { 1, 1, 1, 1, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1
  }, // reassign 3
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  }, // setup 1
  { 0, 0, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 1, 0, 1, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 0, 0
  }, // setup 2
  { 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0,
    1, 0, 0, 0, 1,
    0, 0, 0, 0, 0,
    0, 0, 1, 0, 0
  }, // setup 3
  { 1, 0, 0, 0, 1,
    0, 1, 0, 1, 0,
    0, 0, 1, 0, 0,
    0, 1, 0, 1, 0,
    1, 0, 0, 0, 1
  }, // error
  { 0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
    0, 0, 0, 0, 1,
    0, 0, 0, 1, 0
  }, // good
  { 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0
  }, // no icon
};

// Logger - logs to serial number
void logger(String strLog, String strType) {
  if (strType == "info") {
    Serial.println(strLog);
  }
  else {
    Serial.println(strLog);
  }
}
// Set Device name
void setDeviceName(){
  for (int i = 0; i < Devices.length(); i++) {
    if (JSON.stringify(Devices[i]["id"]) == "\"" + DeviceId + "\"") {
      String strDevice = JSON.stringify(Devices[i]["name"]);
      DeviceName = strDevice.substring(1, strDevice.length() - 1);
      break;
    }
  }
  preferences.begin("tally-arbiter", false);
  preferences.putString("devicename", DeviceName);
  //preferences.putString("deviceid", DeviceId);
  preferences.end();
  logger("DeviceName: " + String(DeviceName), "info-quiet");
  //logger("DeviceId: " + String(DeviceId), "info-quiet");
}

//---------------------------------------------------------------
//HERE IS THE MAIN LED DRAWING ROUTINE aka drawNumber
void drawNumber(int arr[], int colors[]) {
  for (int i = 0; i < 25; i++)
  {
    //Serial.println("i: " + String(i) + " color: " + String(colors[arr[i]]));
    M5.dis.drawpix(i, colors[arr[i]]);
  }
}

void drawMultiple(int arr[], int colors[], int param_times, int delays) {
  for (int times = param_times; times > 0; times--) {
    drawNumber(arr, colors);
    delay(delays);
  }
}
//---------------------------------------------------------------

// Determine if the device is currently in preview, program, or both
void evaluateMode() {
  if(actualType != prevType) {
    //M5.dis.clear();
    actualColor.replace("#", "");
    String hexstring = actualColor;
    long colorNumber = (long) strtol( &hexstring[1], NULL, 16);
 // This order is to compensate for Matrix needing grb.
    int r = strtol(hexstring.substring(3, 5).c_str(), NULL, 16);
    int g = strtol(hexstring.substring(1, 3).c_str(), NULL, 16);
    int b = strtol(hexstring.substring(5).c_str(), NULL, 16);
    
    if (actualType != "") {
      int backgroundColorhex = (g << 16) | (r << 8) | b; // Swap positions of RGB to GRB conversion
      int currColor[] = {backgroundColorhex, numbercolor};
      //debug
      //logger("Current color: " + String(backgroundColorhex), "info");
      //logger("Current camNumber: " + String(camNumber), "info");
#if SHOW_CAMERA_NUMBER_DURING_PVW_AND_PGM
      // If you want the camera number displayed during Pgm and Pvw, change the variable at the top of the file
      drawNumber(rotatedNumber[camNumber], currColor);
#else
      drawNumber(icons[12], currColor);
#endif
    } else {
      drawNumber(rotatedNumber, offcolor);
    }

    #if TALLY_EXTRA_OUTPUT
    if (actualType == "\"program\"") {
      digitalWrite(led_program, HIGH);
      digitalWrite (led_preview, LOW);
      digitalWrite (led_aux, LOW);
    } else if (actualType == "\"preview\"") {
      digitalWrite(led_program, LOW);
      digitalWrite (led_preview, HIGH);
      digitalWrite (led_aux, LOW);
    } else if (actualType == "\"aux\"") {
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
    // This is a hack to compensate for the Matrix needing GRB.
    logger(" r: " + String(g) + " g: " + String(r) + " b: " + String(b), "info");

    prevType = actualType;
  }  
}

void startReconnect() {
  if (!isReconnecting)
  {
    isReconnecting = true;
    currentReconnectTime = millis();
  }
}

void connectToServer() {
  logger("Connecting to Tally Arbiter host: " + String(tallyarbiter_host), "info");
  socket.onEvent(socket_event);
  socket.begin(tallyarbiter_host, atol(tallyarbiter_port));
}

// Here are all the socket listen events - messages sent from Tally Arbiter to the M5

void socket_Disconnected(const char * payload, size_t length) {
  logger("Disconnected from server, will try to re-connect: " + String(payload), "info-quiet");
  //Serial.println("disconnected, going to try to reconnect");
  startReconnect();
}

void ws_emit(String event, const char *payload = NULL) {
  if (payload) {
    String msg = "[\"" + event + "\"," + payload + "]";
    Serial.println(msg);
    socket.sendEVENT(msg);
  } else {
    String msg = "[\"" + event + "\"]";
    Serial.println(msg);
    socket.sendEVENT(msg);
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

void socket_event(socketIOmessageType_t type, uint8_t * payload, size_t length) {
  String eventMsg = "";
  String eventType = "";
  String eventContent = "";

  switch (type) {
    case sIOtype_CONNECT:
      socket_Connected((char*)payload, length);
      break;

    case sIOtype_DISCONNECT:
      socket_Disconnected((char*)payload, length);
      break;
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

      if (eventType == "bus_options") socket_BusOptions(eventContent);
      if (eventType == "deviceId") socket_DeviceId(eventContent);
      if (eventType == "devices") socket_Devices(eventContent);
      if (eventType == "device_states") socket_DeviceStates(eventContent);
      if (eventType == "flash") socket_Flash();
      if (eventType == "reassign") socket_Reassign(eventContent);

      break;

    default:
      break;
  }
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
  
  // Flash 2 times
  drawNumber(icons[1], alloffcolor);
  delay(200);
  drawNumber(icons[4], readycolor);
  delay(300);
  drawNumber(icons[1], alloffcolor);
  delay(200);
  drawNumber(icons[5], readycolor);
  delay(300);
  drawNumber(icons[1], alloffcolor);
  delay(200);
  drawNumber(icons[6], readycolor);
  delay(300);
  drawNumber(icons[1], alloffcolor);
  delay(200);

  logger("newDeviceId: " + newDeviceId, "info-quiet");
  DeviceId = newDeviceId;
  preferences.begin("tally-arbiter", false);
  preferences.putString("deviceid", newDeviceId);
  preferences.end();
  setDeviceName();
}

void socket_Flash() {
  //flash the screen white 3 times
  logger("The device flashed.", "info-quiet");
  for (int k = 0; k < 3; k++) {
    //Matrix Off
    drawNumber(icons[1], alloffcolor);
    delay(100);

    //Matrix On
    drawNumber(icons[1], flashcolor);
    delay(100);
  }
  //Matrix Off
  drawNumber(icons[1], alloffcolor);
  delay(100);
  //then resume normal operation
  prevType = "socket_Flash"; // Force repaint after socket flash
  evaluateMode();
  // Draw camera number after flashing
  drawNumber(rotatedNumber, offcolor);
}

void socket_Connected(const char * payload, size_t length) {
  logger("Connected to Tally Arbiter server.", "info");
  logger("DeviceId = " + DeviceId, "info-quiet");
  isReconnecting = false;
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\", \"listenerType\": \"" + listenerDeviceName.c_str() + "\", \"canBeReassigned\": true, \"canBeFlashed\": true, \"supportsChat\": false }";
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  ws_emit("listenerclient_connect", charDeviceObj);
}

void socket_BusOptions(String payload) {
  BusOptions = JSON.parse(payload);
}

void socket_Devices(String payload) {
  Devices = JSON.parse(payload);
  setDeviceName();
}

void socket_DeviceId(String payload) {
  //DeviceId = strip_quot(String(payload));
  DeviceId = payload.substring(1, payload.length() - 1);
  setDeviceName();
}

void socket_DeviceStates(String payload) {
  DeviceStates = JSON.parse(payload);
  processTallyData();
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

// A whole ton of WiFiManager stuff, first up, here is the Paramaters
WiFiManagerParameter* custom_taServer;
WiFiManagerParameter* custom_taPort;
//WiFiManagerParameter* custom_tashownumbersduringtally;

void connectToNetwork() {
  // allow for static IP assignment instead of DHCP if stationIP is defined as something other than 0.0.0.0
  #if staticIP == 1
  if (stationIP != IPAddress(0, 0, 0, 0))
  {
    WiFiManager.setSTAStaticIPConfig(stationIP, stationGW, stationMask); // optional DNS 4th argument 
  }
  #endif
  
  WiFi.mode(WIFI_STA); // explicitly set mode, esp defaults to STA+AP
  logger("Connecting to SSID: " + String(WiFi.SSID()), "info");

  //reset settings - wipe credentials for testing
  //WiFiManager.resetSettings();

  //add TA fields
  custom_taServer = new WiFiManagerParameter("taHostIP", "Tally Arbiter Server", tallyarbiter_host, 40);
  custom_taPort = new WiFiManagerParameter("taHostPort", "Port", tallyarbiter_port, 6);
 // custom_tashownumbersduringtally = new WiFiManagerParameter("tashownumbersduringtally", "Show Number During Tally (true/false)", SHOW_CAMERA_NUMBER_DURING_PVW_AND_PGM, 6);

  WiFiManager.addParameter(custom_taServer);
  WiFiManager.addParameter(custom_taPort);
  //WiFiManager.addParameter(custom_tashownumbersduringtally);

  WiFiManager.setSaveParamsCallback(saveParamCallback);

  // custom menu via array or vector
  std::vector<const char *> menu = {"wifi","param","info","sep","restart","exit"};
  WiFiManager.setMenu(menu);

  // set dark theme
  WiFiManager.setClass("invert");

  WiFiManager.setConfigPortalTimeout(120); // auto close configportal after n seconds

  bool res;
  
  res = WiFiManager.autoConnect(listenerDeviceName.c_str(),AP_password);

  if (!res) {
    logger("Failed to connect", "error");
    drawNumber(icons[10], badcolor); //display failed mark
    // ESP.restart();
  } else {
    //if you get here you have connected to the WiFi
    logger("connected...yay :)", "info");
    networkConnected = true;

    // Flash screen if connected to wifi.
    drawNumber(icons[3], wificolor); //1 ring
    delay(500);
    drawNumber(icons[2], wificolor); //2 rings
    delay(500);
    drawNumber(icons[1], wificolor); //3 rings
    delay(500);
    drawNumber(icons[11], readycolor); //display okay mark
    delay(400);
    
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
  if (WiFiManager.server->hasArg(name)) {
    value = WiFiManager.server->arg(name);
  }
  return value;
}


void saveParamCallback() {
  logger("[CALLBACK] saveParamCallback fired", "info-quiet");
  logger("PARAM tally Arbiter Server = " + getParam("taHostIP"), "info-quiet");
  String str_taHost = getParam("taHostIP");
  String str_taPort = getParam("taHostPort");
  String str_tashownumbersduringtally = getParam("tashownumbersduringtally");
  //saveEEPROM(); // this was commented out as prefrences is now being used in place
  logger("Saving new TallyArbiter host", "info-quiet");
  logger(str_taHost, "info-quiet");
  preferences.begin("tally-arbiter", false);
  preferences.putString("taHost", str_taHost);
  preferences.putString("taPort", str_taPort);
  preferences.putString("tashownumbersduringtally", str_tashownumbersduringtally);
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

// --------------------------------------------------------------------------------------------------------------------
// Setup is the pre-loop running program

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // Initialize the M5Atom object
  logger("Initializing M5-Atom.", "info-quiet");
  
  //Save battery by turning off BlueTooth
  btStop();
  
  //Initialize WiFi
  WiFi.begin();

  // Initialize IMU (MPU6886) The rotation sensor
  if (M5.IMU.Init() != 0) {
    Serial.println("MPU6886 initialization failed!");
    while (1) delay(100);
  } else {
    Serial.println("MPU6886 initialization successful!");
  }

  // Append last three pairs of MAC to listenerDeviceName to make it some what unique
  byte mac[6];              // the MAC address of your Wifi shield
  WiFi.macAddress(mac);
  listenerDeviceName = listenerDeviceName + String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
  logger("Listener device name: " + listenerDeviceName, "info");

  // Set WiFi hostname
  WiFiManager.setHostname ((const char *) listenerDeviceName.c_str());

  M5.begin(true, false, true);
  delay(50);
  M5.dis.drawpix(0, 0xf00000);

  // blanks out the screen
  drawNumber(icons[0], alloffcolor);
  delay(100); //wait 100ms before moving on

  //do startup animation
  drawNumber(icons[7], infocolor);
  delay(400);
  drawNumber(icons[8], infocolor);
  delay(400);
  drawNumber(icons[9], infocolor);
  delay(400);
  
  // Load from non-volatile memory
  preferences.begin("tally-arbiter", false);

  // added to clear out corrupt prefs
  //preferences.clear();
  if (preferences.getString("deviceid").length() > 0) {
    DeviceId = preferences.getString("deviceid");
  }
  if (preferences.getString("devicename").length() > 0) {
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
  camNumber = preferences.getInt("camNumber"); // Get camera from memory
//    SHOW_CAMERA_NUMBER_DURING_PVW_AND_PGM = preferences.getInt("tashownumbersduringtally"); // Get prefrence for Showing numbers during tally (default false)

  preferences.end();

  // Initialize rotatedNumber with current orientation
  float accX, accY, accZ;
  M5.IMU.getAccelData(&accX, &accY, &accZ);
  updateDisplayBasedOnOrientation(accX, accY, accZ);  // Initialize rotatedNumber

  delay(100); //wait 100ms before moving on
  connectToNetwork(); //starts Wifi connection
  while (!networkConnected) {
    delay(200);
  }  

  // Show camera number after WiFi connection
  drawNumber(rotatedNumber, offcolor);  

  //debug
  //char message[200]; // Adjust the size as needed
  //sprintf(message, "After the preferences.end TA Host is: %s TA Port is: %s", tallyarbiter_host, tallyarbiter_port);
  //logger(message, "info-quiet");

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
  // Enable external led for program trigger
  pinMode(led_program, OUTPUT);
  digitalWrite(led_program, HIGH);
  pinMode(led_preview, OUTPUT);
  digitalWrite(led_preview, HIGH);
  pinMode(led_aux, OUTPUT);
  digitalWrite(led_aux, HIGH);
  #endif  
  
  connectToServer();
  delay (100);
}
// --------------------------------------------------------------------------------------------------------------------

// Functions for Screen Rotation for AutoRotation

void rotate90(int source[25], int dest[25]) {
    for (int i = 0; i < 5; ++i) {
        for (int j = 0; j < 5; ++j) {
            dest[j * 5 + (4 - i)] = source[i * 5 + j];
        }
    }
}

void rotate180(int source[25], int dest[25]) {
    for (int i = 0; i < 25; ++i) {
        dest[24 - i] = source[i];
    }
}

void rotate270(int source[25], int dest[25]) {
    for (int i = 0; i < 5; ++i) {
        for (int j = 0; j < 5; ++j) {
            dest[(4 - j) * 5 + i] = source[i * 5 + j];
        }
    }
}

// Screen Update Routine
void updateDisplayBasedOnOrientation(float accX, float accY, float accZ) {
  //Serial.print("Screen Orientation: ");
  //Serial.print("Accel X: ");
  //Serial.print(accX);
  //Serial.print(" Y: ");
  //Serial.print(accY);
  //Serial.print(" Z: ");
  //Serial.print(accZ);
  //Serial.println(" m/s^2");
  
  // 0.8 is used as a deadband control

  // Check for USB right (Normal orientation)
  if (accX > 0.8) {
  //  Serial.println("USB Right - 0 degrees (normal)");
    memcpy(rotatedNumber, number[camNumber], sizeof(int) * 25);
  } 
  // Check for USB left (180 degrees)
  else if (accX < -0.8) {
  //  Serial.println("USB Left - 180 degrees");
    rotate180(number[camNumber], rotatedNumber);
  } 
  // Check for USB up
  else if (accY > 0.8) {
  //  Serial.println("USB Up - 90 degrees");
    rotate90(number[camNumber], rotatedNumber);
  } 
  // Check for USB down
  else if (accY < -0.8) {
  //  Serial.println("USB Down - 270 degrees");
    rotate270(number[camNumber], rotatedNumber);
  } 
  else {
  //  Serial.println("Flat or undefined orientation");
    memcpy(rotatedNumber, number[camNumber], sizeof(int) * 25);
  }

}


// --------------------------------------------------------------------------------------------------------------------
// This is the main program loop
void loop(){
  socket.loop();
  if (M5.Btn.wasPressed()){
    // Switch action below
    if (camNumber < 16){
      camNumber++;  
        preferences.begin("tally-arbiter", false);          // Open Preferences with no read-only access
        preferences.putInt("camNumber", camNumber);      // Save camera number
        delay(100);                                         // Introduce a short delay before closing
        preferences.end();                                  // Close the Preferences after saving
    } else {
      camNumber = 0;
        preferences.begin("tally-arbiter", false);          // Open Preferences with no read-only access
        preferences.putInt("camNumber", camNumber);      // Save camera number
        delay(100);                                         // Introduce a short delay before closing
        preferences.end();                                  // Close the Preferences after saving
    }
    
    // Orientation Sensor Data variables
    float accX, accY, accZ;

    // Read acceleration data
    M5.IMU.getAccelData(&accX, &accY, &accZ);

    // Run the rotation change to the variabne rotatedNumber
    updateDisplayBasedOnOrientation(accX, accY, accZ);
    
    drawNumber(rotatedNumber, offcolor);

    // Lets get some info sent out the serial connection for debugging
    logger("Button Pressed.", "info-quiet");
    logger("M5Atom IP Address: " + WiFi.localIP().toString(), "info-quiet");
    logger("Tally Arbiter Server: " + String(tallyarbiter_host), "info-quiet");
    logger("Device ID: " + String(DeviceId), "info-quiet");
    logger("Device Name: " + String(DeviceName), "info-quiet");
    logger("Cam Number: " + String(camNumber), "info-quiet");
  }
    
  // Is WiFi reset triggered?
  if (M5.Btn.pressedFor(5000)){
    WiFiManager.resetSettings();
    ESP.restart();
  }

  // handle reconnecting if disconnected
  if (isReconnecting)
  {
  unsigned long currentTime = millis();
    
    if (currentTime - currentReconnectTime >= reconnectInterval)
    {
      Serial.println("trying to re-connect with server");
      connectToServer();
      currentReconnectTime = millis();
    }
  }

//#if AUTO_ORIENTATION
  // Check orientation and autorotate the screen

    // Orientation Sensor Data variables
  //float accX, accY, accZ;

  // Read acceleration data
  //M5.IMU.getAccelData(&accX, &accY, &accZ);

  // Run the rotation change to the variabne rotatedNumber
  //updateDisplayBasedOnOrientation(accX, accY, accZ);
    
//  #else
//  #endif
  
  delay(100);
  M5.update();
}
// --------------------------------------------------------------------------------------------------------------------
