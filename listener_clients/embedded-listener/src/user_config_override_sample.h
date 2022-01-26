/* Place your custom build config here */

// Uncomment this if you want to use the static IP
/*
#undef USE_STATIC_IP
#define USE_STATIC_IP true

#define STATIC_IP_ADDR IPAddress(192,168,0,99)
#define GATEWAY_IP_ADDR IPAddress(192,168,0,1)
#define SUBNET_ADDR IPAddress(255,255,255,0)
#define DNS_ADDR IPAddress(192,168,0,1)
*/

// Uncomment for enabling tally status output on external pin
/*
#define PREVIEW_TALLY_STATUS_PIN D7
#define PROGRAM_TALLY_STATUS_PIN D6
#define AUX_TALLY_STATUS_PIN D5
*/

// Uncomment if you are using common-anode lights and you want to invert output logic
/*
#define INVERT_OUTPUT_LOGIC true
*/

// Uncomment if you want to use Adafruit NeoPixel
/*
#include <Adafruit_NeoPixel.h>

#define ENABLE_ADAFRUIT_NEOPIXEL true

#define ADAFRUIT_NEOPIXEL_LED_PIN 5
#define ADAFRUIT_NEOPIXEL_BRIGHTNESS 50 // Set BRIGHTNESS to about 1/5 (max = 255)
#define ADAFRUIT_NEOPIXEL_LED_COUNT 2

#define ADAFRUIT_NEOPIXEL_TYPE NEO_RGB + NEO_KHZ800
//   NEO_KHZ800  800 KHz bitstream (most NeoPixel products w/WS2812 LEDs)
//   NEO_KHZ400  400 KHz (classic 'v1' (not v2) FLORA pixels, WS2811 drivers)
//   NEO_GRB     Pixels are wired for GRB bitstream (most NeoPixel products)
//   NEO_RGB     Pixels are wired for RGB bitstream (v1 FLORA pixels, not v2)
//   NEO_RGBW    Pixels are wired for RGBW bitstream (NeoPixel RGBW products)
*/
