/*
  Tally Arbiter Listener Client for M5StickS3
  Version 8 - cleaned release based on the proven v6 protocol flow

  Target:
    Arduino IDE
    Boards > M5Stack > M5StickS3

  Required libraries:
    M5Unified >= 0.2.12
    M5GFX >= 0.2.18
    WebSockets by Markus Sattler / Links2004
    Arduino_JSON
    WiFiManager

  Tally Arbiter behaviour:
    - Registers with listenerclient_connect, matching the official M5StickC client.
    - Saves reassignment changes in Preferences.
    - Polls device_states every 250 ms as a compatibility fallback.
    - Button A: short press changes screen; hold 5 seconds to erase Wi-Fi.
    - Button B: cycles display brightness.

  Do not include the legacy Free_Fonts.h header. M5GFX supplies the fonts.
*/

#include <M5Unified.h>
#include <M5GFX.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Arduino_JSON.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <Preferences.h>

#define START_BRIGHTNESS 80
#define MAX_BRIGHTNESS   255
#define BRIGHTNESS_STEP  35

#define DISABLE_WIFI_SLEEP true
char tallyarbiter_host[40] = "192.168.1.99";
char tallyarbiter_port[6]  = "4455";

constexpr const char *FIRMWARE_VERSION = "7.0";

String listenerDeviceName = "m5StickS3-";
String listenerDeviceHW   = "M5StickS3";

Preferences preferences;
SocketIOclient socket;
WiFiManager wm;

JSONVar BusOptions;
JSONVar Devices;
JSONVar DeviceStates;

String DeviceId = "unassigned";
String DeviceName = "Unassigned";
String prevType = "";
String prevColor = "";
String actualType = "";
String actualColor = "";
int actualPriority = 0;

bool networkConnected = false;
bool portalRunning = false;
bool restartAfterSettingsSave = false;
uint32_t settingsSavedAtMs = 0;
int currentScreen = 0;
uint8_t currentBrightness = START_BRIGHTNESS;

// Tally Arbiter normally pushes device_states updates after listener registration.
// Polling is also enabled as a compatibility/reliability fallback for
// server/client combinations where those push updates are not delivered.
constexpr uint32_t TALLY_POLL_INTERVAL_MS = 250;
uint32_t lastTallyPollMs = 0;
bool socketConnected = false;

WiFiManagerParameter *custom_taServer = nullptr;
WiFiManagerParameter *custom_taPort = nullptr;

// Forward declarations
void logger(const String &strLog, const String &strType);
void connectToNetwork();
void connectToServer();
void showSettings();
void showDeviceInfo();
void updateBrightness();
void evaluateMode();
void processTallyData();
void setDeviceName();
void checkResetGesture();
void socket_event(socketIOmessageType_t type, uint8_t *payload, size_t length);
void socket_Connected(const char *payload, size_t length);
void socket_Flash();
void socket_Reassign(String payload);
void saveParamCallback();
String getParam(String name);
String strip_quot(String str);
String getBusTypeById(String busId);
String getBusColorById(String busId);
int getBusPriorityById(String busId);
void ws_emit(String event, const char *payload = nullptr);
void requestDeviceState();

void configureLargeDisplay();
void configureSmallDisplay(int y);

