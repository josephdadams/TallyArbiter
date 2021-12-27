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
#define DATA_PIN_LED 27

//M5 variables
PinButton btnAction(39); //the "Action" button on the device
Preferences preferences;

/* USER CONFIG VARIABLES
    Change the following variables before compiling and sending the code to your device.
*/

//Tally Arbiter Server
char tallyarbiter_host[40] = "TALLYARBITERSERVERIP";
char tallyarbiter_port[6] = "4455";

//Uncomment these lines if you want the client to use a static IP address. Default is DHCP.
//Note that addresses entered here will need to be confirmed when WiFi Manager runs on client.
//
//local static IP config:
//IPAddress stationIP = IPAddress(192, 168, 1, 195);
//IPAddress stationGW = IPAddress(192, 168, 1, 1);
//IPAddress stationMask = IPAddress(255, 255, 255, 0);

//Local Default Camera Number
int camNumber = 1;

// Name of the device
String listenerDeviceName = "m5Atom-1";

// Enables the GPIO pinout
#define TALLY_EXTRA_OUTPUT false

/* END OF USER VARIABLES
 *  
 */

//Tally Arbiter variables
SocketIOclient socket;
WiFiManager wm; // global wm instance

JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;
String DeviceId = "unassigned";
String DeviceName = "unassigned";
String ListenerType = "m5";
const unsigned long reconnectInterval = 5000;
unsigned long currentReconnectTime = 0;
bool isReconnecting = false;

#if TALLY_EXTRA_OUTPUT
const int led_program = 10;
const int led_preview = 26; //OPTIONAL Led for preview on pin G26
const int led_aux = 36;     //OPTIONAL Led for aux on pin G36
#endif

String prevType = ""; // reduce display flicker by storing previous state
String actualType = "";
String actualColor = "";
int actualPriority = 0;

// default color values
int GRB_COLOR_WHITE = 0xffffff;
int GRB_COLOR_BLACK = 0x000000;
int GRB_COLOR_RED = 0xff0000;
int GRB_COLOR_ORANGE = 0xa5ff00;
int GRB_COLOR_YELLOW = 0xffff00;
int GRB_COLOR_GREEN = 0x00ff00;
int GRB_COLOR_BLUE = 0x0000ff;
int GRB_COLOR_PURPLE = 0x008080;

int numbercolor = GRB_COLOR_WHITE;

int flashcolor[] = {GRB_COLOR_WHITE, GRB_COLOR_WHITE};
int offcolor[] = {GRB_COLOR_BLACK, numbercolor};
int badcolor[] = {GRB_COLOR_BLACK, GRB_COLOR_RED};
int readycolor[] = {GRB_COLOR_BLACK, GRB_COLOR_GREEN};
int alloffcolor[] = {GRB_COLOR_BLACK, GRB_COLOR_BLACK};
int wificolor[] = {GRB_COLOR_BLACK, GRB_COLOR_BLUE};
int infocolor[] = {GRB_COLOR_BLACK, GRB_COLOR_ORANGE};

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
      String strDevice = JSON.stringify(Devices[i]["Type"]);
      DeviceName = strDevice.substring(1, strDevice.length() - 1);
      break;
    }
  }
  preferences.begin("tally-arbiter", false);
  preferences.putString("devicename", DeviceName);
  preferences.putString("deviceid", DeviceId);
  preferences.end();
  logger("-------------------------------------------------", "info-quiet");
  logger("DeviceName:" + String(DeviceName), "info-quiet");
  logger("DeviceId:" + String(DeviceId), "info-quiet");
  logger("-------------------------------------------------", "info-quiet");
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
 // This is to compensate for Matrix needing grb. Is there a better fix?
    int g = colorNumber >> 16;
    int r = colorNumber >> 8 & 0xFF;
    int b = colorNumber & 0xFF;
    
    if (actualType != "") {
      int backgroundColor = 0x10000 * r + 0x100 * g + b;
      int currColor[] = {backgroundColor, numbercolor};
      logger("Current color: " + String(backgroundColor), "info");
      //logger("Current camNumber: " + String(camNumber), "info");
      // If you want the camera number displayed over Pgm and Pvw, uncomment the following line and comment the line after.
      // drawNumber(number[camNumber], currColor);
      drawNumber(icons[12], currColor);
    } else {
      drawNumber(number[camNumber], offcolor);
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
    // This is a hack to compensate for the Matrix needing GRB. There must be a better way.
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
  logger("---------------------------------", "info-quiet");
  logger("Connecting to Tally Arbiter host: " + String(tallyarbiter_host), "info-quiet");
  socket.onEvent(socket_event);
  socket.begin(tallyarbiter_host, atol(tallyarbiter_port));
  logger("---------------------------------", "info-quiet");
}

// Here are all the socket listen events - messages sent from Tally Arbiter to the M5

