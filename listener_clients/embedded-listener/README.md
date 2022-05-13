# Embedded listener client

# Development

## Configuring platformio.ini

We use the following build flags:
<table>
    <thead>
      <tr>
        <th><b>FLAG NAME</b></th>
        <th><b>DESCRIPTION</b></th>
        <th><b>EXAMPLE VALUE</b></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="3" align="center">GENERIC</td>
      </tr>
      <tr>
        <td>PLATFORM_ARCH_ESP32<br>PLATFORM_ARCH_ESP8266</td>
        <td>Determine if the processor is ESP32-based or ESP8266-based</td>
        <td></td>
      </tr>
      <tr>
        <td>PLATFORM_NAME</td>
        <td>Listener client name added in TallyArbiter</td>
        <td>generic-embedded-listener</td>
      </tr>
      <tr>
        <td>MENU_BUTTON_PIN</td>
        <td>Click once to show info screen. Double click to show settings page (and enable configuration portal). Long click (then confirm long-pressing again) to reset device settings.</td>
        <td>35</td>
      </tr>
      <tr>
        <td>SLEEP_BUTTON_PIN</td>
        <td>Click once to start "deep sleep mode". Long press to restart.</td>
        <td>0</td>
      </tr>
      <tr>
        <td>RESET_DURING_BOOT_IF_BUTTON_PRESSED</td>
        <td>
          Reset the device settings if device button pressed during the boot of
          the device (like accessing PC boot menu). MENU_BUTTON_PIN should be defined for this to be enabled.
        </td>
        <td>true</td>
      </tr>
      <tr>
        <td colspan="3" align="center">NETWORK-SPECIFIC</td>
      </tr>
      <tr>
        <td>USE_STATIC_IP</td>
        <td>Force the Network lib to use a static IP</td>
        <td>true</td>
      </tr>
      <tr>
        <td>STATIC_IP_ADDR</td>
        <td>Static IP Address (only if USE_STATIC_IP is set)</td>
        <td>IPAddress(192,168,0,99)</td>
      </tr>
      <tr>
        <td>GATEWAY_IP_ADDR</td>
        <td>Gateway IP Address (only if USE_STATIC_IP is set)</td>
        <td>IPAddress(192,168,0,1)</td>
      </tr>
      <tr>
        <td>SUBNET_ADDR</td>
        <td>Subnet Address (only if USE_STATIC_IP is set)</td>
        <td>IPAddress(255,255,255,0)</td>
      </tr>
      <tr>
        <td>DNS_ADDR</td>
        <td>DNS Server Address (only if USE_STATIC_IP is set)</td>
        <td>IPAddress(192,168,0,1)</td>
      </tr>
      <tr>
        <td colspan="3" align="center">TALLY OUTPUT</td>
      </tr>
      <tr>
        <td>PREVIEW_TALLY_STATUS_PIN</td>
        <td>Output the listener preview status powering that PIN</td>
        <td>D7</td>
      </tr>
      <tr>
        <td>PROGRAM_TALLY_STATUS_PIN</td>
        <td>Output the listener program status powering that PIN</td>
        <td>D6</td>
      </tr>
      <tr>
        <td>AUX_TALLY_STATUS_PIN</td>
        <td>Output the listener aux status powering that PIN</td>
        <td>D5</td>
      </tr>
      <tr>
        <td>INVERT_OUTPUT_LOGIC</td>
        <td>Invert the power output on the tally status PIN(s).<br>Enable this if you are using common-anode LEDs.</td>
        <td>true</td>
      </tr>
      <tr>
        <td>ENABLE_ADAFRUIT_NEOPIXEL</td>
        <td>Set if you want to use Adafruit NeoPixel</td>
        <td></td>
      </tr>
      <tr>
        <td>ADAFRUIT_NEOPIXEL_LED_PIN</td>
        <td>The Adafruit NeoPixel LED control PIN</td>
        <td>5</td>
      </tr>
      <tr>
        <td>ADAFRUIT_NEOPIXEL_BRIGHTNESS</td>
        <td>Set BRIGHTNESS to about 1/5 (max = 255)</td>
        <td>50</td>
      </tr>
      <tr>
        <td>ADAFRUIT_NEOPIXEL_LED_COUNT</td>
        <td>NeoPixel LED count</td>
        <td>2</td>
      </tr>
      <tr>
        <td>ADAFRUIT_NEOPIXEL_TYPE</td>
        <td>
          Possible values:<br />- NEO_KHZ800 800 KHz bitstream (most NeoPixel
          products w/WS2812 LEDs)<br />- NEO_KHZ400 400 KHz (classic 'v1' (not v2)
          FLORA pixels, WS2811 drivers)<br />- NEO_GRB Pixels are wired for GRB
          bitstream (most NeoPixel products)<br />- NEO_RGB Pixels are wired for
          RGB bitstream (v1 FLORA pixels, not v2)<br />- NEO_RGBW Pixels are wired
          for RGBW bitstream (NeoPixel RGBW products)
        </td>
        <td>NEO_RGB + NEO_KHZ800</td>
      </tr>
      <tr>
        <td colspan="3" align="center">M5STICKC-SPECIFIC</td>
      </tr>
      <tr>
        <td>M5STICKC_BRIGHTNESS</td>
        <td>M5Stick(c) screen brightness</td>
        <td>11</td>
      </tr>
      <tr>
        <td colspan="3" align="center">TTGO-SPECIFIC</td>
      </tr>
      <tr>
        <td>TTGO_SCREEN_ROTATION</td>
        <td>Screen rotation. Try different values from 0 to 4 to find the one you need.</td>
        <td>1</td>
      </tr>
      <tr>
        <td>TTGO_SWAP_BYTES</td>
        <td>Leave this untouched if you don't know what is this parameter</td>
        <td>true</td>
      </tr>
      <tr>
        <td>TTGO_ADC_EN</td>
        <td>Leave this untouched if you don't know what is this parameter</td>
        <td>14</td>
      </tr>
      <tr>
        <td>TTGO_ADC_PIN</td>
        <td>Leave this untouched if you don't know what is this parameter</td>
        <td>34</td>
      </tr>
      <tr>
        <td>TTGO_TFT_DISPOFF</td>
        <td>Leave this untouched if you don't know what is this parameter</td>
        <td>0x28</td>
      </tr>
      <tr>
        <td>TTGO_TFT_SLPIN</td>
        <td>Leave this untouched if you don't know what is this parameter</td>
        <td>0x10</td>
      </tr>
      <tr>
        <td>TTGO_ENABLE_BATTERY_INDICATOR</td>
        <td>Display a battery level indicator on the right side of the screen</td>
        <td>true</td>
      </tr>
      <tr>
        <td>TTGO_BATTERY_VREF</td>
        <td>Voltage reference for battery level calculations. Leave this untouched if you don't know what is this parameter.</td>
        <td>1100</td>
      </tr>
      <tr>
        <td>TTGO_BATTERY_MAX_VOLTAGE</td>
        <td>Fully charged battery voltage</td>
        <td>3.7</td>
      </tr>
      <tr>
        <td>TTGO_BATTERY_MIN_VOLTAGE</td>
        <td>Low battery voltage</td>
        <td>2.8</td>
      </tr>
      <tr>
        <td>TTGO_BATTERY_INDICATOR_COLOR</td>
        <td>Battery level indicator color</td>
        <td>0xFFFF</td>
      </tr>
      <tr>
        <td>TTGO_BATTERY_LOW_INDICATOR_COLOR</td>
        <td>Low battery level indicator color</td>
        <td>0xFF00</td>
      </tr>
    </tbody>
</table>
  
We use the following flags to enable platform-specific features (like displays and custom hardware peripherals):
|     FLAG NAME     |        DESCRIPTION       |
|:-----------------:|:------------------------:|
| PLATFORM_M5ATOM   | Enable M5Atom features   |
| PLATFORM_M5STACK  | Enable M5Stack features  |
| PLATFORM_M5STICKC | Enable M5StickC features |
| PLATFORM_TTGO     | Enable TTGO features     |

> If a device has no other internal peripherals (like esp32dev, esp12e, esp1_1m, esp07), you can add it without other "PLATFORM_ABCDEF" flag
Doing this, it's required to edit your personal user_config_override.h file to enable platform-agnostic features, like tally status output or NeoPixel.