void setup() {
  Serial.begin(115200);
  delay(100);

  auto cfg = M5.config();
  cfg.clear_display = true;
  cfg.output_power = true;
  M5.begin(cfg);

  M5.Display.setRotation(3);
  M5.Display.setBrightness(currentBrightness);
  M5.Display.fillScreen(TFT_BLACK);

  logger("Initializing " + listenerDeviceHW + ".", "info");

  // 80 MHz is adequate for this listener and reduces power consumption.
  setCpuFrequencyMhz(80);
  btStop();

  byte mac[6] = {};
  WiFi.macAddress(mac);

  char macSuffix[7];
  snprintf(macSuffix, sizeof(macSuffix), "%02X%02X%02X", mac[3], mac[4], mac[5]);
  listenerDeviceName += macSuffix;

  wm.setHostname(listenerDeviceName.c_str());

  configureSmallDisplay(12);
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
  M5.Display.println("booting...");

  logger("Tally Arbiter M5StickS3 Listener Client v" + String(FIRMWARE_VERSION) + " booting.", "info");
  logger("Listener device name: " + listenerDeviceName, "info");

  preferences.begin("tally-arbiter", true);

  String savedValue = preferences.getString("deviceid", "");
  if (!savedValue.isEmpty()) DeviceId = savedValue;

  savedValue = preferences.getString("devicename", "");
  if (!savedValue.isEmpty()) DeviceName = savedValue;

  savedValue = preferences.getString("taHost", "");
  if (!savedValue.isEmpty()) {
    savedValue.toCharArray(tallyarbiter_host, sizeof(tallyarbiter_host));
  }

  savedValue = preferences.getString("taPort", "");
  if (!savedValue.isEmpty()) {
    savedValue.toCharArray(tallyarbiter_port, sizeof(tallyarbiter_port));
  }

  preferences.end();

  connectToNetwork();

  while (!networkConnected) {
    M5.update();
    delay(50);
  }

  ArduinoOTA.setHostname(listenerDeviceName.c_str());
  ArduinoOTA.setPassword("tallyarbiter");

  ArduinoOTA
    .onStart([]() {
      const char *type =
        ArduinoOTA.getCommand() == U_FLASH ? "sketch" : "filesystem";
      Serial.printf("Start updating %s\n", type);
    })
    .onEnd([]() {
      Serial.println("\nOTA complete");
    })
    .onProgress([](unsigned int progress, unsigned int total) {
      if (total > 0) {
        Serial.printf("Progress: %u%%\r", (progress * 100U) / total);
      }
    })
    .onError([](ota_error_t error) {
      Serial.printf("OTA error [%u]: ", error);
      switch (error) {
        case OTA_AUTH_ERROR:    Serial.println("Auth failed"); break;
        case OTA_BEGIN_ERROR:   Serial.println("Begin failed"); break;
        case OTA_CONNECT_ERROR: Serial.println("Connect failed"); break;
        case OTA_RECEIVE_ERROR: Serial.println("Receive failed"); break;
        case OTA_END_ERROR:     Serial.println("End failed"); break;
        default:                Serial.println("Unknown"); break;
      }
    });

  ArduinoOTA.begin();

  connectToServer();
  showSettings();
}

void loop() {
  M5.update();

  if (portalRunning) {
    wm.process();
  }

  // Give WiFiManager time to return its confirmation page, then restart so
  // the socket reconnects using the newly saved Tally Arbiter host and port.
  if (restartAfterSettingsSave && millis() - settingsSavedAtMs >= 1500) {
    logger("Restarting to apply Tally Arbiter server settings", "info");
    ESP.restart();
  }

  ArduinoOTA.handle();
  socket.loop();

  // Compatibility fallback: explicitly request the assigned device state.
  // This keeps the tally responsive even when the server's push update is
  // not received by this embedded Socket.IO client.
  if (socketConnected &&
      !DeviceId.isEmpty() &&
      DeviceId != "unassigned" &&
      millis() - lastTallyPollMs >= TALLY_POLL_INTERVAL_MS) {
    lastTallyPollMs = millis();
    requestDeviceState();
  }

  checkResetGesture();

  // Button A: short click changes screen.
  if (M5.BtnA.wasClicked()) {
    if (currentScreen == 0) {
      showSettings();
    } else {
      showDeviceInfo();
    }
  }

  // Button B: cycle display brightness.
  if (M5.BtnB.wasClicked()) {
    updateBrightness();
  }

  delay(1);
}

void showSettings() {
  currentScreen = 1;
  logger("showSettings()", "info-quiet");

  if (!portalRunning) {
    wm.startWebPortal();
    portalRunning = true;
  }

  M5.Display.fillScreen(TFT_BLACK);
  configureSmallDisplay(12);
  M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);

  M5.Display.println("SSID:");
  M5.Display.println(WiFi.SSID());
  M5.Display.println(WiFi.localIP().toString());
  M5.Display.println();

  M5.Display.println("Tally Arbiter:");
  M5.Display.println(String(tallyarbiter_host) + ":" + String(tallyarbiter_port));
  M5.Display.println();

  M5.Display.println("Settings page:");
  M5.Display.println("http://" + WiFi.localIP().toString());
  M5.Display.println();

  M5.Display.print("Battery: ");
  if (M5.Power.isCharging()) {
    M5.Display.println("Charging");
  } else {
    int batteryLevel = M5.Power.getBatteryLevel();
    if (batteryLevel < 0) batteryLevel = 0;
    if (batteryLevel > 100) batteryLevel = 100;
    M5.Display.println(String(batteryLevel) + "%");
  }
}