void socket_Disconnected(const char * payload, size_t length) {
  logger("Disconnected from server, will try to re-connect: " + String(payload), "info-quiet");
  Serial.println("disconnected, going to try to reconnect");
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

      logger("Got event '" + eventType + "', data: " + eventContent, "VERBOSE");

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
  logger("Socket Reassign: " + String(payload), "info-quiet");
  Serial.println(payload);
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
  drawNumber(icons[1], alloffcolor);
  delay(100);
  drawNumber(icons[1], flashcolor);
  delay(100);
  drawNumber(icons[1], alloffcolor);
  delay(100);
  drawNumber(icons[1], flashcolor);
  delay(100);
  drawNumber(icons[1], alloffcolor);
  delay(100);
  drawNumber(icons[1], flashcolor);
  delay(100);
  drawNumber(icons[1], alloffcolor);
  delay(100);
  //then resume normal operation
  evaluateMode();
}

void socket_Connected(const char * payload, size_t length) {
  logger("---------------------------------", "info-quiet");
  logger("Connected to Tally Arbiter host: " + String(tallyarbiter_host), "info-quiet");
  isReconnecting = false;
  String deviceObj = "{\"deviceId\": \"" + DeviceId + "\", \"listenerType\": \"" + listenerDeviceName.c_str() + "\", \"canBeReassigned\": true, \"canBeFlashed\": true, \"supportsChat\": false }";
  logger("deviceObj = " + String(deviceObj), "info-quiet");
  logger("DeviceId = " + String(DeviceId), "info-quiet");
  char charDeviceObj[1024];
  strcpy(charDeviceObj, deviceObj.c_str());
  ws_emit("listenerclient_connect", charDeviceObj);
  logger("charDeviceObj = " + String(charDeviceObj), "info-quiet");
  logger("---------------------------------", "info-quiet");
}

void socket_BusOptions(String payload) {
  //logger("Socket Message BusOptions: " + String(payload), "info-quiet");
  BusOptions = JSON.parse(payload);
}

void socket_Devices(String payload) {
  //logger("Socket Message Devices: " + String(payload), "info-quiet");
  Devices = JSON.parse(payload);
  setDeviceName();
}

void socket_DeviceId(String payload) {
  //logger("Socket Message DeviceId: " + String(payload), "info-quiet");
  DeviceId = strip_quot(String(payload));
  setDeviceName();
}

void socket_DeviceStates(String payload) {
  //logger("Socket Message DeviceStates: " + String(payload), "VERBOSE");
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

void connectToNetwork() {
  // allow for static IP assignment instead of DHCP if stationIP is defined as something other than 0.0.0.0
  if (stationIP != IPAddress(0, 0, 0, 0))
  {
    wm.setSTAStaticIPConfig(stationIP, stationGW, stationMask); // optional DNS 4th argument 
  }
  
  WiFi.mode(WIFI_STA); // explicitly set mode, esp defaults to STA+AP

  logger("Connecting to SSID: " + String(WiFi.SSID()), "info");

  //reset settings - wipe credentials for testing
  //wm.resetSettings();

  //add TA fields
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
  
  res = wm.autoConnect(listenerDeviceName.c_str());

  if (!res) {
    logger("Failed to connect", "error");
    drawNumber(icons[10], badcolor); //display failed mark
    // ESP.restart();
  } else {
    //if you get here you have connected to the WiFi
    logger("connected...yay :)", "info");

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

// --------------------------------------------------------------------------------------------------------------------
// Setup is the pre-loop running program

void setup() {
  Serial.begin(115200);
  while (!Serial);
  logger("Initializing M5-Atom.", "info-quiet");
  
  //Save battery by turning off BlueTooth
  btStop();

  uint64_t chipid = ESP.getEfuseMac();
  listenerDeviceName = "m5Atom-" + String((uint16_t)(chipid>>32)) + String((uint32_t)chipid);
  logger("Listener device name: " + listenerDeviceName, "info");

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
  
  connectToNetwork(); //starts Wifi connection

  preferences.begin("tally-arbiter", false);
  if (preferences.getString("deviceid").length() > 0) {
    DeviceId = preferences.getString("deviceid");
    //DeviceId = "unassigned";
  }
  if (preferences.getString("devicename").length() > 0) {
    DeviceName = preferences.getString("devicename");
    //DeviceName = "unassigned";
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
  delay (100);
}
// --------------------------------------------------------------------------------------------------------------------

// --------------------------------------------------------------------------------------------------------------------
// This is the main program loop
void loop(){
  socket.loop();
  if (M5.Btn.wasPressed()){
    // Switch action below
    if (camNumber < 17){
      drawNumber(number[camNumber], offcolor);
    }
    camNumber++;
    if (camNumber > 16){
      camNumber = 0;
    }
    
    // Lets get some info sent out the serial connection for debugging
    logger("", "info-quiet");
    logger("---------------------------------", "info-quiet");
    logger("Button Pressed.", "info-quiet");
    logger("M5Atom IP Address: " + String(WiFi.localIP()), "info-quiet");
    logger("Tally Arbiter Server: " + String(tallyarbiter_host), "info-quiet");
    logger("Device ID: " + String(DeviceId), "info-quiet");
    logger("Device Name: " + String(DeviceName), "info-quiet");
    logger("Cam Number: " + String(camNumber), "info-quiet");
    logger("---------------------------------", "info-quiet");
    logger("", "info-quiet");
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
  
  delay(50);
  M5.update();
}
// --------------------------------------------------------------------------------------------------------------------