void showDeviceInfo() {
  currentScreen = 0;
  logger("showDeviceInfo()", "info-quiet");

  if (portalRunning) {
    wm.stopWebPortal();
    portalRunning = false;
  }

  // Force repaint even if the tally type has not changed.
  prevType = "__force_redraw__";
  prevColor = "__force_redraw__";

  M5.Display.fillScreen(TFT_BLACK);
  configureLargeDisplay();
  M5.Display.setTextColor(TFT_DARKGREY, TFT_BLACK);
  M5.Display.println(DeviceName);
  evaluateMode();
}

void updateBrightness() {
  unsigned int next = currentBrightness + BRIGHTNESS_STEP;

  if (next > MAX_BRIGHTNESS) {
    currentBrightness = START_BRIGHTNESS;
  } else {
    currentBrightness = static_cast<uint8_t>(next);
  }

  M5.Display.setBrightness(currentBrightness);
  logger("Set brightness: " + String(currentBrightness), "info-quiet");
}

void logger(const String &message, const String &level) {
  // The level argument is retained for source compatibility and future filtering.
  (void)level;
  Serial.println(message);
}

void connectToNetwork() {
#if DISABLE_WIFI_SLEEP
  WiFi.setSleep(false);
#endif

  WiFi.mode(WIFI_STA);
  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
    (void)info;
    if (event == ARDUINO_EVENT_WIFI_STA_GOT_IP) {
      networkConnected = true;
      Serial.print("Network connected: ");
      Serial.println(WiFi.localIP());
    } else if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
      networkConnected = false;
      Serial.println("Network connection lost");
    }
  });

  custom_taServer = new WiFiManagerParameter(
    "taHostIP", "Tally Arbiter server IP or hostname", tallyarbiter_host,
    sizeof(tallyarbiter_host), "placeholder='192.168.1.99 or tallyarbiter.local'"
  );

  custom_taPort = new WiFiManagerParameter(
    "taHostPort", "Tally Arbiter port", tallyarbiter_port,
    sizeof(tallyarbiter_port), "type='number' min='1' max='65535'"
  );

  wm.addParameter(custom_taServer);
  wm.addParameter(custom_taPort);
  wm.setSaveParamsCallback(saveParamCallback);

  std::vector<const char *> menu = {
    "wifi", "param", "info", "sep", "restart", "exit"
  };

  wm.setMenu(menu);
  wm.setClass("invert");
  wm.setConfigPortalTimeout(120);

  if (wm.getWiFiIsSaved()) {
    M5.Display.println("connecting...");
  } else {
    M5.Display.println("Configure WiFi on:");
    M5.Display.println(listenerDeviceName);
  }

  bool connected = wm.autoConnect(listenerDeviceName.c_str());

  if (!connected) {
    logger("WiFi configuration timed out", "error");
    M5.Display.println("Configuration timeout");
    M5.Display.println("Hold A to reset");
    networkConnected = false;
    return;
  }

  networkConnected = true;
  logger("WiFi connected", "info");
}

String getParam(String name) {
  if (wm.server != nullptr && wm.server->hasArg(name)) {
    return wm.server->arg(name);
  }
  return "";
}

void saveParamCallback() {
  String newHost = getParam("taHostIP");
  String newPort = getParam("taHostPort");

  if (newHost.isEmpty() && custom_taServer != nullptr) {
    newHost = custom_taServer->getValue();
  }

  if (newPort.isEmpty() && custom_taPort != nullptr) {
    newPort = custom_taPort->getValue();
  }

  newHost.trim();
  newPort.trim();

  if (!newHost.isEmpty()) {
    newHost.toCharArray(tallyarbiter_host, sizeof(tallyarbiter_host));
  }

  long parsedPort = newPort.toInt();
  if (parsedPort >= 1 && parsedPort <= 65535) {
    newPort.toCharArray(tallyarbiter_port, sizeof(tallyarbiter_port));
  } else {
    logger("Invalid Tally Arbiter port; retaining " + String(tallyarbiter_port),
           "error");
  }

  preferences.begin("tally-arbiter", false);
  preferences.putString("taHost", tallyarbiter_host);
  preferences.putString("taPort", tallyarbiter_port);
  preferences.end();

  logger("Saved Tally Arbiter server: " +
         String(tallyarbiter_host) + ":" + String(tallyarbiter_port),
         "info");

  restartAfterSettingsSave = true;
  settingsSavedAtMs = millis();
}

void ws_emit(String event, const char *payload) {
  String msg;

  if (payload != nullptr) {
    msg = "[\"" + event + "\"," + payload + "]";
  } else {
    msg = "[\"" + event + "\"]";
  }

  socket.sendEVENT(msg);
}

void connectToServer() {
  logger("Connecting to Tally Arbiter host: " +
         String(tallyarbiter_host) + ":" + String(tallyarbiter_port),
         "info");

  socket.onEvent(socket_event);
  socket.begin(tallyarbiter_host, strtoul(tallyarbiter_port, nullptr, 10));
  socket.setReconnectInterval(3000);
}

void socket_event(socketIOmessageType_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case sIOtype_CONNECT:
      socketConnected = true;
      socket_Connected(reinterpret_cast<const char *>(payload), length);
      return;

    case sIOtype_DISCONNECT:
      socketConnected = false;
      logger("Disconnected from Tally Arbiter server", "info");
      return;

    case sIOtype_EVENT:
      break;

    case sIOtype_ACK:
    case sIOtype_ERROR:
    case sIOtype_BINARY_EVENT:
    case sIOtype_BINARY_ACK:
    default:
      return;
  }

  if (payload == nullptr || length == 0) {
    logger("Received empty Socket.IO event", "error");
    return;
  }

  String eventMsg(reinterpret_cast<char *>(payload), length);

  int firstQuote = eventMsg.indexOf('"');
  int secondQuote = eventMsg.indexOf('"', firstQuote + 1);

  if (firstQuote < 0 || secondQuote < 0) {
    logger("Invalid Socket.IO event: " + eventMsg, "error");
    return;
  }

  String eventType = eventMsg.substring(firstQuote + 1, secondQuote);

  int comma = eventMsg.indexOf(',', secondQuote);
  String eventContent = "";

  if (comma >= 0) {
    eventContent = eventMsg.substring(comma + 1);
    if (eventContent.endsWith("]")) {
      eventContent.remove(eventContent.length() - 1);
    }
  }

  logger("Got event '" + eventType + "', data: " + eventContent,
         "info-quiet");

  if (eventType == "bus_options") {
    BusOptions = JSON.parse(eventContent);
  } else if (eventType == "reassign") {
    socket_Reassign(eventContent);
  } else if (eventType == "flash") {
    socket_Flash();
  } else if (eventType == "deviceId") {
    // Tally Arbiter confirms the Device currently associated with this
    // listener. A new listener may initially be placed on the first configured Device;
    // Tally Arbiter permits multiple listeners to follow the same Device.
    DeviceId = strip_quot(eventContent);
    logger("Server-confirmed DeviceId: " + DeviceId, "info");

    ws_emit("devices");
    requestDeviceState();
  } else if (eventType == "devices") {
    Devices = JSON.parse(eventContent);
    setDeviceName();

    if (currentScreen == 0) {
      showDeviceInfo();
    }
  } else if (eventType == "device_states") {
    DeviceStates = JSON.parse(eventContent);
    processTallyData();
  }
}

void socket_Connected(const char *payload, size_t length) {
  (void)payload;
  (void)length;

  logger("Connected to Tally Arbiter server.", "info");

  // Use the same registration protocol as the official M5StickC listener.
  // Tally Arbiter associates this socket with DeviceId and subsequently emits
  // deviceId, devices, bus_options, device_states and reassign events.
  String listenerObj =
    "{\"deviceId\":\"" + DeviceId +
    "\",\"listenerType\":\"" + listenerDeviceName +
    "\",\"canBeReassigned\":true"
    ",\"canBeFlashed\":true"
    ",\"supportsChat\":true}";

  ws_emit("listenerclient_connect", listenerObj.c_str());
}

void requestDeviceState() {
  if (!socketConnected || DeviceId.isEmpty() || DeviceId == "unassigned") {
    return;
  }

  String stateMsg = "[\"device_states\",\"" + DeviceId + "\"]";
  socket.sendEVENT(stateMsg);
}

void socket_Flash() {
  for (int i = 0; i < 3; ++i) {
    M5.Display.fillScreen(TFT_WHITE);
    delay(300);
    M5.Display.fillScreen(TFT_BLACK);
    delay(300);
  }

  if (currentScreen == 0) {
    showDeviceInfo();
  } else {
    showSettings();
  }
}

String strip_quot(String str) {
  str.trim();

  if (str.startsWith("\"")) {
    str.remove(0, 1);
  }

  if (str.endsWith("\"")) {
    str.remove(str.length() - 1);
  }

  return str;
}

void socket_Reassign(String payload) {
  logger("socket_Reassign(): " + payload, "info");

  int firstComma = payload.indexOf(',');
  if (firstComma < 0) {
    logger("Invalid reassign payload", "error");
    return;
  }

  String oldDeviceId = strip_quot(payload.substring(0, firstComma));
  String remainder = payload.substring(firstComma + 1);

  int secondComma = remainder.indexOf(',');
  String newDeviceId =
    strip_quot(secondComma >= 0 ? remainder.substring(0, secondComma)
                                : remainder);

  if (newDeviceId.isEmpty() || newDeviceId == "null") {
    logger("Reassign contained no valid new DeviceId", "error");
    return;
  }

  // Acknowledge the reassignment exactly as the official client does.
  String reassignObj =
    "{\"oldDeviceId\":\"" + oldDeviceId +
    "\",\"newDeviceId\":\"" + newDeviceId + "\"}";
  ws_emit("listener_reassign_object", reassignObj.c_str());

  // Adopt and persist the assignment before requesting refreshed server data.
  DeviceId = newDeviceId;
  DeviceName = "Assigned";
  actualType = "";
  actualColor = "";
  actualPriority = 0;

  preferences.begin("tally-arbiter", false);
  preferences.putString("deviceid", DeviceId);
  preferences.end();

  ws_emit("devices");
  ws_emit("bus_options");
  requestDeviceState();

  for (int i = 0; i < 2; ++i) {
    M5.Display.fillScreen(TFT_RED);
    delay(200);
    M5.Display.fillScreen(TFT_BLACK);
    delay(200);
  }

  prevType = "__force_redraw__";
  prevColor = "__force_redraw__";

  if (currentScreen == 0) {
    showDeviceInfo();
  } else {
    showSettings();
  }

  logger("Reassigned and saved DeviceId: " + DeviceId, "info");
}

void processTallyData() {
  bool foundActiveState = false;
  int bestPriority = -2147483647;
  String bestType = "";
  String bestColor = "";

  if (JSON.typeof(DeviceStates) == "array") {
    for (int i = 0; i < DeviceStates.length(); ++i) {
      if (DeviceStates[i].hasOwnProperty("sources") &&
          DeviceStates[i]["sources"].length() > 0) {

        String busId = JSON.stringify(DeviceStates[i]["busId"]);
        int priority = getBusPriorityById(busId);

        if (!foundActiveState || priority > bestPriority) {
          foundActiveState = true;
          bestPriority = priority;
          bestType = getBusTypeById(busId);
          bestColor = getBusColorById(busId);
        }
      }
    }
  }

  if (foundActiveState) {
    actualType = bestType;
    actualColor = bestColor;
    actualPriority = bestPriority;
  } else {
    actualType = "";
    actualColor = "";
    actualPriority = 0;
  }

  evaluateMode();
}

String getBusTypeById(String busId) {
  if (JSON.typeof(BusOptions) != "array") return "invalid";

  for (int i = 0; i < BusOptions.length(); ++i) {
    if (JSON.stringify(BusOptions[i]["id"]) == busId) {
      return JSON.stringify(BusOptions[i]["type"]);
    }
  }

  return "invalid";
}

String getBusColorById(String busId) {
  if (JSON.typeof(BusOptions) != "array") return "\"#000000\"";

  for (int i = 0; i < BusOptions.length(); ++i) {
    if (JSON.stringify(BusOptions[i]["id"]) == busId) {
      return JSON.stringify(BusOptions[i]["color"]);
    }
  }

  return "\"#000000\"";
}

int getBusPriorityById(String busId) {
  if (JSON.typeof(BusOptions) != "array") return 0;

  for (int i = 0; i < BusOptions.length(); ++i) {
    if (JSON.stringify(BusOptions[i]["id"]) == busId) {
      return JSON.stringify(BusOptions[i]["priority"]).toInt();
    }
  }

  return 0;
}

void setDeviceName() {
  String resolvedName = DeviceId == "unassigned" ? "Unassigned" : DeviceName;

  if (JSON.typeof(Devices) == "array") {
    for (int i = 0; i < Devices.length(); ++i) {
      if (JSON.stringify(Devices[i]["id"]) == "\"" + DeviceId + "\"") {
        resolvedName = strip_quot(JSON.stringify(Devices[i]["name"]));
        break;
      }
    }
  }

  DeviceName = resolvedName;

  preferences.begin("tally-arbiter", false);
  preferences.putString("devicename", DeviceName);
  preferences.end();

  prevType = "__force_redraw__";
  prevColor = "__force_redraw__";
  evaluateMode();
  logger("DeviceName: " + DeviceName, "info");
}

void evaluateMode() {
  if (actualType != prevType || actualColor != prevColor) {
    configureLargeDisplay();

    String colorText = strip_quot(actualColor);
    colorText.replace("#", "");

    uint32_t rgb = 0;
    if (colorText.length() == 6) {
      rgb = strtoul(colorText.c_str(), nullptr, 16);
    }

    uint8_t r = (rgb >> 16) & 0xFF;
    uint8_t g = (rgb >> 8) & 0xFF;
    uint8_t b = rgb & 0xFF;

    if (!actualType.isEmpty()) {
      uint16_t fillColor = M5.Display.color565(r, g, b);
      M5.Display.fillScreen(fillColor);

      // Use white text on dark colours and black text on bright colours.
      uint16_t luminance =
        static_cast<uint16_t>(r) * 299U +
        static_cast<uint16_t>(g) * 587U +
        static_cast<uint16_t>(b) * 114U;

      M5.Display.setTextColor(
        luminance > 128000U ? TFT_BLACK : TFT_WHITE,
        fillColor
      );

      M5.Display.println(DeviceName);
    } else {
      M5.Display.fillScreen(TFT_BLACK);
      M5.Display.setTextColor(TFT_DARKGREY, TFT_BLACK);
      M5.Display.println(DeviceName);
    }

    logger("Device is in " + actualType +
           " (color " + actualColor +
           ", priority " + String(actualPriority) + ")",
           "info");

    prevType = actualType;
    prevColor = actualColor;
  }

}

void checkResetGesture() {
  static bool resetMessageShown = false;

  if (M5.BtnA.pressedFor(5000)) {
    if (!resetMessageShown) {
      resetMessageShown = true;

      M5.Display.fillScreen(TFT_BLACK);
      configureSmallDisplay(20);
      M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
      M5.Display.println("Erasing WiFi");
      M5.Display.println("and restarting...");

      logger("Button A held: erasing WiFi configuration", "info");

      if (portalRunning) {
        wm.stopWebPortal();
        portalRunning = false;
      }

      wm.resetSettings();
      delay(500);
      ESP.restart();
    }
  } else if (!M5.BtnA.isPressed()) {
    resetMessageShown = false;
  }
}

void configureLargeDisplay() {
  M5.Display.setTextWrap(true);
  M5.Display.setTextDatum(top_left);
  M5.Display.setFont(&fonts::FreeSansBold24pt7b);
  M5.Display.setTextSize(1);
  M5.Display.setCursor(4, 48);
}

void configureSmallDisplay(int y) {
  M5.Display.setTextWrap(true);
  M5.Display.setTextDatum(top_left);
  M5.Display.setFont(&fonts::FreeSans9pt7b);
  M5.Display.setTextSize(1);
  M5.Display.setCursor(4, y);
}
